export type MarketplaceAvailability = "in_stock" | "out_of_stock" | "preorder" | "unknown";

export type MarketplaceSource = "official_api";

/**
 * Normalized listing used by the existing comparison engine.
 * Unavailable fields stay null. Nothing here is inferred.
 */
export interface MarketplaceProduct {
  marketplace: string;
  productId: string;
  title: string | null;
  description: string | null;
  url: string | null;
  price: number | null;
  currency: string | null;
  availability: MarketplaceAvailability;
  seller: string | null;
  variant: string | null;
  condition?: string | null;
  imageUrl: string | null;
  source: MarketplaceSource;
  /** Listing end time when the marketplace API returns one. */
  expiresAt?: string | null;
}

export interface MarketplacePage {
  products: MarketplaceProduct[];
  /** Present when the API reports another page and this check did not fetch it. */
  nextPage: string | null;
}

export interface MarketplaceQuery {
  kind: "product" | "search";
  marketplace: string;
  /** Stable product id (ASIN or eBay item id). */
  productId?: string;
  keywords?: string;
  category?: string;
  /** Major currency units, for example 500 means €500. */
  maxPrice?: number;
  currency?: string;
  brand?: string;
  page?: number;
}

export interface MarketplaceCheckLimits {
  maxApiCalls: number;
  maxResults: number;
}

export interface MarketplaceAdapter {
  id: string;
  matches(url: URL): boolean;
  parse(url: URL): MarketplaceQuery | null;
  configured(): boolean;
  missingCredentialsMessage(): string;
  search(query: MarketplaceQuery, limits: MarketplaceCheckLimits): Promise<MarketplacePage>;
  product(query: MarketplaceQuery, limits: MarketplaceCheckLimits): Promise<MarketplaceProduct>;
  variations?(productId: string, marketplace: string, limits: MarketplaceCheckLimits): Promise<MarketplaceProduct[]>;
}

export interface MarketplaceFetchResult {
  rawText: string;
  products: MarketplaceProduct[];
  metadata: Record<string, unknown>;
}
