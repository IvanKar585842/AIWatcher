/**
 * A small live corpus of public pages. One request each.
 * Results are measurements, not a reliability claim.
 *
 * Usage: npx tsx scripts/test-live-public.ts
 */
import { useSystemCa } from "../src/lib/security/system-ca";
import { MonitoringMode } from "@prisma/client";
import { tryOfficialSource } from "../src/lib/monitoring/official-apis";
import { fetchViaScrapling } from "../src/lib/monitoring/scrapling-adapter";
import { shutdownScrapling } from "../src/lib/monitoring/scrapling-client";

useSystemCa();

const cases = [
  { name: "example.com static", url: "https://example.com", kind: "page" as const },
  { name: "RFC 2606 public text", url: "https://www.rfc-editor.org/rfc/rfc2606", kind: "page" as const },
  { name: "MDN HTML docs", url: "https://developer.mozilla.org/en-US/docs/Web/HTML", kind: "page" as const },
  { name: "React docs", url: "https://react.dev/", kind: "page" as const },
  { name: "BBC news RSS", url: "https://feeds.bbci.co.uk/news/rss.xml", kind: "feed" as const },
  { name: "GitHub node releases", url: "https://github.com/nodejs/node/releases", kind: "feed" as const },
];

const passes = 2;

async function main() {
  const rows: Array<Record<string, unknown>> = [];
  for (let pass = 1; pass <= passes; pass++) {
    for (const item of cases) {
      const started = Date.now();
      try {
        if (item.kind === "feed") {
          const result = await tryOfficialSource(item.url, 20000, { limits: { maxApiCalls: 2, maxResults: 5 } });
          rows.push({
            pass,
            name: item.name,
            ok: Boolean(result),
            ms: Date.now() - started,
            adapter: result?.metadata.adapter ?? result?.metadata.provider ?? null,
            records: result?.metadata.recordCount ?? null,
            browser: 0,
          });
        } else {
          const page = await fetchViaScrapling({
            url: item.url,
            mode: MonitoringMode.ENTIRE_PAGE,
            timeoutMs: 25000,
            captureScreenshot: false,
          });
          rows.push({
            pass,
            name: item.name,
            ok: true,
            ms: Date.now() - started,
            strategy: page.metadata.fetchStrategy,
            browser: page.metadata.browserLaunches ?? 0,
            chars: page.rawHtml.length,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 180) : String(error);
        rows.push({
          pass,
          name: item.name,
          ok: false,
          ms: Date.now() - started,
          blocked: /blocked|challenge|captcha|robot/i.test(message),
          error: message,
        });
      }
    }
  }
  const ok = rows.filter((row) => row.ok).length;
  const browsers = rows.reduce((sum, row) => sum + Number(row.browser ?? 0), 0);
  console.log(JSON.stringify({ checks: rows.length, ok, failed: rows.length - ok, browsers, rows }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => shutdownScrapling());
