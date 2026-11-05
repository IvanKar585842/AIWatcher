import type { SourceKind, SourceSupportInfo } from "./types";
import { lookupMarketplace, PUBLIC_STOREFRONT_DETAIL } from "@/lib/monitoring/marketplace/catalog";
import { knownSiteDetail, lookupKnownSite } from "@/lib/monitoring/sources/known-sites";

export function looksLikeFeed(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  return (
    path.endsWith(".rss") ||
    path.endsWith(".atom") ||
    path.endsWith("/feed") ||
    path.endsWith("/feed/") ||
    path.endsWith("/rss") ||
    path.endsWith("/rss/") ||
    path.endsWith("atom.xml") ||
    path.endsWith("rss.xml") ||
    url.searchParams.has("feed")
  );
}

export function looksLikeNewsSitemap(url: URL): boolean {
  return /sitemap/i.test(url.pathname) && /news/i.test(url.pathname + url.search);
}

export function isShopifyUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return host.endsWith(".myshopify.com") || url.pathname.endsWith("/products.json");
}

export function isEtsyUrl(url: URL): boolean {
  return /(^|\.)etsy\.com$/i.test(url.hostname.replace(/^www\./i, ""));
}

export function isGitHubReleaseUrl(url: URL): boolean {
  return /^github\.com$/i.test(url.hostname) && /^\/[^/]+\/[^/]+\/releases\/?$/i.test(url.pathname);
}

/** Client-safe support label. It does not fetch the page. */
export function describeSource(rawUrl: string, sourceType?: SourceKind | null): SourceSupportInfo {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { adapter: "none", support: "unsupported", label: "Invalid URL", detail: "Enter a full http or https URL." };
  }
  if (/(^|\.)amazon\./i.test(url.hostname) || /(^|\.)amzn\./i.test(url.hostname)) {
    return {
      adapter: "amazon-creators",
      support: "credentials",
      label: "Amazon Creators API",
      detail: "Product and search URLs use the official Creators API. A browser is not used. Credentials must be set on the server.",
    };
  }
  if (/(^|\.)ebay\./i.test(url.hostname)) {
    return {
      adapter: "ebay-browse",
      support: "credentials",
      label: "eBay Browse API",
      detail: "Listings and searches use the official Browse API. A browser is not used. Credentials must be set on the server.",
    };
  }
  if (isEtsyUrl(url)) {
    return {
      adapter: "etsy",
      support: "credentials",
      label: "Etsy Open API",
      detail: "Listing, shop, and search URLs use Etsy's Open API v3 when ETSY_API_KEY is set. A browser is not used.",
    };
  }
  if (isShopifyUrl(url)) {
    return {
      adapter: "shopify",
      support: "supported",
      label: "Shopify public catalog",
      detail: "Uses the store's public products.json or product.js feed. Checkout and account pages are not monitored.",
    };
  }
  if (looksLikeNewsSitemap(url)) {
    return { adapter: "news-sitemap", support: "supported", label: "News sitemap", detail: "New and updated sitemap entries are compared. Items that age out of the sitemap are not treated as deleted." };
  }
  if (looksLikeFeed(url) || sourceType === "news_feed" || sourceType === "news_search") {
    return {
      adapter: "feed",
      support: sourceType === "news_search" ? "partial" : "supported",
      label: sourceType === "news_search" ? "News search" : "RSS / Atom",
      detail: "Feed items are compared by stable id. A keyword filter applies when keywords are set. Articles that drop off the latest page are not marked removed.",
    };
  }
  if (isGitHubReleaseUrl(url) || sourceType === "release") {
    return { adapter: "github-releases", support: "supported", label: "GitHub releases", detail: "Uses the public GitHub releases API. New versions are reported. Older releases leaving the latest page are not marked deleted." };
  }
  if (sourceType === "news_article") {
    return { adapter: "article", support: "partial", label: "Article page", detail: "Readable HTML is extracted. JavaScript-only articles should use the site's RSS feed instead." };
  }
  if (sourceType === "changelog") {
    return { adapter: "changelog", support: "partial", label: "Changelog", detail: "Feeds and GitHub releases are precise. Other changelog URLs use the normal page check." };
  }
  const knownStore = lookupMarketplace(url.hostname);
  if (knownStore?.access === "public-page") {
    return {
      adapter: "scrapling",
      support: "webpage",
      label: knownStore.name,
      detail: PUBLIC_STOREFRONT_DETAIL,
    };
  }
  const known = lookupKnownSite(url.hostname);
  if (known && !isGitHubReleaseUrl(url)) {
    return {
      adapter: "scrapling",
      support: "webpage",
      label: known.name,
      detail: knownSiteDetail(known.kind),
    };
  }
  return {
    adapter: "scrapling",
    support: "webpage",
    label: "General webpage",
    detail: "Public pages use Scrapling, HTTP first. A browser runs only when the page needs JavaScript.",
  };
}
