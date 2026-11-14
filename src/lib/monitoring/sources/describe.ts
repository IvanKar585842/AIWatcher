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
      label: "Not a page you operate",
      detail:
        "Add a page on a site your company owns. Store listings are outside this assistant.",
    };
  }
  if (/(^|\.)ebay\./i.test(url.hostname)) {
    return {
      adapter: "ebay-browse",
      support: "credentials",
      label: "Not a page you operate",
      detail: "Add a page on a site your company owns. Store listings are outside this assistant.",
    };
  }
  if (isEtsyUrl(url)) {
    return {
      adapter: "etsy",
      support: "credentials",
      label: "Not a page you operate",
      detail: "Add a page on a site your company owns. Store listings are outside this assistant.",
    };
  }
  if (isShopifyUrl(url)) {
    return {
      adapter: "shopify",
      support: "supported",
      label: "A store you operate",
      detail: "If this store is yours, the catalog feed is compared. Checkout and account pages are not checked.",
    };
  }
  if (looksLikeNewsSitemap(url)) {
    return { adapter: "news-sitemap", support: "supported", label: "A feed you publish", detail: "New and updated entries on your site are compared. Items that age out are not treated as deleted." };
  }
  if (looksLikeFeed(url) || sourceType === "news_feed" || sourceType === "news_search") {
    return {
      adapter: "feed",
      support: sourceType === "news_search" ? "partial" : "supported",
      label: "A feed you publish",
      detail: "Items in a feed your company publishes are compared. A story falling off the latest page is not marked removed.",
    };
  }
  if (isGitHubReleaseUrl(url) || sourceType === "release") {
    return { adapter: "github-releases", support: "supported", label: "Releases you publish", detail: "New versions on a repository your company owns are reported. Older releases leaving the latest page are not marked deleted." };
  }
  if (sourceType === "news_article") {
    return { adapter: "article", support: "partial", label: "A post on your site", detail: "Readable text is compared. If the post only appears after scripts run, use the feed you publish." };
  }
  if (sourceType === "changelog") {
    return { adapter: "changelog", support: "partial", label: "Your changelog", detail: "A feed or releases page is precise. Other changelog addresses use the normal page check." };
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
    label: "A page you own",
    detail: "The page is compared as published. A browser runs only when the page is an empty script shell.",
  };
}
