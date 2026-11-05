import type { MarketplaceProduct } from "./types";

export interface MarketplaceDiff {
  changed: boolean;
  decisive: boolean;
  summaryLines: string[];
}

function money(product: MarketplaceProduct): string {
  if (product.price == null || !product.currency) return "price unavailable";
  return `${product.price} ${product.currency}`;
}

function sameOffer(previous: MarketplaceProduct, current: MarketplaceProduct): boolean {
  return (
    previous.price === current.price &&
    previous.currency === current.currency &&
    previous.availability === current.availability &&
    previous.seller === current.seller &&
    previous.variant === current.variant &&
    (!previous.condition || !current.condition || previous.condition === current.condition) &&
    (previous.expiresAt ?? null) === (current.expiresAt ?? null) &&
    (previous.title ?? "") === (current.title ?? "") &&
    (previous.description ?? "") === (current.description ?? "")
  );
}

/**
 * Identity is the marketplace product id, not the tracking URL.
 * The same ASIN or eBay item id with a different query string is one product.
 */
export function compareMarketplaceProducts(
  previous: MarketplaceProduct[] | null | undefined,
  current: MarketplaceProduct[] | null | undefined,
  confirmRemovals = true
): MarketplaceDiff | null {
  if (!previous?.length || !current) return null;
  const prev = new Map(previous.map((product) => [product.productId, product]));
  const next = new Map(current.map((product) => [product.productId, product]));
  const lines: string[] = [];

  for (const product of next.values()) {
    const prior = prev.get(product.productId);
    if (!prior) {
      lines.push(`New product: ${product.title ?? product.productId}`);
      continue;
    }
    if (sameOffer(prior, product)) continue;
    if (prior.price !== product.price || prior.currency !== product.currency) {
      lines.push(
        `Price changed from ${money(prior)} to ${money(product)} (${product.title ?? product.productId})`
      );
    }
    if (prior.availability !== product.availability && product.availability !== "unknown") {
      lines.push(
        `Availability changed from ${prior.availability.replace(/_/g, " ")} to ${product.availability.replace(/_/g, " ")}`
      );
    }
    if (prior.seller !== product.seller && prior.seller && product.seller) {
      lines.push(`Seller changed from ${prior.seller} to ${product.seller}`);
    }
    if (prior.condition && product.condition && prior.condition !== product.condition) {
      lines.push(`Condition changed from ${prior.condition} to ${product.condition}`);
    }
    if (prior.variant !== product.variant && (prior.variant || product.variant)) {
      lines.push(`Variant changed from ${prior.variant ?? "none"} to ${product.variant ?? "none"}`);
    }
    if ((prior.expiresAt ?? null) !== (product.expiresAt ?? null) && product.expiresAt) {
      lines.push(`Listing expiration changed to ${product.expiresAt}`);
    }
    if ((prior.title ?? "") !== (product.title ?? "") && product.title) {
      lines.push(`Title changed to ${product.title}`);
    }
    if ((prior.description ?? "") !== (product.description ?? "") && product.description) {
      lines.push("Product description changed");
    }
  }

  if (confirmRemovals) {
    for (const product of prev.values()) {
      if (!next.has(product.productId)) {
        lines.push(`Removed product: ${product.title ?? product.productId}`);
      }
    }
  }

  return {
    changed: lines.length > 0,
    decisive: true,
    summaryLines: lines.length > 0 ? lines.slice(0, 12) : ["Marketplace listing unchanged"],
  };
}

export function readMarketplaceProducts(metadata: Record<string, unknown> | null | undefined): MarketplaceProduct[] | null {
  const value = metadata?.marketplaceProducts;
  if (!Array.isArray(value)) return null;
  return value.filter((item) => item && typeof item === "object" && typeof (item as MarketplaceProduct).productId === "string") as MarketplaceProduct[];
}

/** Stable text stored in the snapshot. Check time is intentionally omitted. */
export function renderMarketplaceSnapshot(products: MarketplaceProduct[]): string {
  return products
    .slice()
    .sort((a, b) => a.productId.localeCompare(b.productId))
    .map((product) =>
      [
        `marketplace=${product.marketplace}`,
        `id=${product.productId}`,
        `title=${product.title ?? ""}`,
        `description=${product.description ?? ""}`,
        `price=${product.price ?? ""}`,
        `currency=${product.currency ?? ""}`,
        `availability=${product.availability}`,
        `seller=${product.seller ?? ""}`,
        `variant=${product.variant ?? ""}`,
        `expires=${product.expiresAt ?? ""}`,
      ].join("\n")
    )
    .join("\n---\n");
}
