export type SourceKind =
  | "product"
  | "marketplace_search"
  | "marketplace_category"
  | "news_feed"
  | "news_search"
  | "news_article"
  | "release"
  | "changelog"
  | "webpage";

export type SourceSupport = "supported" | "partial" | "credentials" | "unsupported" | "webpage";

export interface SourceRecord {
  sourceType: SourceKind;
  adapter: string;
  id: string;
  title: string | null;
  url: string | null;
  summary: string | null;
  content: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  author: string | null;
  publisher: string | null;
  tags: string[];
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  availability: string | null;
  seller: string | null;
  variant: string | null;
  version: string | null;
  condition: string | null;
  fingerprint: string;
}

export interface SourceCheckResult {
  rawHtml: string;
  metadata: Record<string, unknown>;
}

export interface SourceRunOptions {
  fetchImpl?: FetchLike;
  limits?: { maxApiCalls: number; maxResults: number };
  sourceType?: SourceKind | null;
  keywords?: string[];
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface SourceSupportInfo {
  adapter: string;
  support: SourceSupport;
  label: string;
  detail: string;
}
