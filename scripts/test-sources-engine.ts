/**
 * Mocked tests for news, release, Shopify, and Etsy source adapters.
 * Live API calls are not made.
 *
 * Usage: npx tsx scripts/test-sources-engine.ts
 */
import { MonitoringMode } from "@prisma/client";
import { compareSnapshots } from "../src/lib/monitoring/compare";
import { describeSource } from "../src/lib/monitoring/sources/describe";
import { parseFeed } from "../src/lib/monitoring/sources/feeds";
import type { SourceRecord } from "../src/lib/monitoring/sources/types";
import { runSourceCheck } from "../src/lib/monitoring/sources/registry";

type Case = { name: string; ok: boolean; detail: string };
const results: Case[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function xmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/xml" } });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const feed = `<?xml version="1.0"?>
<rss><channel><title>Daily</title>
<item><title>Alpha story</title><link>https://news.example/a?utm_source=rss</link><guid>alpha</guid><description>First text</description><pubDate>Mon, 01 Nov 2026 00:00:00 GMT</pubDate><category>World</category></item>
<item><title>Beta story</title><link>https://news.example/b</link><guid>beta</guid><description>Second</description></item>
</channel></rss>`;

async function main() {
  const parsed = parseFeed(feed, "https://news.example/rss", "news_feed");
  record("rss items and stable ids", parsed.length === 2 && parsed[0]?.id === "alpha" && parsed[0]?.tags.includes("World") === true, `count=${parsed.length}`);

  const filtered = parseFeed(feed, "https://news.example/rss", "news_search", ["beta"]);
  record("news keyword filter", filtered.length === 1 && filtered[0]?.id === "beta", filtered.map((item) => item.id).join(","));

  const first = await runSourceCheck("https://news.example/rss", { fetchImpl: async () => xmlResponse(feed), limits: { maxApiCalls: 2, maxResults: 10 } });
  const secondXml = feed.replace("First text", "Updated text").replace(/<item><title>Beta[\s\S]*<\/item>/, "");
  const second = await runSourceCheck("https://news.example/rss", { fetchImpl: async () => xmlResponse(secondXml), limits: { maxApiCalls: 2, maxResults: 10 } });
  const newsDiff = compareSnapshots({
    monitorId: "news",
    mode: MonitoringMode.ENTIRE_PAGE,
    previousHash: "a",
    previousText: "old",
    previousMetadata: first?.metadata ?? null,
    current: {
      rawHtml: second?.rawHtml ?? "",
      cleanedHtml: second?.rawHtml ?? "",
      extractedText: second?.rawHtml ?? "",
      contentHash: "b",
      metadata: second?.metadata ?? {},
    },
  });
  const lines = newsDiff.summaryLines ?? [];
  record(
    "new and updated articles, feed drop is not deletion",
    lines.some((line) => line.includes("Article updated")) && !lines.some((line) => line.startsWith("Removed")),
    lines.join("; ") || newsDiff.reason
  );

  const sitemap = `<?xml version="1.0"?><urlset><url><loc>https://news.example/a</loc><news:title>Alpha</news:title><news:publication_date>2026-11-01</news:publication_date><news:name>Daily</news:name></url></urlset>`;
  const site = await runSourceCheck("https://news.example/news-sitemap.xml", { fetchImpl: async () => xmlResponse(sitemap) });
  const siteRecords = (site?.metadata.sourceRecords ?? []) as SourceRecord[];
  record("news sitemap", siteRecords[0]?.title === "Alpha" && siteRecords[0]?.publisher === "Daily", siteRecords[0]?.title ?? "none");

  const articleHtml = `<html><head><title>Old</title><link rel="canonical" href="https://news.example/a"><meta property="article:published_time" content="2026-11-01"></head><body><article><p>${"The council approved the bridge plan. ".repeat(5)}</p></article></body></html>`;
  const articleNext = articleHtml.replace("<title>Old</title>", "<title>New headline</title>");
  const articleA = await runSourceCheck("https://news.example/a", { sourceType: "news_article", fetchImpl: async () => xmlResponse(articleHtml, 200) });
  const articleB = await runSourceCheck("https://news.example/a", { sourceType: "news_article", fetchImpl: async () => xmlResponse(articleNext, 200) });
  const articleDiff = compareSnapshots({
    monitorId: "article",
    mode: MonitoringMode.ENTIRE_PAGE,
    previousHash: "a",
    previousText: "old",
    previousMetadata: articleA?.metadata ?? null,
    current: { rawHtml: "", cleanedHtml: "", extractedText: "", contentHash: "b", metadata: articleB?.metadata ?? {} },
  });
  record("updated article headline", (articleDiff.summaryLines ?? []).some((line) => line.includes("New headline")), (articleDiff.summaryLines ?? [articleDiff.reason]).join("; "));

  const releases = await runSourceCheck("https://github.com/example/app/releases", {
    fetchImpl: async () => jsonResponse([{ tag_name: "v2.0.0", name: "Two", body: "Adds export", html_url: "https://github.com/example/app/releases/tag/v2.0.0" }]),
  });
  const releaseRecords = (releases?.metadata.sourceRecords ?? []) as SourceRecord[];
  const previousRelease: SourceRecord = { ...releaseRecords[0], id: "v1.0.0", version: "v1.0.0", title: "One", fingerprint: "old" };
  const releaseDiff = compareSnapshots({
    monitorId: "rel",
    mode: MonitoringMode.ENTIRE_PAGE,
    previousHash: "a",
    previousText: "old",
    previousMetadata: { sourceRecords: [previousRelease], resultComplete: false },
    current: { rawHtml: "", cleanedHtml: "", extractedText: "", contentHash: "b", metadata: releases?.metadata ?? {} },
  });
  record(
    "new software release is not a deletion of the previous tag",
    (releaseDiff.summaryLines ?? []).some((line) => line.includes("v2.0.0")) && !(releaseDiff.summaryLines ?? []).some((line) => line.startsWith("Removed")),
    (releaseDiff.summaryLines ?? []).join("; ")
  );

  let shopCalls = 0;
  const shop = await runSourceCheck("https://demo.myshopify.com/products.json", {
    limits: { maxApiCalls: 2, maxResults: 10 },
    fetchImpl: async () => {
      shopCalls += 1;
      return jsonResponse({
        products: [
          { id: 10, title: "Mug", handle: "mug", vendor: "Shop", variants: [{ price: "12.00", title: "Blue", available: true }], images: [{ src: "https://cdn.shopify.com/mug.jpg" }] },
          { id: 11, title: "Cup", handle: "cup", vendor: "Shop", variants: [{ price: "8.00", title: "Default Title", available: false }] },
        ],
      });
    },
  });
  const shopProducts = (shop?.metadata.marketplaceProducts ?? []) as Array<{ productId: string; price: number; availability: string; url: string }>;
  record(
    "shopify catalog price and availability",
    shopCalls === 1 && shopProducts[0]?.price === 12 && shopProducts[0]?.availability === "in_stock" && shopProducts[1]?.availability === "out_of_stock" && !shopProducts[0]?.url.includes("utm"),
    `${shopProducts[0]?.price} ${shopProducts[1]?.availability}`
  );

  const shopLess = {
    ...shop?.metadata,
    marketplaceProducts: [shopProducts[0]],
    resultComplete: false,
  };
  const omission = compareSnapshots({
    monitorId: "shop",
    mode: MonitoringMode.ENTIRE_PAGE,
    previousHash: "a",
    previousText: "old",
    previousMetadata: shop?.metadata ?? null,
    current: { rawHtml: "", cleanedHtml: "", extractedText: "", contentHash: "b", metadata: shopLess },
  });
  record(
    "incomplete catalog does not confirm deletion",
    !(omission.summaryLines ?? []).some((line) => line.startsWith("Removed")),
    (omission.summaryLines ?? [omission.reason]).join("; ")
  );

  delete process.env.ETSY_API_KEY;
  let etsyCalls = 0;
  const etsyMissing = await expectThrow(() =>
    runSourceCheck("https://www.etsy.com/listing/12345/mug", {
      fetchImpl: async () => {
        etsyCalls += 1;
        return jsonResponse({});
      },
    })
  );
  record("etsy without credentials does not fetch", etsyCalls === 0 && /awaiting ETSY_API_KEY/i.test(etsyMissing), etsyMissing.slice(0, 120));

  process.env.ETSY_API_KEY = "test-key";
  const etsy = await runSourceCheck("https://www.etsy.com/listing/12345/mug", {
    fetchImpl: async () => jsonResponse({ listing_id: 12345, title: "Mug", description: "Clay", price: { amount: 2500, divisor: 100, currency_code: "EUR" }, quantity: 3, state: "active", url: "https://www.etsy.com/listing/12345/mug?ref=x" }),
  });
  const etsyProduct = ((etsy?.metadata.marketplaceProducts ?? []) as Array<{ price: number; currency: string; productId: string; url: string }>)[0];
  record("etsy listing price and currency", etsyProduct?.price === 25 && etsyProduct.currency === "EUR" && etsyProduct.productId === "12345" && !etsyProduct.url.includes("ref="), `${etsyProduct?.price} ${etsyProduct?.currency}`);
  delete process.env.ETSY_API_KEY;

  let temuCalls = 0;
  const temu = await runSourceCheck("https://www.temu.com/product/1.html", {
    fetchImpl: async () => {
      temuCalls += 1;
      return jsonResponse({});
    },
  });
  record(
    "public storefront is fetched by the page monitor, not a private API",
    temu === null && temuCalls === 0 && describeSource("https://www.temu.com/product/1.html").label === "Temu",
    describeSource("https://www.temu.com/product/1.html").label
  );

  const quota = await expectThrow(() =>
    runSourceCheck("https://www.etsy.com/listing/12345/mug", {
      fetchImpl: async () => jsonResponse({ message: "slow down" }, 429),
    })
  );
  process.env.ETSY_API_KEY = "test-key";
  const quotaWithKey = await expectThrow(() =>
    runSourceCheck("https://www.etsy.com/listing/12345/mug", {
      fetchImpl: async () => jsonResponse({ message: "slow down" }, 429),
    })
  );
  delete process.env.ETSY_API_KEY;
  record("etsy quota error", /quota exceeded/i.test(quotaWithKey), quotaWithKey.slice(0, 100));
  void quota;

  const invalid = await expectThrow(() =>
    runSourceCheck("https://demo.myshopify.com/products.json", {
      fetchImpl: async () => xmlResponse("not-json"),
    })
  );
  record("invalid catalog response", invalid.length > 0, invalid.slice(0, 100));

  const ordinary = await runSourceCheck("https://example.com/docs", { sourceType: "webpage" });
  record("ordinary webpage stays with Scrapling", ordinary === null && describeSource("https://example.com").adapter === "scrapling", describeSource("https://example.com").label);

  const failed = await expectThrow(() => runSourceCheck("https://news.example/rss", { fetchImpl: async () => xmlResponse("down", 500) }));
  record("failed feed does not return a snapshot", /HTTP 500/i.test(failed), failed.slice(0, 80));

  const support = describeSource("https://www.otto.de/product/1");
  record("otto opens as a public storefront", support.support === "webpage" && support.label === "Otto", support.detail.slice(0, 80));

  const passed = results.filter((item) => item.ok).length;
  console.log(`\n${passed}/${results.length} source assertions passed. No live marketplace calls were made.`);
  if (results.some((item) => !item.ok)) process.exitCode = 1;
}

async function expectThrow(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
