import { MonitorCheckError } from "../check-error";
import { recordFetchSample } from "../fetch-budget";
import { runMarketplaceCheck } from "../marketplace/registry";
import type { MarketplaceProduct } from "../marketplace/types";
import { fetchArticle } from "./article";
import { looksLikeFeed, looksLikeNewsSitemap, isShopifyUrl, isEtsyUrl } from "./describe";
import { fetchEtsy } from "./etsy";
import { feedAlternate, parseFeed } from "./feeds";
import { parseNewsSitemap } from "./news-sitemap";
import { renderRecords } from "./records";
import { fetchGitHubReleases, githubReleaseTarget } from "./releases";
import { fetchShopify } from "./shopify";
import type { SourceCheckResult, SourceKind, SourceRecord, SourceRunOptions, FetchLike } from "./types";

const DEFAULT_LIMIT = 10;

/**
 * Official and structured sources. Returns null when the URL should use Scrapling.
 * Amazon, eBay, and Etsy never fall through to a browser.
 * Other storefronts return null so the public page is fetched.
 */
export async function runSourceCheck(url: string, options: SourceRunOptions = {}): Promise<SourceCheckResult | null> {
  const parsed = new URL(url);
  if (/(^|\.)amazon\./i.test(parsed.hostname) || /(^|\.)amzn\./i.test(parsed.hostname) || parsed.hostname === "amzn.to") {
    const result = await runMarketplaceCheck(url, options);
    return result;
  }
  if (/(^|\.)ebay\./i.test(parsed.hostname)) {
    return runMarketplaceCheck(url, options);
  }

  const started = Date.now();
  const limit = options.limits?.maxResults ?? DEFAULT_LIMIT;
  const fetchImpl = options.fetchImpl;
  const sourceType = options.sourceType ?? null;
  try {
    if (isEtsyUrl(parsed)) {
      const etsy = await fetchEtsy(parsed, limit, options.limits?.maxApiCalls ?? 4, fetchImpl);
      return finish("etsy", etsy.records, etsy.products, true, Date.now() - started);
    }
    if (isShopifyUrl(parsed) || (sourceType === "marketplace_category" && parsed.pathname.includes("/collections/"))) {
      const shop = await fetchShopify(parsed, limit, fetchImpl);
      const complete = shop.products.length < limit;
      return finish("shopify", shop.records, shop.products, complete, Date.now() - started);
    }
    if (looksLikeNewsSitemap(parsed) || (sourceType === "news_feed" && /sitemap/i.test(parsed.pathname))) {
      const xml = await readText(url, fetchImpl);
      const records = parseNewsSitemap(xml, limit);
      if (records.length === 0) throw new MonitorCheckError("The news sitemap did not contain article URLs.", true);
      return finish("news-sitemap", records, [], false, Date.now() - started);
    }
    const github = githubReleaseTarget(parsed);
    if (github || sourceType === "release" && githubReleaseTarget(parsed)) {
      const target = github ?? githubReleaseTarget(parsed);
      if (target) {
        const records = await fetchGitHubReleases(target.owner, target.repo, limit, fetchImpl);
        if (records.length === 0) throw new MonitorCheckError("GitHub returned no releases.", true);
        return finish("github-releases", records, [], false, Date.now() - started);
      }
    }
    if (looksLikeFeed(parsed) || sourceType === "news_feed" || sourceType === "news_search") {
      const records = await loadFeed(url, sourceType, options.keywords ?? [], limit, fetchImpl);
      return finish("feed", records, [], false, Date.now() - started);
    }
    if ((sourceType === "release" || sourceType === "changelog") && looksLikeFeed(parsed)) {
      const records = await loadFeed(url, sourceType, options.keywords ?? [], limit, fetchImpl);
      return finish("feed", records, [], false, Date.now() - started);
    }
    if (sourceType === "news_article") {
      const record = await fetchArticle(url, fetchImpl);
      return finish("article", [record], [], true, Date.now() - started);
    }
    return null;
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

async function loadFeed(
  url: string,
  sourceType: SourceKind | null,
  keywords: string[],
  limit: number,
  fetchImpl?: FetchLike
): Promise<SourceRecord[]> {
  const kind: SourceKind = sourceType === "release" ? "release" : sourceType === "changelog" ? "changelog" : sourceType === "news_search" ? "news_search" : "news_feed";
  let xml = await readText(url, fetchImpl);
  if (!/<(rss|feed|item|entry)\b/i.test(xml)) {
    const alternate = feedAlternate(xml, url);
    if (!alternate) {
      throw new MonitorCheckError("This page does not expose an RSS or Atom feed. Paste the feed URL. A browser was not used.", true);
    }
    xml = await readText(alternate, fetchImpl);
  }
  const records = parseFeed(xml, url, kind, keywords).slice(0, limit);
  if (records.length === 0) {
    throw new MonitorCheckError(keywords.length > 0 ? "The feed has no items matching the keywords." : "The feed did not contain any items.", true);
  }
  return records;
}

async function readText(url: string, fetchImpl?: FetchLike): Promise<string> {
  const response = fetchImpl
    ? await fetchImpl(url, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html", "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot)" } })
    : await (await import("@/lib/security/url")).fetchWithSafeRedirects(url, {
        headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html", "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot)" },
      });
  if (!response.ok) throw new MonitorCheckError(`HTTP ${response.status} loading source`, response.status >= 500);
  return response.text();
}

function finish(
  adapter: string,
  records: SourceRecord[],
  products: MarketplaceProduct[],
  resultComplete: boolean,
  durationMs: number
): SourceCheckResult {
  recordFetchSample({
    outcome: "success",
    strategy: "http",
    browserLaunches: 0,
    durationMs,
    marketplaceApiCalls: adapter === "etsy" ? 1 : 0,
  });
  return {
    rawHtml: renderRecords(records),
    metadata: {
      captureType: adapter,
      engine: adapter === "shopify" || adapter === "etsy" || adapter === "github-releases" ? "official-api" : "feed",
      fetchStrategy: "http",
      browserLaunched: false,
      browserLaunches: 0,
      durationMs,
      checkStatus: "success",
      requiresBrowser: false,
      provider: adapter,
      adapter,
      resultComplete,
      sourceRecords: records,
      marketplaceProducts: products.length > 0 ? products : undefined,
      recordCount: records.length,
      structured: products.length > 0
        ? {
            title: products[0]?.title ?? undefined,
            prices: products.filter((product) => product.price != null).map((product) => ({
              raw: product.currency ? `${product.price} ${product.currency}` : String(product.price),
              value: product.price,
              currency: product.currency,
            })),
            availability: products[0]?.availability ?? "unknown",
            items: products.map((product) => ({
              key: product.productId,
              title: product.title ?? product.productId,
              url: product.url ?? undefined,
              price: product.price,
            })),
            listingsFound: true,
          }
        : undefined,
    },
  };
}
