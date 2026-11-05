/**
 * Scrapling engine checks against a local fixture server plus a few public pages.
 * Usage: npx tsx scripts/test-scrapling-engine.ts
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { MonitoringMode } from "@prisma/client";
import { compareSnapshots, computeContentHash } from "../src/lib/monitoring/compare";
import { cleanHtml, extractTextFromHtml } from "../src/lib/monitoring/content-cleaner";
import type { FetchResult } from "../src/lib/monitoring/fetcher";
import {
  estimateCostPerThousand,
  getFetchEngineMetrics,
  resetFetchEngineMetrics,
} from "../src/lib/monitoring/fetch-budget";
import { tryOfficialSource } from "../src/lib/monitoring/official-apis";
import { shutdownScrapling } from "../src/lib/monitoring/scrapling-client";
import { fetchViaScrapling, type ScraplingPage } from "../src/lib/monitoring/scrapling-adapter";
import {
  compareStructuredFields,
  type StructuredSnapshot,
} from "../src/lib/monitoring/structured-compare";

process.env.SCRAPLING_ALLOW_TEST_LOOPBACK = "1";

type CaseResult = { name: string; ok: boolean; detail: string; ms: number };

const results: CaseResult[] = [];

function record(name: string, ok: boolean, detail: string, ms: number) {
  results.push({ name, ok, detail, ms });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${detail} (${ms}ms)`);
}

function pageHtml(body: string): string {
  return `<!doctype html><html><head><title>Fixture</title></head><body>${body}</body></html>`;
}

function startFixtureServer(): Promise<{ server: http.Server; origin: string }> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/error") {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("nope");
      return;
    }
    if (url.pathname === "/child") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml("<p>FOLLOWED_CHILD_TOKEN</p>"));
      return;
    }
    if (url.pathname === "/js") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        pageHtml(
          `<div id="root"></div><script>document.getElementById("root").textContent = "RENDERED_TOKEN";</script>`
        )
      );
      return;
    }
    if (url.pathname === "/blocked") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml("<h1>Just a moment...</h1><p>cf-browser-verification</p>"));
      return;
    }
    if (url.pathname === "/partial") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml("<main><p>Some article text that is long enough to be a real page.</p></main>"));
      return;
    }
    if (url.pathname === "/price") {
      const value = url.searchParams.get("v") ?? "10.00";
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml(`<span class="price">$${value}</span>`));
      return;
    }
    if (url.pathname === "/stock") {
      const state = url.searchParams.get("state") ?? "in stock";
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml(`<p class="availability">${state}</p>`));
      return;
    }
    if (url.pathname === "/products") {
      const extra = url.searchParams.get("extra") === "1";
      const cards = [
        `<article class="product"><a href="/p/1">Alpha Widget</a></article>`,
        `<article class="product"><a href="/p/2">Beta Widget</a></article>`,
      ];
      if (extra) cards.push(`<article class="product"><a href="/p/3">Gamma Widget</a></article>`);
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml(cards.join("")));
      return;
    }
    if (url.pathname === "/structure") {
      const heading = url.searchParams.get("v") === "2" ? "Updated heading" : "Original heading";
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml(`<main><h1>${heading}</h1><p>Shared paragraph.</p></main>`));
      return;
    }
    if (url.pathname === "/text") {
      const copy = url.searchParams.get("v") === "2" ? "The policy was revised." : "The policy is stable.";
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml(`<article><p>${copy}</p></article>`));
      return;
    }
    if (url.pathname === "/links") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml(`<a class="more" href="/child">Read notes</a><p>Index page.</p>`));
      return;
    }
    if (url.pathname === "/noise") {
      const stamp = url.searchParams.get("t") ?? "2020-01-01T00:00:00Z";
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        pageHtml(
          `<article><h1>Stable title</h1><p>Stable body copy for comparison.</p><span>${stamp}</span></article>`
        )
      );
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(pageHtml("<h1>Static fixture</h1><p>Hello from a static page.</p>"));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

function toFetchResult(mode: MonitoringMode, page: ScraplingPage): FetchResult {
  const cleanedHtml =
    mode === MonitoringMode.TEXT_CHANGES || mode === MonitoringMode.PRICE_DETECTION
      ? page.rawHtml
      : cleanHtml(page.rawHtml);
  const extractedText =
    mode === MonitoringMode.TEXT_CHANGES || mode === MonitoringMode.PRICE_DETECTION
      ? page.rawHtml
      : extractTextFromHtml(cleanedHtml);
  const partial: FetchResult = {
    rawHtml: page.rawHtml,
    cleanedHtml,
    extractedText,
    contentHash: "",
    metadata: page.metadata,
  };
  partial.contentHash = computeContentHash(mode, partial);
  return partial;
}

async function fetchMode(
  mode: MonitoringMode,
  url: string,
  extra: Partial<Parameters<typeof fetchViaScrapling>[0]> = {}
): Promise<ScraplingPage> {
  return fetchViaScrapling({
    url,
    mode,
    timeoutMs: 30000,
    captureScreenshot: false,
    fetchStrategy: "auto",
    ...extra,
  });
}

async function expectThrow(name: string, fn: () => Promise<unknown>, pattern: RegExp) {
  const started = Date.now();
  try {
    await fn();
    record(name, false, "expected a failure but the check succeeded", Date.now() - started);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    record(name, pattern.test(message), message.slice(0, 180), Date.now() - started);
  }
}

async function main() {
  resetFetchEngineMetrics();

  const priceSame = compareStructuredFields({
    mode: MonitoringMode.PRICE_DETECTION,
    previous: { prices: [{ raw: "$10.00", value: 10, currency: "USD" }] },
    current: { prices: [{ raw: "USD 10.00", value: 10, currency: "USD" }] },
  });
  record(
    "price formatting is not a change",
    priceSame?.decisive === true && priceSame.changed === false,
    priceSame?.summaryLines.join("; ") ?? "no comparison",
    0
  );

  const priceDiff = compareStructuredFields({
    mode: MonitoringMode.PRICE_DETECTION,
    previous: { prices: [{ raw: "$10.00", value: 10, currency: "USD" }] },
    current: { prices: [{ raw: "$12.50", value: 12.5, currency: "USD" }] },
  });
  record(
    "numeric price change",
    priceDiff?.changed === true && (priceDiff.summaryLines[0] ?? "").includes("12.50"),
    priceDiff?.summaryLines.join("; ") ?? "no comparison",
    0
  );

  const stock = compareStructuredFields({
    mode: MonitoringMode.PRODUCT_AVAILABILITY,
    previous: { availability: "in_stock" },
    current: { availability: "out_of_stock" },
  });
  record(
    "availability state change",
    stock?.changed === true,
    stock?.summaryLines.join("; ") ?? "no comparison",
    0
  );

  const listings = compareStructuredFields({
    mode: MonitoringMode.JOB_LISTINGS,
    previous: {
      listingsFound: true,
      items: [
        { key: "/p/1", title: "Alpha Widget" },
        { key: "/p/2", title: "Beta Widget" },
      ],
    },
    current: {
      listingsFound: true,
      items: [
        { key: "/p/1", title: "Alpha Widget" },
        { key: "/p/3", title: "Gamma Widget" },
      ],
    } satisfies StructuredSnapshot,
  });
  record(
    "new and removed listings",
    (listings?.summaryLines ?? []).some((line) => line.includes("Gamma")) &&
      (listings?.summaryLines ?? []).some((line) => line.includes("Beta")),
    listings?.summaryLines.join("; ") ?? "no comparison",
    0
  );

  const { server, origin } = await startFixtureServer();
  try {
    const startedStatic = Date.now();
    const staticPage = await fetchMode(MonitoringMode.ENTIRE_PAGE, `${origin}/static`);
    record(
      "static html",
      staticPage.rawHtml.includes("Static fixture") && staticPage.metadata.fetchStrategy === "http",
      `strategy=${String(staticPage.metadata.fetchStrategy)} browsers=${String(staticPage.metadata.browserLaunches)}`,
      Date.now() - startedStatic
    );

    const jsStarted = Date.now();
    try {
      const jsPage = await fetchMode(MonitoringMode.ENTIRE_PAGE, `${origin}/js`, { timeoutMs: 45000 });
      record(
        "javascript rendered page",
        jsPage.rawHtml.includes("RENDERED_TOKEN"),
        `strategy=${String(jsPage.metadata.fetchStrategy)} browsers=${String(jsPage.metadata.browserLaunches)}`,
        Date.now() - jsStarted
      );
    } catch (error) {
      record(
        "javascript rendered page",
        false,
        error instanceof Error ? error.message.slice(0, 180) : String(error),
        Date.now() - jsStarted
      );
    }

    const textA = toFetchResult(
      MonitoringMode.TEXT_CHANGES,
      await fetchMode(MonitoringMode.TEXT_CHANGES, `${origin}/text?v=1`)
    );
    const textB = toFetchResult(
      MonitoringMode.TEXT_CHANGES,
      await fetchMode(MonitoringMode.TEXT_CHANGES, `${origin}/text?v=2`)
    );
    const textCmp = compareSnapshots({
      monitorId: "text",
      mode: MonitoringMode.TEXT_CHANGES,
      previousHash: textA.contentHash,
      previousText: textA.extractedText,
      current: textB,
    });
    record("changing text", textCmp.changed, textCmp.reason, 0);

    const priceA = toFetchResult(
      MonitoringMode.PRICE_DETECTION,
      await fetchMode(MonitoringMode.PRICE_DETECTION, `${origin}/price?v=10.00`)
    );
    const priceB = toFetchResult(
      MonitoringMode.PRICE_DETECTION,
      await fetchMode(MonitoringMode.PRICE_DETECTION, `${origin}/price?v=12.50`)
    );
    const priceCmp = compareSnapshots({
      monitorId: "price",
      mode: MonitoringMode.PRICE_DETECTION,
      previousHash: priceA.contentHash,
      previousText: priceA.extractedText,
      previousMetadata: priceA.metadata,
      current: priceB,
    });
    record(
      "changing price",
      priceCmp.changed && (priceCmp.summaryLines ?? []).some((line) => /12\.50|12.5/.test(line)),
      (priceCmp.summaryLines ?? [priceCmp.reason]).join("; "),
      0
    );

    const stockA = toFetchResult(
      MonitoringMode.PRODUCT_AVAILABILITY,
      await fetchMode(MonitoringMode.PRODUCT_AVAILABILITY, `${origin}/stock?state=in%20stock`)
    );
    const stockB = toFetchResult(
      MonitoringMode.PRODUCT_AVAILABILITY,
      await fetchMode(MonitoringMode.PRODUCT_AVAILABILITY, `${origin}/stock?state=out%20of%20stock`)
    );
    const stockCmp = compareSnapshots({
      monitorId: "stock",
      mode: MonitoringMode.PRODUCT_AVAILABILITY,
      previousHash: stockA.contentHash,
      previousText: stockA.extractedText,
      previousMetadata: stockA.metadata,
      current: stockB,
    });
    record(
      "changing availability",
      stockCmp.changed,
      (stockCmp.summaryLines ?? [stockCmp.reason]).join("; "),
      0
    );

    const listA = toFetchResult(
      MonitoringMode.JOB_LISTINGS,
      await fetchMode(MonitoringMode.JOB_LISTINGS, `${origin}/products`)
    );
    const listB = toFetchResult(
      MonitoringMode.JOB_LISTINGS,
      await fetchMode(MonitoringMode.JOB_LISTINGS, `${origin}/products?extra=1`)
    );
    const listCmp = compareSnapshots({
      monitorId: "listings",
      mode: MonitoringMode.JOB_LISTINGS,
      previousHash: listA.contentHash,
      previousText: listA.extractedText,
      previousMetadata: listA.metadata,
      current: listB,
    });
    record(
      "new product listing",
      listCmp.changed && (listCmp.summaryLines ?? []).some((line) => line.includes("Gamma")),
      (listCmp.summaryLines ?? [listCmp.reason]).join("; "),
      0
    );

    const structA = toFetchResult(
      MonitoringMode.ENTIRE_PAGE,
      await fetchMode(MonitoringMode.ENTIRE_PAGE, `${origin}/structure?v=1`)
    );
    const structB = toFetchResult(
      MonitoringMode.ENTIRE_PAGE,
      await fetchMode(MonitoringMode.ENTIRE_PAGE, `${origin}/structure?v=2`)
    );
    const structCmp = compareSnapshots({
      monitorId: "structure",
      mode: MonitoringMode.ENTIRE_PAGE,
      previousHash: structA.contentHash,
      previousText: structA.extractedText,
      previousCleanedHtml: structA.cleanedHtml,
      previousMetadata: structA.metadata,
      current: structB,
    });
    record("modified html structure", structCmp.changed, structCmp.reason, 0);

    const linked = await fetchMode(MonitoringMode.ENTIRE_PAGE, `${origin}/links`, {
      followLinkSelectors: "a.more",
    });
    record(
      "follow configured links",
      linked.rawHtml.includes("FOLLOWED_CHILD_TOKEN"),
      linked.rawHtml.includes("FOLLOWED_CHILD_TOKEN") ? "child content included" : "child content missing",
      0
    );

    await expectThrow("http error", () => fetchMode(MonitoringMode.ENTIRE_PAGE, `${origin}/error`), /HTTP 500/);
    await expectThrow(
      "blocked automated access",
      () => fetchMode(MonitoringMode.ENTIRE_PAGE, `${origin}/blocked`),
      /anti-bot|challenge|HTTP 403/i
    );
    await expectThrow(
      "partial extraction",
      () =>
        fetchMode(MonitoringMode.CSS_SELECTOR, `${origin}/partial`, {
          selector: "#does-not-exist",
        }),
      /selector not found|partial/i
    );

    const stableA = toFetchResult(
      MonitoringMode.ENTIRE_PAGE,
      await fetchMode(MonitoringMode.ENTIRE_PAGE, `${origin}/noise?t=2020-01-01T00:00:00Z`)
    );
    const stableB = toFetchResult(
      MonitoringMode.ENTIRE_PAGE,
      await fetchMode(MonitoringMode.ENTIRE_PAGE, `${origin}/noise?t=2024-05-05T12:00:00Z`)
    );
    const stableCmp = compareSnapshots({
      monitorId: "stable",
      mode: MonitoringMode.ENTIRE_PAGE,
      previousHash: stableA.contentHash,
      previousText: stableA.extractedText,
      previousCleanedHtml: stableA.cleanedHtml,
      previousMetadata: stableA.metadata,
      current: stableB,
    });
    record(
      "repeated check with timestamp noise",
      stableCmp.changed === false,
      stableCmp.reason,
      0
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const publicCases: Array<{ name: string; run: () => Promise<string> }> = [
    {
      name: "public example.com",
      run: async () => {
        const page = await fetchViaScrapling({
          url: "https://example.com",
          mode: MonitoringMode.ENTIRE_PAGE,
          timeoutMs: 20000,
          captureScreenshot: false,
        });
        return `strategy=${String(page.metadata.fetchStrategy)} status=${String(page.metadata.httpStatus)}`;
      },
    },
    {
      name: "public iana reserved domains",
      run: async () => {
        const page = await fetchViaScrapling({
          url: "https://www.iana.org/help/example-domains",
          mode: MonitoringMode.ENTIRE_PAGE,
          timeoutMs: 20000,
          captureScreenshot: false,
        });
        return `strategy=${String(page.metadata.fetchStrategy)} chars=${page.rawHtml.length}`;
      },
    },
    {
      name: "github releases via official api",
      run: async () => {
        const page = await tryOfficialSource("https://github.com/nodejs/node/releases", 20000);
        if (!page) throw new Error("GitHub releases were not routed to the API");
        return `provider=${String(page.metadata.provider)} chars=${page.rawHtml.length}`;
      },
    },
    {
      name: "amazon without api credentials",
      run: async () => {
        try {
          await tryOfficialSource("https://www.amazon.com/dp/B0BDHWDR12", 15000);
          throw new Error("Amazon URL was fetched instead of being refused");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!/Product Advertising API|not fetched with a browser/i.test(message)) throw error;
          return message.slice(0, 140);
        }
      },
    },
  ];

  for (const item of publicCases) {
    const started = Date.now();
    try {
      const detail = await item.run();
      record(item.name, true, detail, Date.now() - started);
    } catch (error) {
      record(
        item.name,
        false,
        error instanceof Error ? error.message.slice(0, 180) : String(error),
        Date.now() - started
      );
    }
  }

  const metrics = getFetchEngineMetrics();
  const cost = estimateCostPerThousand();
  const local = results.filter((item) => !item.name.startsWith("public") && item.name !== "github releases via official api" && item.name !== "amazon without api credentials");
  const passed = results.filter((item) => item.ok).length;
  console.log("\nMetrics");
  console.log(JSON.stringify({ ...metrics, ...cost, passed, total: results.length }, null, 2));
  console.log(
    `Controlled cases ${local.filter((item) => item.ok).length}/${local.length}. ` +
      `External API cost per 1,000 checks: $${cost.externalApiUsd.toFixed(2)}. ` +
      `Browser launches per recorded check: ${cost.browserLaunchesPerCheck.toFixed(2)}.`
  );

  const controlledFailed = local.some((item) => !item.ok);
  if (controlledFailed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    shutdownScrapling();
  });
