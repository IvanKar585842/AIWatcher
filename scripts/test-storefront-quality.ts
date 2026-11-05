/**
 * Quality sample of public catalogs and a few real storefronts.
 * One or two requests each. A block is recorded, not bypassed.
 *
 * Usage: npx tsx scripts/test-storefront-quality.ts
 */
import { MonitoringMode } from "@prisma/client";
import { installSystemCa } from "../src/lib/security/system-ca";
import { tryOfficialSource } from "../src/lib/monitoring/official-apis";
import { fetchViaScrapling } from "../src/lib/monitoring/scrapling-adapter";
import { shutdownScrapling } from "../src/lib/monitoring/scrapling-client";
import { extractStructuredFields } from "../src/lib/monitoring/structured-compare";

installSystemCa();

const cases = [
  { name: "practice book page", url: "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html", kind: "page" as const, passes: 2 },
  { name: "practice catalog", url: "https://books.toscrape.com/", kind: "page" as const, passes: 1 },
  { name: "public Shopify catalog", url: "https://allbirds.com/products.json", kind: "feed" as const, passes: 1 },
  { name: "Zalando home", url: "https://www.zalando.de/", kind: "page" as const, passes: 1 },
  { name: "Otto home", url: "https://www.otto.de/", kind: "page" as const, passes: 1 },
];

async function main() {
  const rows: Array<Record<string, unknown>> = [];
  for (const item of cases) {
    for (let pass = 1; pass <= item.passes; pass++) {
      const started = Date.now();
      try {
        if (item.kind === "feed") {
          const result = await tryOfficialSource(item.url, 20000, { limits: { maxApiCalls: 2, maxResults: 5 } });
          const products = Array.isArray(result?.metadata.marketplaceProducts) ? result.metadata.marketplaceProducts.length : 0;
          rows.push({
            pass,
            name: item.name,
            ok: Boolean(result),
            ms: Date.now() - started,
            adapter: result?.metadata.adapter ?? null,
            products,
            browser: 0,
          });
          continue;
        }
        const page = await fetchViaScrapling({
          url: item.url,
          mode: MonitoringMode.ENTIRE_PAGE,
          timeoutMs: 25000,
          captureScreenshot: false,
        });
        const structured = extractStructuredFields(page.rawHtml, page.rawHtml.replace(/<[^>]+>/g, " "));
        rows.push({
          pass,
          name: item.name,
          ok: true,
          ms: Date.now() - started,
          strategy: page.metadata.fetchStrategy,
          browser: page.metadata.browserLaunches ?? 0,
          chars: page.rawHtml.length,
          title: structured.title?.slice(0, 80) ?? null,
          price: structured.prices?.[0]?.raw ?? null,
          availability: structured.availability ?? null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 180) : String(error);
        rows.push({
          pass,
          name: item.name,
          ok: false,
          ms: Date.now() - started,
          blocked: /blocked|challenge|captcha|robot|just a moment/i.test(message),
          error: message,
        });
      }
    }
  }
  const ok = rows.filter((row) => row.ok).length;
  console.log(JSON.stringify({ checks: rows.length, ok, failed: rows.length - ok, rows }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => shutdownScrapling());
