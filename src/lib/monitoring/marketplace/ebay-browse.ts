import { MonitorCheckError } from "../check-error";
import { withDomainTurn } from "../fetch-budget";
import type { FetchLike } from "../sources/types";
import type { MarketplaceAvailability, MarketplaceCheckLimits, MarketplacePage, MarketplaceProduct, MarketplaceQuery } from "./types";
import { ApiBudget, ebayLegacyId, ebayMarketplaceCode, readJson, sleep, throwForStatus } from "./http";

interface EbayCredentials {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
  marketplaceId: string;
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenCacheEntry>();

export function clearEbayTokenCache(): void {
  tokenCache.clear();
}

export function ebayCredentials(hostname?: string): EbayCredentials | null {
  const clientId = process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const environment = process.env.EBAY_ENVIRONMENT?.trim().toLowerCase() === "production" ? "production" : "sandbox";
  const fromHost = ebayMarketplaceIdForHost(hostname);
  const marketplaceId = fromHost || process.env.EBAY_MARKETPLACE_ID?.trim() || "EBAY_US";
  return { clientId, clientSecret, environment, marketplaceId };
}

export function ebayMissingCredentialsMessage(): string {
  return (
    "eBay listings are not fetched with a browser. The Browse API connector is implemented and awaiting credentials. " +
    "Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_MARKETPLACE_ID, and EBAY_ENVIRONMENT=sandbox or production."
  );
}

export function ebayMarketplaceIdForHost(hostname?: string): string | null {
  const host = (hostname ?? "").replace(/^www\./i, "").toLowerCase();
  const ids: Record<string, string> = {
    "ebay.com": "EBAY_US",
    "ebay.co.uk": "EBAY_GB",
    "ebay.de": "EBAY_DE",
    "ebay.fr": "EBAY_FR",
    "ebay.it": "EBAY_IT",
    "ebay.es": "EBAY_ES",
    "ebay.ca": "EBAY_CA",
    "ebay.com.au": "EBAY_AU",
    "ebay.at": "EBAY_AT",
    "ebay.ch": "EBAY_CH",
    "ebay.nl": "EBAY_NL",
    "ebay.ie": "EBAY_IE",
    "ebay.pl": "EBAY_PL",
    "ebay.com.be": "EBAY_BE",
    "ebay.com.hk": "EBAY_HK",
    "ebay.com.sg": "EBAY_SG",
    "ebay.com.my": "EBAY_MY",
  };
  return ids[host] ?? null;
}

function apiRoot(environment: EbayCredentials["environment"]): string {
  return environment === "production" ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
}

export interface EbayClientOptions {
  fetchImpl?: FetchLike;
  now?: () => number;
  credentials?: EbayCredentials;
  maxCalls?: number;
}

export function createEbayClient(options: EbayClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const budget = new ApiBudget(options.maxCalls ?? 8);

  async function accessToken(credentials: EbayCredentials): Promise<string> {
    const key = `${credentials.environment}:${credentials.clientId}`;
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > now() + 60_000) return cached.token;
    budget.charge();
    const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64");
    const response = await fetchImpl(`${apiRoot(credentials.environment)}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });
    const body = await readJson(response);
    if (!response.ok) throwForStatus(response.status, body, "eBay");
    const token = body && typeof body === "object" ? (body as Record<string, unknown>).access_token : null;
    const expiresIn = body && typeof body === "object" ? Number((body as Record<string, unknown>).expires_in) : 7200;
    if (typeof token !== "string" || !token) {
      throw new MonitorCheckError("eBay did not return an application access token", true);
    }
    tokenCache.set(key, { token, expiresAt: now() + (Number.isFinite(expiresIn) ? expiresIn : 7200) * 1000 });
    return token;
  }

  async function get(path: string, credentials: EbayCredentials): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      budget.charge();
      const token = await accessToken(credentials);
      const response = await withDomainTurn(credentials.marketplaceId, () =>
        fetchImpl(`${apiRoot(credentials.environment)}${path}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "X-EBAY-C-MARKETPLACE-ID": credentials.marketplaceId,
            "Content-Language": "en-US",
          },
        })
      );
      const body = await readJson(response);
      if (response.status === 429 || response.status >= 500) {
        lastError = new MonitorCheckError(
          response.status === 429 ? "eBay API quota exceeded" : `eBay HTTP ${response.status}`,
          false
        );
        if (attempt === 0) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        throw lastError;
      }
      if (!response.ok) throwForStatus(response.status, body, "eBay");
      return body;
    }
    throw lastError instanceof Error ? lastError : new MonitorCheckError("eBay request failed", true);
  }

  return {
    calls: () => budget.used,
    async search(query: MarketplaceQuery, limits: MarketplaceCheckLimits): Promise<MarketplacePage> {
      const credentials = requireCredentials(options.credentials);
      const limit = Math.min(50, Math.max(1, limits.maxResults));
      const offset = ((query.page ?? 1) - 1) * limit;
      const params = new URLSearchParams();
      if (query.keywords) params.set("q", query.keywords);
      if (query.category) params.set("category_ids", query.category);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      const filters: string[] = [];
      if (query.maxPrice != null) {
        filters.push(`price:[..${query.maxPrice}]`);
        filters.push(`priceCurrency:${query.currency ?? "EUR"}`);
      }
      if (filters.length > 0) params.set("filter", filters.join(","));
      const body = await get(`/buy/browse/v1/item_summary/search?${params.toString()}`, credentials);
      const page = readSearch(body, credentials.marketplaceId);
      const total = body && typeof body === "object" ? Number((body as Record<string, unknown>).total ?? page.products.length) : page.products.length;
      return { ...page, nextPage: offset + page.products.length < total ? String(offset + limit) : null };
    },
    async getByLegacyId(legacyId: string): Promise<MarketplaceProduct> {
      const credentials = requireCredentials(options.credentials);
      const body = await get(`/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(legacyId)}`, credentials);
      const product = normalizeEbayItem(body, credentials.marketplaceId);
      if (!product) throw new MonitorCheckError("eBay did not return this listing", true);
      return product;
    },
    async getItem(itemId: string): Promise<MarketplaceProduct> {
      const credentials = requireCredentials(options.credentials);
      const body = await get(`/buy/browse/v1/item/${encodeURIComponent(itemId)}`, credentials);
      const product = normalizeEbayItem(body, credentials.marketplaceId);
      if (!product) throw new MonitorCheckError("eBay did not return this listing", true);
      return product;
    },
    async getItemGroup(itemGroupId: string): Promise<MarketplaceProduct[]> {
      const credentials = requireCredentials(options.credentials);
      const body = await get(
        `/buy/browse/v1/item/get_items_by_item_group?item_group_id=${encodeURIComponent(itemGroupId)}`,
        credentials
      );
      const items = body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).items)
        ? ((body as Record<string, unknown>).items as unknown[])
        : [];
      return items
        .map((item) => normalizeEbayItem(item, credentials.marketplaceId))
        .filter((item): item is MarketplaceProduct => Boolean(item));
    },
  };
}

function requireCredentials(credentials: EbayCredentials | undefined): EbayCredentials {
  if (credentials) return credentials;
  const resolved = ebayCredentials();
  if (!resolved) throw new MonitorCheckError(ebayMissingCredentialsMessage(), true);
  return resolved;
}

export function readSearch(body: unknown, marketplaceId: string): MarketplacePage {
  const summaries = body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).itemSummaries)
    ? ((body as Record<string, unknown>).itemSummaries as unknown[])
    : [];
  const products = summaries
    .map((item) => normalizeEbayItem(item, marketplaceId))
    .filter((item): item is MarketplaceProduct => Boolean(item));
  return { products: dedupe(products), nextPage: null };
}

export function normalizeEbayItem(item: unknown, marketplaceId: string): MarketplaceProduct | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const productId = typeof record.itemId === "string" ? record.itemId : typeof record.legacyItemId === "string" ? record.legacyItemId : null;
  if (!productId) return null;
  const priceNode = record.price && typeof record.price === "object" ? (record.price as Record<string, unknown>) : null;
  const amount = priceNode ? Number(priceNode.value) : NaN;
  const currency = priceNode && typeof priceNode.currency === "string" ? priceNode.currency : null;
  const seller = record.seller && typeof record.seller === "object" ? (record.seller as Record<string, unknown>).username : null;
  const image = record.image && typeof record.image === "object" ? (record.image as Record<string, unknown>).imageUrl : null;
  return {
    marketplace: ebayMarketplaceCode(marketplaceId),
    productId,
    title: typeof record.title === "string" ? record.title : null,
    description: typeof record.shortDescription === "string" ? record.shortDescription : null,
    url: typeof record.itemWebUrl === "string" ? stripEbayTracking(record.itemWebUrl) : null,
    price: Number.isFinite(amount) ? amount : null,
    currency: Number.isFinite(amount) ? currency : null,
    availability: ebayAvailability(record),
    seller: typeof seller === "string" ? seller : null,
    variant: aspectLabel(record),
    imageUrl: typeof image === "string" ? image : null,
    source: "official_api",
    expiresAt: typeof record.itemEndDate === "string" ? record.itemEndDate : null,
  };
}

function ebayAvailability(record: Record<string, unknown>): MarketplaceAvailability {
  const estimates = record.estimatedAvailabilities;
  const first = Array.isArray(estimates) && estimates[0] && typeof estimates[0] === "object"
    ? String((estimates[0] as Record<string, unknown>).estimatedAvailabilityStatus ?? "")
    : "";
  const normalized = first.toUpperCase();
  if (normalized.includes("OUT_OF_STOCK")) return "out_of_stock";
  if (normalized.includes("IN_STOCK")) return "in_stock";
  return "unknown";
}

function aspectLabel(record: Record<string, unknown>): string | null {
  const aspects = record.localizedAspects;
  if (!Array.isArray(aspects)) return null;
  const parts = aspects
    .map((aspect) => {
      if (!aspect || typeof aspect !== "object") return null;
      const name = (aspect as Record<string, unknown>).name;
      const value = (aspect as Record<string, unknown>).value;
      if (typeof name !== "string" || typeof value !== "string") return null;
      return `${name}: ${value}`;
    })
    .filter((part): part is string => Boolean(part))
    .slice(0, 4);
  return parts.length > 0 ? parts.join(", ") : null;
}

function stripEbayTracking(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of ["_trkparms", "hash", "amdata", "mkevt", "mkcid", "mkrid", "campid", "toolid"]) {
      parsed.searchParams.delete(key);
    }
    parsed.hash = "";
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

export function parseEbayUrl(url: URL): MarketplaceQuery | null {
  const host = url.hostname.replace(/^www\./, "");
  if (!/(^|\.)ebay\./i.test(host)) return null;
  const legacyId = ebayLegacyId(url.pathname);
  if (legacyId) {
    return { kind: "product", marketplace: ebayMarketplaceIdForHost(host) ?? "EBAY_US", productId: legacyId };
  }
  if (url.pathname.startsWith("/sch")) {
    const keywords = url.searchParams.get("_nkw") || url.searchParams.get("kw");
    if (!keywords?.trim()) {
      throw new MonitorCheckError("eBay search monitoring needs a keyword (_nkw). Browser fetching is not used for eBay.", true);
    }
    const max = url.searchParams.get("_udhi");
    const category = url.searchParams.get("_sacat");
    return {
      kind: "search",
      marketplace: ebayMarketplaceIdForHost(host) ?? "EBAY_US",
      keywords: keywords.trim(),
      category: category && category !== "0" ? category : undefined,
      maxPrice: max && Number.isFinite(Number(max)) ? Number(max) : undefined,
      currency: host.endsWith(".de") ? "EUR" : host.endsWith(".co.uk") ? "GBP" : "USD",
      page: positiveInt(url.searchParams.get("_pgn")),
    };
  }
  throw new MonitorCheckError(
    "eBay monitoring needs an /itm/{id} listing URL or a /sch search URL. Browser fetching is not used for eBay.",
    true
  );
}

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
