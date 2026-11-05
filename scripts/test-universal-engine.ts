/**
 * Fixture tests for the universal page-change profile.
 * These do not prove that every public website can be monitored.
 *
 * Usage: npx tsx scripts/test-universal-engine.ts
 */
import { MonitoringMode } from "@prisma/client";
import { compareSnapshots } from "../src/lib/monitoring/compare";
import { classifyMonitoringError } from "../src/lib/monitoring/error-messages";
import { comparePageProfiles, extractPageProfile, normalizeUrl } from "../src/lib/monitoring/page-profile";
import { compareVisualFingerprints } from "../src/lib/monitoring/visual-compare";
import { getPlanEntitlements } from "../src/lib/plan-features";
import { Plan } from "@prisma/client";

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function page(body: string, head = ""): string {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

function diff(before: string, after: string, scope: "page" | "links" | "images" | "numbers" | "tables" | "structured" | "keyword" = "page", keywords: string[] = []) {
  return comparePageProfiles(extractPageProfile(before, before), extractPageProfile(after, after), scope, keywords);
}

async function main() {
  const added = diff(page("<p>The office opens at nine.</p>"), page("<p>The office opens at nine.</p><p>A new deadline is Friday.</p>"));
  record("text addition", added?.changed === true && (added.summaryLines[0] ?? "").includes("deadline"), added?.summaryLines.join("; ") ?? "none");

  const removed = diff(page("<p>The temporary banner is visible today.</p><p>Stable paragraph stays here.</p>"), page("<p>Stable paragraph stays here.</p>"));
  record("text removal", removed?.changed === true, removed?.summaryLines.join("; ") ?? "none");

  const edited = diff(page("<p>The bridge opens in March.</p>"), page("<p>The bridge opens in April.</p>"));
  record("paragraph modification", edited?.changed === true, edited?.summaryLines.join("; ") ?? "none");

  const heading = diff(page("<h1>Old title</h1><p>Same supporting paragraph for the page.</p>"), page("<h1>New title</h1><p>Same supporting paragraph for the page.</p>"));
  record("heading change", heading?.changed === true && (heading.summaryLines ?? []).some((line) => line.toLowerCase().includes("new title")), (heading?.summaryLines ?? []).join("; "));

  const domNoise = diff(
    page('<div class="a1b2c3d4e5"><p>The same public sentence remains.</p></div>'),
    page('<section class="ffffeeee1111"><p>The same public sentence remains.</p></section>')
  );
  record("insignificant wrapper change is ignored", domNoise?.changed === false, domNoise?.summaryLines.join("; ") || "no lines");

  const link = diff(
    page('<a href="https://example.com/file.pdf?utm_source=ad">Report</a>'),
    page('<a href="https://example.com/file.pdf">Report</a>')
  );
  record("tracking parameter is not a new link", link?.changed === false, normalizeUrl("https://example.com/file.pdf?utm_source=ad"));

  const newLink = diff(
    page('<a href="https://example.com/a">Docs</a>'),
    page('<a href="https://example.com/a">Docs</a><a href="https://example.com/b.pdf">Download</a>')
  );
  record("new download link", newLink?.changed === true && newLink.summaryLines.some((line) => line.includes("b.pdf")), newLink?.summaryLines.join("; ") ?? "none");

  const image = diff(page('<img src="https://cdn.example/a.jpg" alt="logo">'), page('<img src="https://cdn.example/b.jpg" alt="logo">'), "images");
  record("image replacement", image?.changed === true, image?.summaryLines.join("; ") ?? "none");

  const table = diff(
    page("<table><tr><td>Plan</td><td>10</td></tr></table>"),
    page("<table><tr><td>Plan</td><td>10</td></tr><tr><td>Plan</td><td>12</td></tr></table>"),
    "tables"
  );
  record("table row change", table?.changed === true, table?.summaryLines.join("; ") ?? "none");

  const price = diff(page("<p>Price is $10.00 today.</p>"), page("<p>Price is $12.00 today.</p>"), "numbers");
  record("numeric price change", price?.changed === true, price?.summaryLines.join("; ") ?? "none");

  const structured = diff(
    page("", '<script type="application/ld+json">{"@type":"Product","name":"Lamp","offers":{"price":"10","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}</script>'),
    page("", '<script type="application/ld+json">{"@type":"Product","name":"Lamp","offers":{"price":"8","priceCurrency":"EUR","availability":"https://schema.org/OutOfStock"}}</script>'),
    "structured"
  );
  record("structured price and availability", structured?.changed === true, structured?.summaryLines.join("; ") ?? "none");

  const keyword = diff(page("<p>Weather is sunny today.</p><p>The sale starts Monday.</p>"), page("<p>Weather is rainy today.</p><p>The sale starts Monday.</p>"), "keyword", ["sale"]);
  record("keyword rule ignores unrelated text", keyword?.changed === false, keyword?.summaryLines.join("; ") || "no lines");

  const grids = [Array.from({ length: 4 }, () => 10), Array.from({ length: 4 }, () => 200)];
  const same = compareVisualFingerprints(grids[0], grids[0]);
  const different = compareVisualFingerprints(grids[0], grids[1]);
  record("screenshot threshold ignores identical frames", same.changed === false && different.changed === true, `${same.percent} vs ${different.percent}`);

  const selector = classifyMonitoringError("CSS selector not found: #price");
  record("missing selector is a configuration failure", selector.kind === "SELECTOR_MISSING", selector.title);

  const blocked = classifyMonitoringError("Anti-bot challenge detected on this public page");
  record("blocked check is not success", blocked.kind === "BLOCKED", blocked.kind);

  const freeVisual = Boolean(true) && getPlanEntitlements(Plan.FREE).maxVisualMonitors > 0;
  const proVisual = Boolean(true) && getPlanEntitlements(Plan.PRO).maxVisualMonitors > 0;
  record("visual checks stay inside the existing plan", freeVisual === false && proVisual === true, `free=${freeVisual} pro=${proVisual}`);

  const snapshot = compareSnapshots({
    monitorId: "universal",
    mode: MonitoringMode.ENTIRE_PAGE,
    previousHash: "old",
    previousText: "The office opens at nine.",
    previousCleanedHtml: page("<p>The office opens at nine.</p>"),
    previousMetadata: { pageProfile: extractPageProfile(page("<p>The office opens at nine.</p>"), page("<p>The office opens at nine.</p>")), watchScope: "page" },
    current: {
      rawHtml: page("<p>The office opens at ten.</p>"),
      cleanedHtml: page("<p>The office opens at ten.</p>"),
      extractedText: "The office opens at ten.",
      contentHash: "new",
      metadata: {
        pageProfile: extractPageProfile(page("<p>The office opens at ten.</p>"), page("<p>The office opens at ten.</p>")),
        watchScope: "page",
        checkStatus: "success",
      },
    },
  });
  record(
    "existing comparison pipeline receives the explanation",
    snapshot.changed === true && (snapshot.summaryLines ?? []).some((line) => line.toLowerCase().includes("ten")),
    (snapshot.summaryLines ?? [snapshot.reason]).join("; ")
  );

  const passed = results.filter((item) => item.ok).length;
  console.log(`\n${passed}/${results.length} universal checks passed on fixtures only.`);
  if (results.some((item) => !item.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
