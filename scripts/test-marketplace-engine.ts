/**
 * Marketplace connector tests. API responses are mocked.
 * A live call is attempted only when credentials are already in the environment.
 *
 * Usage: npx tsx scripts/test-marketplace-engine.ts
 */
import { MonitoringMode } from "@prisma/client";
import { compareSnapshots } from "../src/lib/monitoring/compare";
import { containsAntiBotChallenge } from "../src/lib/monitoring/compatibility";
import { classifyMonitoringError } from "../src/lib/monitoring/error-messages";
import { withDomainTurn } from "../src/lib/monitoring/fetch-budget";
import { createAmazonClient, normalizeAmazonItem } from "../src/lib/monitoring/marketplace/amazon-creators";
import { compareMarketplaceProducts } from "../src/lib/monitoring/marketplace/compare-products";
import { createEbayClient, normalizeEbayItem } from "../src/lib/monitoring/marketplace/ebay-browse";
import { clearMarketplaceTokenCaches, marketplaceForUrl, runMarketplaceCheck } from "../src/lib/monitoring/marketplace/registry";
import type { MarketplaceProduct } from "../src/lib/monitoring/marketplace/types";
import { getPlanEntitlements } from "../src/lib/plan-features";
import { Plan } from "@prisma/client";

type CaseResult = { name: string; ok: boolean; detail: string };
const results: CaseResult[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}

const amazonCredentials = {
  credentialId: "test-credential",
  credentialSecret: "test-secret",
  partnerTag: "watch-21",
  version: "3.2",
  marketplace: "www.amazon.de",
};

const ebayCredentials = {
  clientId: "ebay-client",
  clientSecret: "ebay-secret",
  environment: "sandbox" as const,
  marketplaceId: "EBAY_DE",
};

function amazonItem(asin: string, price: number, availability = "IN_STOCK") {
  return {
    asin,
    detailPageURL: `https://www.amazon.de/dp/${asin}?tag=watch-21&linkCode=ogi`,
    itemInfo: {
      title: { displayValue: `Product ${asin}` },
      features: { displayValues: ["A feature"] },
    },
    images: { primary: { medium: { url: `https://m.media-amazon.com/images/${asin}.jpg` } } },
    offersV2: {
      listings: [
        {
          isBuyBoxWinner: true,
          price: { money: { amount: price, currency: "EUR" } },
          availability: { type: availability },
          merchantInfo: { name: "Amazon" },
        },
      ],
    },
  };
}

function tokenOk() {
  return jsonResponse(200, { access_token: "token-1", expires_in: 3600, token_type: "bearer" });
}

async function main() {
  clearMarketplaceTokenCaches();
  const saved = {
    amazonId: process.env.AMAZON_CREATORS_CREDENTIAL_ID,
    amazonSecret: process.env.AMAZON_CREATORS_CREDENTIAL_SECRET,
    amazonTag: process.env.AMAZON_ASSOCIATES_PARTNER_TAG,
    paapi: process.env.AMAZON_PAAPI_ACCESS_KEY,
    ebayId: process.env.EBAY_CLIENT_ID,
    ebaySecret: process.env.EBAY_CLIENT_SECRET,
  };
  delete process.env.AMAZON_CREATORS_CREDENTIAL_ID;
  delete process.env.AMAZON_CREATORS_CREDENTIAL_SECRET;
  delete process.env.AMAZON_ASSOCIATES_PARTNER_TAG;
  delete process.env.EBAY_CLIENT_ID;
  delete process.env.EBAY_CLIENT_SECRET;
  process.env.AMAZON_PAAPI_ACCESS_KEY = "old-key";

  try {
    let requests: string[] = [];
    const missing = await expectThrow(() =>
      runMarketplaceCheck("https://www.amazon.de/dp/B0TESTAS01", { fetchImpl: async (input) => {
        requests.push(String(input));
        return tokenOk();
      } })
    );
    record(
      "amazon credential failure",
      missing.includes("awaiting credentials") && requests.length === 0 && classifyMonitoringError(missing).kind === "AUTH_REQUIRED",
      missing.slice(0, 140)
    );

    process.env.AMAZON_CREATORS_CREDENTIAL_ID = amazonCredentials.credentialId;
    process.env.AMAZON_CREATORS_CREDENTIAL_SECRET = amazonCredentials.credentialSecret;
    process.env.AMAZON_ASSOCIATES_PARTNER_TAG = amazonCredentials.partnerTag;
    process.env.AMAZON_CREATORS_VERSION = amazonCredentials.version;
    process.env.AMAZON_MARKETPLACE = amazonCredentials.marketplace;
    process.env.EBAY_CLIENT_ID = ebayCredentials.clientId;
    process.env.EBAY_CLIENT_SECRET = ebayCredentials.clientSecret;
    process.env.EBAY_ENVIRONMENT = ebayCredentials.environment;
    process.env.EBAY_MARKETPLACE_ID = ebayCredentials.marketplaceId;

    clearMarketplaceTokenCaches();
    requests = [];
    const bodies: string[] = [];
    const search = await runMarketplaceCheck("https://www.amazon.de/s?k=samsung%20galaxy&high-price=500", {
      limits: { maxApiCalls: 4, maxResults: 10 },
      fetchImpl: async (input, init) => {
        requests.push(String(input));
        bodies.push(String(init?.body ?? ""));
        if (String(input).includes("/auth/o2/token")) return tokenOk();
        return jsonResponse(200, {
          searchResult: {
            items: [
              amazonItem("B0TESTAS01", 499),
              { ...amazonItem("B0TESTAS01", 499), detailPageURL: "https://www.amazon.de/dp/B0TESTAS01?tag=other" },
              amazonItem("B0TESTAS02", 450),
            ],
          },
        });
      },
    });
    const products = (search?.metadata.marketplaceProducts ?? []) as MarketplaceProduct[];
    const searchBody = JSON.parse(bodies.find((body) => body.includes("keywords")) ?? "{}") as { maxPrice?: number; keywords?: string; marketplace?: string };
    record(
      "amazon product search",
      products.length === 2 &&
        products[0]?.marketplace === "amazon_de" &&
        searchBody.keywords === "samsung galaxy" &&
        searchBody.maxPrice === 50000 &&
        searchBody.marketplace === "www.amazon.de" &&
        requests.some((url) => url.includes("api.amazon.co.uk/auth/o2/token")),
      `products=${products.length} maxPrice=${searchBody.maxPrice}`
    );

    clearMarketplaceTokenCaches();
    const details = await runMarketplaceCheck("https://www.amazon.de/dp/B0TESTAS01", {
      limits: { maxApiCalls: 3, maxResults: 1 },
      fetchImpl: async (input) => {
        if (String(input).includes("/auth/o2/token")) return tokenOk();
        return jsonResponse(200, { itemResults: { items: [amazonItem("B0TESTAS01", 49.99)] } });
      },
    });
    const detail = ((details?.metadata.marketplaceProducts ?? []) as MarketplaceProduct[])[0];
    record(
      "amazon product details",
      detail?.productId === "B0TESTAS01" &&
        detail.title === "Product B0TESTAS01" &&
        detail.price === 49.99 &&
        detail.currency === "EUR" &&
        detail.availability === "in_stock" &&
        detail.seller === "Amazon" &&
        detail.imageUrl?.includes("B0TESTAS01") === true &&
        !detail.url?.includes("tag="),
      `${detail?.price} ${detail?.currency} ${detail?.availability}`
    );

    const priced = normalizeAmazonItem(amazonItem("B0TESTAS01", 39.99, "OUT_OF_STOCK"), "www.amazon.de");
    record(
      "amazon price and availability extraction",
      priced?.price === 39.99 && priced.availability === "out_of_stock" && priced.currency === "EUR",
      `${priced?.price} ${priced?.availability}`
    );

    clearMarketplaceTokenCaches();
    const auth = await expectThrow(() =>
      createAmazonClient({
        credentials: amazonCredentials,
        maxCalls: 2,
        fetchImpl: async () => jsonResponse(401, { message: "Unauthorized" }),
      }).getItems(["B0TESTAS01"])
    );
    record("amazon authentication error", /authentication failed/i.test(auth), auth.slice(0, 140));

    clearMarketplaceTokenCaches();
    let quotaCalls = 0;
    const quota = await expectThrow(() =>
      createAmazonClient({
        credentials: amazonCredentials,
        maxCalls: 6,
        fetchImpl: async (input) => {
          quotaCalls += 1;
          if (String(input).includes("/auth/o2/token")) return tokenOk();
          return jsonResponse(429, { message: "Too Many Requests" });
        },
      }).getItems(["B0TESTAS01"])
    );
    record(
      "amazon rate limit",
      /quota exceeded/i.test(quota) && quotaCalls >= 2 && classifyMonitoringError(quota).kind === "QUOTA_EXCEEDED",
      quota.slice(0, 120)
    );

    clearMarketplaceTokenCaches();
    const invalid = await expectThrow(() =>
      createAmazonClient({
        credentials: amazonCredentials,
        maxCalls: 3,
        fetchImpl: async (input) => (String(input).includes("/auth/o2/token") ? textResponse(200, "not-json") : tokenOk()),
      }).getItems(["B0TESTAS01"])
    );
    record("invalid api response", /not valid JSON/i.test(invalid), invalid.slice(0, 120));

    clearMarketplaceTokenCaches();
    const ebayRequests: string[] = [];
    const ebaySearch = await runMarketplaceCheck("https://www.ebay.de/sch/i.html?_nkw=graphics%20card&_udhi=500&_sacat=27386", {
      limits: { maxApiCalls: 4, maxResults: 10 },
      fetchImpl: async (input) => {
        ebayRequests.push(String(input));
        if (String(input).includes("/oauth2/token")) return tokenOk();
        return jsonResponse(200, {
          total: 1,
          itemSummaries: [
            {
              itemId: "v1|1234567890|0",
              legacyItemId: "1234567890",
              title: "Graphics card",
              itemWebUrl: "https://www.ebay.de/itm/1234567890?_trkparms=abc",
              price: { value: "499.00", currency: "EUR" },
              seller: { username: "shop-a" },
              image: { imageUrl: "https://i.ebayimg.com/images/card.jpg" },
              itemEndDate: "2026-12-01T00:00:00.000Z",
            },
          ],
        });
      },
    });
    const ebayProducts = (ebaySearch?.metadata.marketplaceProducts ?? []) as MarketplaceProduct[];
    record(
      "ebay product search",
      ebayProducts.length === 1 &&
        ebayProducts[0]?.productId === "v1|1234567890|0" &&
        ebayProducts[0]?.price === 499 &&
        ebayProducts[0]?.currency === "EUR" &&
        ebayRequests.some((url) => url.includes("api.sandbox.ebay.com")) &&
        ebayRequests.some((url) => url.includes("category_ids=27386")) &&
        !ebayProducts[0]?.url?.includes("_trkparms"),
      `${ebayProducts[0]?.title} ${ebayProducts[0]?.price}`
    );

    clearMarketplaceTokenCaches();
    const listing = await runMarketplaceCheck("https://www.ebay.de/itm/Some-Title/1234567890", {
      limits: { maxApiCalls: 4, maxResults: 1 },
      fetchImpl: async (input) => {
        if (String(input).includes("/oauth2/token")) return tokenOk();
        return jsonResponse(200, {
          itemId: "v1|1234567890|0",
          title: "Graphics card",
          price: { value: "450.00", currency: "EUR" },
          seller: { username: "shop-b" },
          estimatedAvailabilities: [{ estimatedAvailabilityStatus: "IN_STOCK" }],
          localizedAspects: [{ name: "Brand", value: "Example" }],
          itemEndDate: "2026-12-01T00:00:00.000Z",
        });
      },
    });
    const listingProduct = ((listing?.metadata.marketplaceProducts ?? []) as MarketplaceProduct[])[0];
    record(
      "ebay listing retrieval",
      listingProduct?.availability === "in_stock" &&
        listingProduct.seller === "shop-b" &&
        listingProduct.variant === "Brand: Example" &&
        listingProduct.expiresAt === "2026-12-01T00:00:00.000Z",
      `${listingProduct?.seller} ${listingProduct?.variant}`
    );

    const before = normalizeEbayItem(
      { itemId: "v1|1234567890|0", title: "Graphics card", price: { value: "499.00", currency: "EUR" }, seller: { username: "shop-a" } },
      "EBAY_DE"
    )!;
    const after = { ...before, price: 450 };
    const priceDiff = compareMarketplaceProducts([before], [after]);
    record(
      "ebay price change",
      priceDiff?.changed === true && (priceDiff.summaryLines[0] ?? "").includes("450"),
      priceDiff?.summaryLines.join("; ") ?? "none"
    );

    const discovered = compareMarketplaceProducts(
      [{ ...before, productId: "v1|1|0", title: "Old GPU" }],
      [
        { ...before, productId: "v1|1|0", title: "Old GPU" },
        { ...before, productId: "v1|2|0", title: "New GPU" },
      ]
    );
    record(
      "new product discovery",
      (discovered?.summaryLines ?? []).some((line) => line.includes("New GPU")),
      discovered?.summaryLines.join("; ") ?? "none"
    );

    const removed = compareMarketplaceProducts(
      [before, { ...before, productId: "v1|2|0", title: "Gone GPU" }],
      [before]
    );
    record(
      "product removal",
      (removed?.summaryLines ?? []).some((line) => line.includes("Gone GPU")),
      removed?.summaryLines.join("; ") ?? "none"
    );

    const duplicate = normalizeAmazonItem({ ...amazonItem("B0TESTAS01", 10), asin: "b0testas01" }, "www.amazon.de");
    const duplicateAgain = normalizeAmazonItem(
      { ...amazonItem("B0TESTAS01", 10), detailPageURL: "https://www.amazon.de/dp/B0TESTAS01?ref=abc" },
      "www.amazon.de"
    );
    const duplicateDiff = compareMarketplaceProducts(
      duplicate ? [duplicate] : [],
      duplicateAgain ? [duplicateAgain] : []
    );
    record(
      "duplicate product detection",
      duplicate?.productId === "B0TESTAS01" && duplicateDiff?.changed === false,
      duplicateDiff?.summaryLines.join("; ") ?? "none"
    );

    const currencyDiff = compareMarketplaceProducts(
      [{ ...before, currency: "EUR", price: 49.99 }],
      [{ ...before, currency: "USD", price: 49.99 }]
    );
    record(
      "currency handling",
      currencyDiff?.changed === true && (currencyDiff.summaryLines[0] ?? "").includes("USD"),
      currencyDiff?.summaryLines.join("; ") ?? "none"
    );

    const unchanged = compareMarketplaceProducts([before], [before]);
    const comparison = compareSnapshots({
      monitorId: "market",
      mode: MonitoringMode.ENTIRE_PAGE,
      previousHash: "previous",
      previousText: "old",
      previousMetadata: { marketplaceProducts: [before] },
      current: {
        rawHtml: "new",
        cleanedHtml: "new",
        extractedText: "new",
        contentHash: "current",
        metadata: { marketplaceProducts: [before] },
      },
    });
    record(
      "snapshot comparison ignores tracking-only differences",
      unchanged?.changed === false && comparison.changed === false,
      comparison.reason
    );

    let replaced = false;
    try {
      await runMarketplaceCheck("https://www.amazon.de/dp/B0TESTAS01", {
        limits: { maxApiCalls: 2, maxResults: 1 },
        fetchImpl: async () => jsonResponse(500, { message: "unavailable" }),
      });
      replaced = true;
    } catch (error) {
      replaced = false;
      record(
        "snapshot preserved after failed check",
        error instanceof Error && /HTTP 500|authentication failed|quota/i.test(error.message),
        error instanceof Error ? error.message.slice(0, 140) : String(error)
      );
    }
    if (replaced) record("snapshot preserved after failed check", false, "failed check returned content");

    const summary = priceDiff?.summaryLines[0] ?? "";
    record(
      "change summary for notifications and AI",
      summary.startsWith("Price changed from"),
      summary
    );

    record(
      "scrapling remains the fallback for ordinary sites",
      marketplaceForUrl(new URL("https://example.com")) === null,
      "example.com is not a marketplace"
    );
    record(
      "blocked page is not treated as success",
      containsAntiBotChallenge("Just a moment... cf-browser-verification"),
      "challenge text detected"
    );

    const free = getPlanEntitlements(Plan.FREE);
    const business = getPlanEntitlements(Plan.BUSINESS);
    record(
      "subscription usage accounting",
      free.marketplaceApiCallsPerCheck === 3 &&
        free.marketplaceSearchItems === 10 &&
        business.marketplaceApiCallsPerCheck === 6 &&
        business.marketplaceSearchItems === 30 &&
        free.maxMonitors === 3,
      `free calls=${free.marketplaceApiCallsPerCheck} business calls=${business.marketplaceApiCallsPerCheck}`
    );

    let active = 0;
    let maxActive = 0;
    await Promise.all(
      [1, 2].map(() =>
        withDomainTurn("EBAY_DE", async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((resolve) => setTimeout(resolve, 30));
          active -= 1;
        })
      )
    );
    record("concurrent marketplace checks stay serialized per marketplace", maxActive === 1, `maxActive=${maxActive}`);

    clearMarketplaceTokenCaches();
    const budget = await expectThrow(() =>
      createEbayClient({
        credentials: ebayCredentials,
        maxCalls: 1,
        fetchImpl: async () => tokenOk(),
      }).search({ kind: "search", marketplace: "EBAY_DE", keywords: "gpu" }, { maxApiCalls: 1, maxResults: 1 })
    );
    record("call budget stops extra requests", /budget/i.test(budget), budget.slice(0, 120));
  } finally {
    restore("AMAZON_CREATORS_CREDENTIAL_ID", saved.amazonId);
    restore("AMAZON_CREATORS_CREDENTIAL_SECRET", saved.amazonSecret);
    restore("AMAZON_ASSOCIATES_PARTNER_TAG", saved.amazonTag);
    restore("AMAZON_PAAPI_ACCESS_KEY", saved.paapi);
    restore("EBAY_CLIENT_ID", saved.ebayId);
    restore("EBAY_CLIENT_SECRET", saved.ebaySecret);
    restore("AMAZON_CREATORS_VERSION", undefined);
    restore("AMAZON_MARKETPLACE", undefined);
    restore("EBAY_ENVIRONMENT", undefined);
    restore("EBAY_MARKETPLACE_ID", undefined);
    clearMarketplaceTokenCaches();
  }

  if (process.env.AMAZON_CREATORS_CREDENTIAL_ID && process.env.AMAZON_CREATORS_CREDENTIAL_SECRET && process.env.AMAZON_ASSOCIATES_PARTNER_TAG) {
    try {
      const live = await runMarketplaceCheck("https://www.amazon.de/s?k=notebook", { limits: { maxApiCalls: 3, maxResults: 1 } });
      const count = Array.isArray(live?.metadata.marketplaceProducts) ? live.metadata.marketplaceProducts.length : 0;
      record("amazon live search", count > 0, `items=${count}`);
    } catch (error) {
      record("amazon live search", false, error instanceof Error ? error.message.slice(0, 160) : String(error));
    }
  } else {
    console.log("SKIP amazon live search — Creators API credentials are not configured");
  }

  if (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET) {
    try {
      const live = await runMarketplaceCheck("https://www.ebay.de/sch/i.html?_nkw=notebook", {
        limits: { maxApiCalls: 3, maxResults: 1 },
      });
      const count = Array.isArray(live?.metadata.marketplaceProducts) ? live.metadata.marketplaceProducts.length : 0;
      record("ebay live search", count > 0, `items=${count}`);
    } catch (error) {
      record("ebay live search", false, error instanceof Error ? error.message.slice(0, 160) : String(error));
    }
  } else {
    console.log("SKIP ebay live search — Browse API credentials are not configured");
  }

  const passed = results.filter((item) => item.ok).length;
  console.log(`\n${passed}/${results.length} marketplace assertions passed`);
  if (results.some((item) => !item.ok)) process.exitCode = 1;
}

function restore(name: string, value: string | undefined) {
  if (value == null) delete process.env[name];
  else process.env[name] = value;
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
