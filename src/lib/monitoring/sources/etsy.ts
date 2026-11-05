import { MonitorCheckError } from "../check-error";
import { fetchWithSafeRedirects } from "@/lib/security/url";
import { ApiBudget } from "../marketplace/http";
import type { MarketplaceProduct } from "../marketplace/types";
import { makeRecord } from "./records";
import type { FetchLike, SourceRecord } from "./types";

const API = "https://openapi.etsy.com/v3/application";

export function etsyConfigured(): boolean {
  return Boolean(process.env.ETSY_API_KEY?.trim());
}

export function etsyMissingMessage(): string {
  return "Etsy listings are not fetched with a browser. The Open API v3 connector is implemented and awaiting ETSY_API_KEY.";
}

export async function fetchEtsy(
  url: URL,
  maxResults: number,
  maxCalls: number,
  fetchImpl?: FetchLike
): Promise<{ products: MarketplaceProduct[]; records: SourceRecord[] }> {
  const key = process.env.ETSY_API_KEY?.trim();
  if (!key) throw new MonitorCheckError(etsyMissingMessage(), true);
  const run = fetchImpl ?? fetchWithSafeRedirects;
  const budget = new ApiBudget(maxCalls);
  const listingId = url.pathname.match(/\/listing\/(\d+)/)?.[1];
  const query = url.searchParams.get("q");
  const shop = url.pathname.match(/\/shop\/([^/]+)/)?.[1];
  let listings: unknown[] = [];
  if (listingId) {
    listings = [await getJson(run, `${API}/listings/${listingId}`, key, budget)];
  } else if (query) {
    const body = await getJson(run, `${API}/listings/active?keywords=${encodeURIComponent(query)}&limit=${Math.min(25, maxResults)}`, key, budget);
    listings = arrayOf(body, "results");
  } else if (shop) {
    const found = await getJson(run, `${API}/shops?shop_name=${encodeURIComponent(shop)}`, key, budget);
    const shopId = arrayOf(found, "results")[0] && typeof arrayOf(found, "results")[0] === "object"
      ? (arrayOf(found, "results")[0] as Record<string, unknown>).shop_id
      : null;
    if (!shopId) throw new MonitorCheckError("Etsy did not return this shop. The page was not opened in a browser.", true);
    const body = await getJson(run, `${API}/shops/${shopId}/listings/active?limit=${Math.min(25, maxResults)}`, key, budget);
    listings = arrayOf(body, "results");
  } else {
    throw new MonitorCheckError("Etsy monitoring needs a /listing/{id}, /shop/{name}, or /search?q= URL. A browser is not used.", true);
  }
  const products = listings.slice(0, maxResults).map(normalizeEtsy).filter((item): item is MarketplaceProduct => Boolean(item));
  if (products.length === 0) {
    throw new MonitorCheckError("Etsy returned no listings. The page was not opened in a browser.", true);
  }
  return { products, records: products.map((product) => productRecord(product, query ? "marketplace_search" : "product")) };
}

async function getJson(fetchImpl: FetchLike, endpoint: string, key: string, budget: ApiBudget): Promise<unknown> {
  budget.charge();
  const response = await fetchImpl(endpoint, { headers: { "x-api-key": key, Accept: "application/json" } });
  if (response.status === 429) throw new MonitorCheckError("Etsy API quota exceeded", false);
  if (response.status === 401 || response.status === 403) {
    throw new MonitorCheckError("Etsy authentication failed. Check ETSY_API_KEY.", true);
  }
  if (!response.ok) throw new MonitorCheckError(`Etsy HTTP ${response.status}`, response.status >= 500);
  return response.json();
}

function arrayOf(body: unknown, key: string): unknown[] {
  if (body && typeof body === "object" && Array.isArray((body as Record<string, unknown>)[key])) {
    return (body as Record<string, unknown>)[key] as unknown[];
  }
  return [];
}

export function normalizeEtsy(item: unknown): MarketplaceProduct | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const id = record.listing_id != null ? String(record.listing_id) : null;
  const title = typeof record.title === "string" ? record.title : null;
  if (!id || !title) return null;
  const price = record.price && typeof record.price === "object" ? (record.price as Record<string, unknown>) : null;
  const amount = price ? Number(price.amount) : NaN;
  const divisor = price ? Number(price.divisor) : NaN;
  const value = Number.isFinite(amount) && Number.isFinite(divisor) && divisor > 0 ? amount / divisor : null;
  const quantity = typeof record.quantity === "number" ? record.quantity : null;
  const state = typeof record.state === "string" ? record.state : null;
  return {
    marketplace: "etsy",
    productId: id,
    title,
    description: typeof record.description === "string" ? record.description.slice(0, 500) : null,
    url: typeof record.url === "string" ? record.url.split("?")[0] : `https://www.etsy.com/listing/${id}`,
    price: value,
    currency: price && typeof price.currency_code === "string" ? price.currency_code : null,
    availability: quantity === 0 || state === "inactive" || state === "sold_out" ? "out_of_stock" : quantity != null || state === "active" ? "in_stock" : "unknown",
    seller: record.shop_id != null ? `shop:${record.shop_id}` : null,
    variant: null,
    imageUrl: null,
    source: "official_api",
  };
}

function productRecord(product: MarketplaceProduct, sourceType: "product" | "marketplace_search"): SourceRecord {
  return makeRecord({
    sourceType,
    adapter: "etsy",
    id: product.productId,
    title: product.title,
    url: product.url,
    summary: product.description,
    content: product.description,
    publishedAt: null,
    updatedAt: null,
    author: null,
    publisher: "etsy",
    imageUrl: product.imageUrl,
    price: product.price,
    currency: product.currency,
    availability: product.availability,
    seller: product.seller,
    variant: product.variant,
    version: null,
    condition: null,
  });
}
