import { MonitorCheckError } from "../check-error";
import { withDomainTurn } from "../fetch-budget";
import type { FetchLike } from "../sources/types";
import type { MarketplaceAvailability, MarketplaceCheckLimits, MarketplacePage, MarketplaceProduct, MarketplaceQuery } from "./types";
import {
  amazonLocale,
  amazonMarketplaceCode,
  asinFromPath,
  ApiBudget,
  readJson,
  sleep,
  throwForStatus,
  tokenEndpointForVersion,
} from "./http";

const API_ROOT = "https://creatorsapi.amazon";

export interface AmazonCredentials {
  credentialId: string;
  credentialSecret: string;
  partnerTag: string;
  version: string;
  marketplace: string;
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

export function clearAmazonTokenCache(): void {
  tokenCache.clear();
}

export function amazonCredentials(hostname?: string): AmazonCredentials | null {
  const credentialId = process.env.AMAZON_CREATORS_CREDENTIAL_ID?.trim();
  const credentialSecret = process.env.AMAZON_CREATORS_CREDENTIAL_SECRET?.trim();
  const partnerTag = process.env.AMAZON_ASSOCIATES_PARTNER_TAG?.trim();
  if (!credentialId || !credentialSecret || !partnerTag) return null;
  const locale = hostname ? amazonLocale(hostname) : null;
  const marketplace = locale?.domain || process.env.AMAZON_MARKETPLACE?.trim() || "www.amazon.de";
  const version = process.env.AMAZON_CREATORS_VERSION?.trim() || locale?.version || (marketplace.includes(".de") || marketplace.endsWith(".uk") || marketplace.endsWith(".fr") ? "3.2" : "3.1");
  return { credentialId, credentialSecret, partnerTag, version, marketplace };
}

export function amazonMissingCredentialsMessage(): string {
  const legacy = process.env.AMAZON_PAAPI_ACCESS_KEY || process.env.AMAZON_PAAPI_SECRET_KEY;
  const legacyNote = legacy
    ? " Product Advertising API 5.0 credentials are not used."
    : "";
  return (
    "Amazon storefronts are not fetched with a browser. The Creators API connector is implemented and awaiting credentials. " +
    "Set AMAZON_CREATORS_CREDENTIAL_ID, AMAZON_CREATORS_CREDENTIAL_SECRET, AMAZON_ASSOCIATES_PARTNER_TAG, and optionally AMAZON_CREATORS_VERSION and AMAZON_MARKETPLACE." +
    legacyNote
  );
}

export interface AmazonClientOptions {
  fetchImpl?: FetchLike;
  now?: () => number;
  credentials?: AmazonCredentials;
  maxCalls?: number;
}

export function createAmazonClient(options: AmazonClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const budget = new ApiBudget(options.maxCalls ?? 8);

  async function accessToken(credentials: AmazonCredentials): Promise<string> {
    const key = `${credentials.version}:${credentials.credentialId}`;
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > now() + 60_000) return cached.token;
    budget.charge();
    const response = await fetchImpl(tokenEndpointForVersion(credentials.version), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: credentials.credentialId,
        client_secret: credentials.credentialSecret,
        scope: "creatorsapi::default",
      }),
    });
    const body = await readJson(response);
    if (!response.ok) throwForStatus(response.status, body, "Amazon Creators API");
    const token = body && typeof body === "object" ? (body as Record<string, unknown>).access_token : null;
    const expiresIn = body && typeof body === "object" ? Number((body as Record<string, unknown>).expires_in) : 3600;
    if (typeof token !== "string" || !token) {
      throw new MonitorCheckError("Amazon Creators API did not return an access token", true);
    }
    tokenCache.set(key, { token, expiresAt: now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000 });
    return token;
  }

  async function post(path: string, credentials: AmazonCredentials, payload: Record<string, unknown>): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      budget.charge();
      const token = await accessToken(credentials);
      const response = await withDomainTurn(credentials.marketplace, () =>
        fetchImpl(`${API_ROOT}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-marketplace": credentials.marketplace,
          },
          body: JSON.stringify({ ...payload, marketplace: credentials.marketplace, partnerTag: credentials.partnerTag }),
        })
      );
      const body = await readJson(response);
      if (response.status === 429 || response.status >= 500) {
        lastError = new MonitorCheckError(
          response.status === 429
            ? "Amazon Creators API quota exceeded"
            : `Amazon Creators API HTTP ${response.status}`,
          response.status !== 429 && response.status < 500
        );
        if (attempt === 0) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        throw lastError;
      }
      if (!response.ok) throwForStatus(response.status, body, "Amazon Creators API");
      return body;
    }
    throw lastError instanceof Error ? lastError : new MonitorCheckError("Amazon Creators API request failed", true);
  }

  return {
    calls: () => budget.used,
    accessToken: () => {
      const credentials = options.credentials;
      if (!credentials) throw new MonitorCheckError(amazonMissingCredentialsMessage(), true);
      return accessToken(credentials);
    },
    async getItems(itemIds: string[], limits?: MarketplaceCheckLimits): Promise<MarketplaceProduct[]> {
      const credentials = requireCredentials(options.credentials);
      void limits;
      const body = await post("/catalog/v1/getItems", credentials, {
        itemIds: itemIds.slice(0, 10),
        itemIdType: "ASIN",
        resources: ITEM_RESOURCES,
      });
      return readItems(body, credentials.marketplace).products;
    },
    async searchItems(query: MarketplaceQuery, limits: MarketplaceCheckLimits): Promise<MarketplacePage> {
      const credentials = requireCredentials(options.credentials, query.marketplace);
      const itemCount = Math.min(10, Math.max(1, limits.maxResults));
      const payload: Record<string, unknown> = {
        keywords: query.keywords,
        itemCount,
        itemPage: query.page ?? 1,
        resources: ITEM_RESOURCES,
      };
      if (query.brand) payload.brand = query.brand;
      if (query.category) payload.searchIndex = query.category;
      if (query.maxPrice != null) payload.maxPrice = Math.round(query.maxPrice * 100);
      if (query.currency) payload.currencyOfPreference = query.currency;
      const body = await post("/catalog/v1/searchItems", credentials, payload);
      return readItems(body, credentials.marketplace);
    },
    async getVariations(asin: string): Promise<MarketplaceProduct[]> {
      const credentials = requireCredentials(options.credentials);
      const body = await post("/catalog/v1/getVariations", credentials, {
        asin,
        variationCount: 10,
        variationPage: 1,
        resources: ITEM_RESOURCES,
      });
      return readItems(body, credentials.marketplace).products;
    },
  };
}

const ITEM_RESOURCES = [
  "itemInfo.title",
  "itemInfo.features",
  "itemInfo.byLineInfo",
  "images.primary.medium",
  "parentASIN",
  "offersV2.listings.price",
  "offersV2.listings.availability",
  "offersV2.listings.merchantInfo",
  "offersV2.listings.isBuyBoxWinner",
];

function requireCredentials(credentials: AmazonCredentials | undefined, marketplaceHost?: string): AmazonCredentials {
  if (credentials) return credentials;
  const resolved = amazonCredentials(marketplaceHost?.replace(/^www\./, ""));
  if (!resolved) throw new MonitorCheckError(amazonMissingCredentialsMessage(), true);
  return resolved;
}

export function readItems(body: unknown, marketplaceDomain: string): MarketplacePage {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const containers = [root.itemResults, root.searchResult, root.variationsResult, root];
  let items: unknown[] = [];
  for (const container of containers) {
    if (container && typeof container === "object" && Array.isArray((container as Record<string, unknown>).items)) {
      items = (container as Record<string, unknown>).items as unknown[];
      break;
    }
  }
  const products = items
    .map((item) => normalizeAmazonItem(item, marketplaceDomain))
    .filter((item): item is MarketplaceProduct => Boolean(item));
  const deduped = dedupe(products);
  return { products: deduped, nextPage: null };
}

export function normalizeAmazonItem(item: unknown, marketplaceDomain: string): MarketplaceProduct | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const asin = typeof record.asin === "string" ? record.asin.toUpperCase() : null;
  if (!asin) return null;
  const info = record.itemInfo && typeof record.itemInfo === "object" ? (record.itemInfo as Record<string, unknown>) : {};
  const titleNode = info.title && typeof info.title === "object" ? (info.title as Record<string, unknown>) : {};
  const features = info.features && typeof info.features === "object" ? (info.features as Record<string, unknown>) : {};
  const featureList = Array.isArray(features.displayValues) ? features.displayValues.filter((value) => typeof value === "string") : [];
  const offer = buyBoxOffer(record.offersV2);
  const price = offer ? readMoney(offer.price) : null;
  const availability = offer ? readAvailability(offer.availability) : "unknown";
  const seller = offer ? readSeller(offer.merchantInfo) : null;
  return {
    marketplace: amazonMarketplaceCode(marketplaceDomain),
    productId: asin,
    title: typeof titleNode.displayValue === "string" ? titleNode.displayValue : null,
    description: featureList.length > 0 ? featureList.join("\n") : null,
    url: typeof record.detailPageURL === "string" ? stripTracking(record.detailPageURL) : `https://${marketplaceDomain}/dp/${asin}`,
    price: price?.amount ?? null,
    currency: price?.currency ?? null,
    availability,
    seller,
    variant: variationLabel(record),
    imageUrl: imageUrl(record.images),
    source: "official_api",
    ...(featureList.length > 0 ? {} : {}),
  };
}

function buyBoxOffer(offersV2: unknown): Record<string, unknown> | null {
  if (!offersV2 || typeof offersV2 !== "object") return null;
  const listings = (offersV2 as Record<string, unknown>).listings;
  if (!Array.isArray(listings)) return null;
  const objects = listings.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
  return objects.find((item) => item.isBuyBoxWinner === true) ?? objects[0] ?? null;
}

function readMoney(price: unknown): { amount: number; currency: string } | null {
  if (!price || typeof price !== "object") return null;
  const record = price as Record<string, unknown>;
  const money = record.money && typeof record.money === "object" ? (record.money as Record<string, unknown>) : record;
  const amount = typeof money.amount === "number" ? money.amount : typeof money.amount === "string" ? Number(money.amount) : NaN;
  const currency = typeof money.currency === "string" ? money.currency : null;
  if (!Number.isFinite(amount) || !currency) return null;
  return { amount, currency };
}

function readAvailability(value: unknown): MarketplaceAvailability {
  const type = value && typeof value === "object" ? String((value as Record<string, unknown>).type ?? "") : String(value ?? "");
  const normalized = type.toUpperCase();
  if (normalized.includes("OUT_OF_STOCK") || normalized.includes("UNAVAILABLE")) return "out_of_stock";
  if (normalized.includes("PREORDER") || normalized.includes("PRE_ORDER")) return "preorder";
  if (normalized.includes("IN_STOCK")) return "in_stock";
  return "unknown";
}

function readSeller(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function imageUrl(images: unknown): string | null {
  if (!images || typeof images !== "object") return null;
  const primary = (images as Record<string, unknown>).primary;
  if (!primary || typeof primary !== "object") return null;
  for (const size of ["medium", "large", "small"]) {
    const node = (primary as Record<string, unknown>)[size];
    if (node && typeof node === "object" && typeof (node as Record<string, unknown>).url === "string") {
      return (node as Record<string, unknown>).url as string;
    }
  }
  return null;
}

function variationLabel(record: Record<string, unknown>): string | null {
  const summary = record.variationSummary;
  if (!summary || typeof summary !== "object") return null;
  const values = Object.values(summary as Record<string, unknown>)
    .filter((value) => typeof value === "string")
    .slice(0, 4);
  return values.length > 0 ? values.join(" / ") : null;
}

function stripTracking(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of ["tag", "linkCode", "ref", "ref_", "psc", "th", "language"]) parsed.searchParams.delete(key);
    return parsed.toString();
  } catch {
    return url;
  }
}

function dedupe(products: MarketplaceProduct[]): MarketplaceProduct[] {
  const seen = new Set<string>();
  const result: MarketplaceProduct[] = [];
  for (const product of products) {
    if (seen.has(product.productId)) continue;
    seen.add(product.productId);
    result.push(product);
  }
  return result;
}

export function parseAmazonUrl(url: URL): MarketplaceQuery | null {
  const host = url.hostname.replace(/^www\./, "");
  if (!amazonLocale(host) && !host.endsWith(".amazon") && !/(^|\.)amazon\./.test(host) && !/(^|\.)amzn\./.test(host)) {
    return null;
  }
  if (/(^|\.)amzn\./.test(host) || host === "amzn.to") {
    throw new MonitorCheckError(
      "Short Amazon links are not expanded. Use a www.amazon.de/dp/ASIN URL. Amazon pages are not fetched with a browser.",
      true
    );
  }
  const locale = amazonLocale(host);
  if (!locale) {
    throw new MonitorCheckError(
      `Amazon marketplace ${host} is not mapped to the Creators API. Browser fetching is not used for Amazon.`,
      true
    );
  }
  const asin = asinFromPath(url.pathname);
  if (asin) {
    return { kind: "product", marketplace: locale.domain, productId: asin, currency: locale.currency };
  }
  if (url.pathname === "/s" || url.pathname.startsWith("/s/")) {
    const keywords = url.searchParams.get("k") || url.searchParams.get("field-keywords");
    if (!keywords?.trim()) {
      throw new MonitorCheckError("Amazon search monitoring needs a keyword (?k=). Browser fetching is not used for Amazon.", true);
    }
    const max = url.searchParams.get("high-price") ?? url.searchParams.get("maxPrice");
    return {
      kind: "search",
      marketplace: locale.domain,
      keywords: keywords.trim(),
      maxPrice: max && Number.isFinite(Number(max)) ? Number(max) : undefined,
      currency: locale.currency,
      page: positiveInt(url.searchParams.get("page")),
    };
  }
  throw new MonitorCheckError(
    "Amazon monitoring needs a /dp/ASIN product URL or a /s?k= search URL. Browser fetching is not used for Amazon.",
    true
  );
}

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
