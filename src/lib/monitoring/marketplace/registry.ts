import { recordFetchSample } from "../fetch-budget";
import { MonitorCheckError } from "../check-error";
import {
  amazonCredentials,
  amazonMissingCredentialsMessage,
  clearAmazonTokenCache,
  createAmazonClient,
  parseAmazonUrl,
} from "./amazon-creators";
import { renderMarketplaceSnapshot } from "./compare-products";
import { clearEbayTokenCache, createEbayClient, ebayCredentials, ebayMissingCredentialsMessage, parseEbayUrl } from "./ebay-browse";
import type { FetchLike } from "../sources/types";
import type { MarketplaceCheckLimits, MarketplaceProduct } from "./types";

export interface MarketplaceContent {
  rawHtml: string;
  metadata: Record<string, unknown>;
}

export interface MarketplaceRunOptions {
  fetchImpl?: FetchLike;
  now?: () => number;
  limits?: MarketplaceCheckLimits;
}

const DEFAULT_LIMITS: MarketplaceCheckLimits = { maxApiCalls: 4, maxResults: 10 };

export function marketplaceForUrl(url: URL): "amazon" | "ebay" | null {
  const host = url.hostname.replace(/^www\./i, "");
  if (/(^|\.)amazon\./i.test(host) || /(^|\.)amzn\./i.test(host) || host === "amzn.to") return "amazon";
  if (/(^|\.)ebay\./i.test(host)) return "ebay";
  return null;
}

export function clearMarketplaceTokenCaches(): void {
  clearAmazonTokenCache();
  clearEbayTokenCache();
}

/**
 * Official marketplace check. Returns null for ordinary websites so Scrapling
 * remains the fallback. Amazon and eBay never fall through to a browser.
 */
export async function runMarketplaceCheck(
  url: string,
  options: MarketplaceRunOptions = {}
): Promise<MarketplaceContent | null> {
  const parsed = new URL(url);
  const which = marketplaceForUrl(parsed);
  if (!which) return null;
  const started = Date.now();
  const limits = options.limits ?? DEFAULT_LIMITS;
  try {
    const result = which === "amazon" ? await runAmazon(parsed, limits, options) : await runEbay(parsed, limits, options);
    if (result.products.length === 0) {
      throw new MonitorCheckError(
        which === "amazon"
          ? "Amazon Creators API returned no items for this request. The previous snapshot was kept."
          : "eBay Browse API returned no listings for this request. The previous snapshot was kept.",
        true
      );
    }
    const durationMs = Date.now() - started;
    recordFetchSample({
      outcome: "success",
      strategy: "official-api",
      browserLaunches: 0,
      durationMs,
      marketplaceApiCalls: result.calls,
    });
    return toOfficial(which, result.products, durationMs, result.calls);
  } catch (error) {
    recordFetchSample({
      outcome: "failure",
      strategy: "official-api",
      browserLaunches: 0,
      durationMs: Date.now() - started,
    });
    throw error;
  }
}

async function runAmazon(
  url: URL,
  limits: MarketplaceCheckLimits,
  options: MarketplaceRunOptions
): Promise<{ products: MarketplaceProduct[]; calls: number }> {
  const query = parseAmazonUrl(url);
  if (!query) return { products: [], calls: 0 };
  const credentials = amazonCredentials(url.hostname);
  if (!credentials) throw new MonitorCheckError(amazonMissingCredentialsMessage(), true);
  const client = createAmazonClient({
    fetchImpl: options.fetchImpl,
    now: options.now,
    credentials: { ...credentials, marketplace: query.marketplace },
    maxCalls: limits.maxApiCalls,
  });
  if (query.kind === "search") {
    const page = await client.searchItems(query, limits);
    return { products: page.products.slice(0, limits.maxResults), calls: client.calls() };
  }
  const products = await client.getItems([query.productId!], limits);
  const primary = products.find((product) => product.productId === query.productId) ?? products[0];
  if (!primary) {
    throw new MonitorCheckError("Amazon Creators API did not return this ASIN. The previous snapshot was kept.", true);
  }
  if (limits.maxApiCalls >= 6) {
    try {
      const variations = await client.getVariations(primary.productId);
      const self = variations.find((item) => item.productId === primary.productId);
      if (self?.variant) primary.variant = self.variant;
    } catch (error) {
      if (!(error instanceof MonitorCheckError) || !/budget|quota/i.test(error.message)) throw error;
    }
  }
  return { products: [primary], calls: client.calls() };
}

async function runEbay(
  url: URL,
  limits: MarketplaceCheckLimits,
  options: MarketplaceRunOptions
): Promise<{ products: MarketplaceProduct[]; calls: number }> {
  const query = parseEbayUrl(url);
  if (!query) return { products: [], calls: 0 };
  const credentials = ebayCredentials(url.hostname);
  if (!credentials) throw new MonitorCheckError(ebayMissingCredentialsMessage(), true);
  const client = createEbayClient({
    fetchImpl: options.fetchImpl,
    now: options.now,
    credentials: { ...credentials, marketplaceId: query.marketplace },
    maxCalls: limits.maxApiCalls,
  });
  if (query.kind === "search") {
    const page = await client.search(query, limits);
    return { products: page.products.slice(0, limits.maxResults), calls: client.calls() };
  }
  const product = await client.getByLegacyId(query.productId!);
  return { products: [product], calls: client.calls() };
}

function toOfficial(
  provider: "amazon" | "ebay",
  products: MarketplaceProduct[],
  durationMs: number,
  apiCalls: number
): MarketplaceContent {
  const primary = products[0];
  return {
    rawHtml: renderMarketplaceSnapshot(products),
    metadata: {
      captureType: provider === "amazon" ? "amazon_creators_api" : "ebay_browse_api",
      engine: "official-api",
      fetchStrategy: "http",
      browserLaunched: false,
      browserLaunches: 0,
      durationMs,
      marketplaceApiCalls: apiCalls,
      checkStatus: "success",
      requiresBrowser: false,
      provider,
      source: "official_api",
      marketplace: primary?.marketplace ?? provider,
      marketplaceProducts: products,
      structured: {
        title: primary?.title ?? undefined,
        prices: products
          .filter((product) => product.price != null && product.currency)
          .map((product) => ({
            raw: `${product.price} ${product.currency}`,
            value: product.price,
            currency: product.currency,
          })),
        availability: primary?.availability ?? "unknown",
        items: products.map((product) => ({
          key: product.productId,
          title: product.title ?? product.productId,
          url: product.url ?? undefined,
          price: product.price,
        })),
        listingsFound: true,
        images: products.map((product) => product.imageUrl).filter((url): url is string => Boolean(url)),
      },
    },
  };
}
