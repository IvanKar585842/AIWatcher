import { MonitoringMode } from "@prisma/client";
import { compareSnapshots } from "../src/lib/monitoring/compare";
import { httpResponseNeedsBrowser } from "../src/lib/monitoring/render-need";
import { rememberBrowserStrategy } from "../src/lib/monitoring/scheduler";
import { installSystemCa } from "../src/lib/security/system-ca";
import { resolveWorkerRunUrl } from "../src/lib/monitoring/worker-dispatch";
import { describeCheck, shouldWaitForInterval, summarizeCapture } from "../src/lib/monitoring/capture-summary";

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error("FAIL", name);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

const article = `<article><p>${"The office opens at nine. ".repeat(6)}</p></article>`;
const previous = `<nav><a href="/pricing">Pricing</a></nav>${article}`;
const current = `<nav><a href="/sale">Sale</a></nav>${article}`;
const comparison = compareSnapshots({
  monitorId: "main",
  mode: MonitoringMode.ENTIRE_PAGE,
  previousHash: "old",
  previousText: `Pricing ${article}`,
  previousCleanedHtml: previous,
  previousMetadata: null,
  current: {
    rawHtml: current,
    cleanedHtml: current,
    extractedText: `Sale ${article}`,
    contentHash: "new",
    metadata: { resultComplete: true },
  },
});
assert("navigation change outside the article is ignored", comparison.changed === false);

const chrome = `${"<a>Home</a>".repeat(80)}<main></main><div id="root"></div><script id="__NEXT_DATA__" type="application/json">{}</script>`;
assert(
  "menu text with an empty main still needs a browser",
  httpResponseNeedsBrowser(chrome, "Home ".repeat(80))
);
assert(
  "a long article does not need a browser",
  httpResponseNeedsBrowser(`<article><p>${"Visible article text. ".repeat(40)}</p></article>`, "Visible article text. ".repeat(40)) === false
);

assert("auto upgrades to the browser strategy that worked", rememberBrowserStrategy(undefined, "dynamic") === "dynamic");
assert("an explicit http strategy is kept", rememberBrowserStrategy("http", "dynamic") === null);

assert("public http worker URLs are rejected", resolveWorkerRunUrl("http://worker.example") === null);
assert(
  "localhost worker URL points at /run",
  resolveWorkerRunUrl("http://127.0.0.1:8787") === "http://127.0.0.1:8787/run"
);
assert("system certificate store can be installed twice", installSystemCa() === true && installSystemCa() === true);

const checkedAt = new Date("2026-11-07T10:00:00.000Z");
assert(
  "a manual check does not wait for the interval",
  shouldWaitForInterval({
    force: true,
    errorCount: 0,
    lastCheckedAt: checkedAt,
    now: new Date("2026-11-07T10:05:00.000Z"),
    intervalMs: 12 * 60 * 60 * 1000,
  }) === false
);
assert(
  "a scheduled check waits until the interval elapses",
  shouldWaitForInterval({
    errorCount: 0,
    lastCheckedAt: checkedAt,
    now: new Date("2026-11-07T10:05:00.000Z"),
    intervalMs: 12 * 60 * 60 * 1000,
  }) === true
);
assert(
  "a failed check is not postponed for the full interval",
  shouldWaitForInterval({
    errorCount: 1,
    lastCheckedAt: checkedAt,
    now: new Date("2026-11-07T10:05:00.000Z"),
    intervalMs: 12 * 60 * 60 * 1000,
  }) === false
);

const catalog = summarizeCapture({
  captureType: "shopify",
  fetchStrategy: "http",
  browserLaunched: false,
  structured: {
    listingsFound: true,
    prices: [{ raw: "9.00 USD", value: 9, currency: "USD" }],
    items: [
      { title: "Wool runner", price: 98, currency: "USD" },
      { title: "Tree runner", price: 98, currency: "USD" },
      { title: "Dasher", price: 120, currency: "USD" },
    ],
  },
});
assert("a catalog summary names items instead of a banner price", catalog.lines.includes("3 catalog items"));
assert("a catalog summary does not use the page price", catalog.lines.every((line) => !line.startsWith("Price ")));
assert("a catalog summary includes the first product", catalog.lines.some((line) => line.startsWith("Wool runner")));

const release = describeCheck({
  status: "baseline",
  capture: summarizeCapture({
    captureType: "github-releases",
    fetchStrategy: "http",
    browserLaunched: false,
    sourceRecords: [{ title: "node v22.11.0" }],
  }),
});
assert("a release baseline says the first snapshot was saved", release.title === "First snapshot saved");
assert("a release baseline names the record", release.lines.includes("node v22.11.0"));

if (!process.exitCode) console.log("coverage guard checks passed");
