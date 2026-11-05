import { MonitoringMode } from "@prisma/client";
import { compareSnapshots } from "../src/lib/monitoring/compare";
import { httpResponseNeedsBrowser } from "../src/lib/monitoring/render-need";
import { rememberBrowserStrategy } from "../src/lib/monitoring/scheduler";
import { useSystemCa } from "../src/lib/security/system-ca";
import { resolveWorkerRunUrl } from "../src/lib/monitoring/worker-dispatch";

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
assert("system certificate store can be installed twice", useSystemCa() === true && useSystemCa() === true);

if (!process.exitCode) console.log("coverage guard checks passed");
