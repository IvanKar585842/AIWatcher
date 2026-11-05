import { MonitorCheckError } from "../check-error";
import { fetchWithSafeRedirects } from "@/lib/security/url";
import type { MarketplaceProduct } from "../marketplace/types";
import { makeRecord } from "./records";
import type { FetchLike, SourceRecord } from "./types";

export function isShopifyCatalog(url: URL): boolean {
  return url.hostname.toLowerCase().endsWith(".myshopify.com") || url.pathname.endsWith("/products.json");
}

export async function fetchShopify(
  url: URL,
  maxResults: number,
  fetchImpl?: FetchLike
): Promise<{ products: MarketplaceProduct[]; records: SourceRecord[] }> {
  const run = fetchImpl ?? fetchWithSafeRedirects;
  const endpoint = shopifyEndpoint(url);
  const response = await run(endpoint, {
    headers: { Accept: "application/json", "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot)" },
  });
  if (response.status === 401 || response.status === 403) {
    throw new MonitorCheckError("This Shopify catalog is not public. The storefront was not opened in a browser.", true);
  }
  if (!response.ok) {
    throw new MonitorCheckError(`Shopify catalog HTTP ${response.status}. The storefront was not opened in a browser.`, response.status >= 500);
  }
  const body = await response.json();
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { products?: unknown[] }).products)
      ? (body as { products: unknown[] }).products
      : body && typeof body === "object" && (body as { product?: unknown }).product
        ? [(body as { product: unknown }).product]
        : [];
  const products = list.slice(0, maxResults).map((item) => normalizeShopify(item, url)).filter((item): item is MarketplaceProduct => Boolean(item));
  if (products.length === 0) {
    throw new MonitorCheckError("Shopify returned no public products. The storefront was not opened in a browser.", true);
  }
  return {
    products,
    records: products.map((product) =>
      makeRecord({
        sourceType: url.pathname.includes("/collections/") ? "marketplace_category" : "product",
        adapter: "shopify",
        id: product.productId,
        title: product.title,
        url: product.url,
        summary: product.description,
        content: product.description,
        publishedAt: null,
        updatedAt: null,
        author: null,
        publisher: product.marketplace,
        tags: [],
        imageUrl: product.imageUrl,
        price: product.price,
        currency: product.currency,
        availability: product.availability,
        seller: product.seller,
        variant: product.variant,
        version: null,
        condition: null,
      })
    ),
  };
}

function shopifyEndpoint(url: URL): string {
  const origin = `${url.protocol}//${url.host}`;
  const collection = url.pathname.match(/\/collections\/([^/]+)\/products\.json$/i);
  if (collection) return `${origin}/collections/${collection[1]}/products.json?limit=50`;
  if (url.pathname.endsWith("/products.json")) return `${origin}${url.pathname}?limit=50`;
  const product = url.pathname.match(/\/products\/([^/.]+)(?:\.js|\.json)?$/i);
  if (product && product[1] !== "products") return `${origin}/products/${product[1]}.js`;
  return `${origin}/products.json?limit=50`;
}

export function normalizeShopify(item: unknown, pageUrl: URL): MarketplaceProduct | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const id = record.id != null ? String(record.id) : null;
  const title = typeof record.title === "string" ? record.title : null;
  if (!id || !title) return null;
  const variants = Array.isArray(record.variants) ? record.variants : [];
  const first = variants.find((variant) => variant && typeof variant === "object") as Record<string, unknown> | undefined;
  const price = first && first.price != null ? Number(first.price) : null;
  const available = variants.some((variant) => variant && typeof variant === "object" && (variant as Record<string, unknown>).available === true);
  const handle = typeof record.handle === "string" ? record.handle : id;
  const images = Array.isArray(record.images) ? record.images : [];
  const image = images[0] && typeof images[0] === "object" ? (images[0] as Record<string, unknown>).src : null;
  return {
    marketplace: `shopify_${pageUrl.hostname.replace(/\.myshopify\.com$/i, "")}`,
    productId: id,
    title,
    description: typeof record.body_html === "string" ? record.body_html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500) : null,
    url: `${pageUrl.protocol}//${pageUrl.host}/products/${handle}`,
    price: Number.isFinite(price) ? price : null,
    currency: null,
    availability: variants.length === 0 ? "unknown" : available ? "in_stock" : "out_of_stock",
    seller: typeof record.vendor === "string" ? record.vendor : null,
    variant: first && typeof first.title === "string" && first.title !== "Default Title" ? first.title : null,
    imageUrl: typeof image === "string" ? image : null,
    source: "official_api",
  };
}
