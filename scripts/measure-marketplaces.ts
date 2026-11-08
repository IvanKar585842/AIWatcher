/**
 * One ordinary HTTPS request per public catalog domain.
 * Official API stores are not fetched. Challenges are recorded, not bypassed.
 * An open homepage is not a product-price result.
 *
 * Usage: npx tsx scripts/measure-marketplaces.ts
 */
import { MARKETPLACES } from "../src/lib/monitoring/marketplace/catalog";
import { fetchWithSafeRedirects } from "../src/lib/security/url";
import { installSystemCa } from "../src/lib/security/system-ca";

installSystemCa();

const CHALLENGE =
  /just a moment|cf-challenge|challenge-platform|captcha|are you a robot|attention required|access denied|pardon our interruption/i;

type Outcome = "open" | "thin" | "challenge" | "http_error" | "network_error";

interface Row {
  domain: string;
  name: string;
  outcome: Outcome;
  status: number;
  bytes: number;
  ms: number;
  error?: string;
}

async function probe(entry: { domain: string; name: string }): Promise<Row> {
  const started = Date.now();
  try {
    const response = await fetchWithSafeRedirects(`https://${entry.domain}/`, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot)",
      },
      signal: AbortSignal.timeout(12_000),
    });
    const text = await response.text();
    const challenge =
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      response.status === 503 ||
      CHALLENGE.test(text.slice(0, 20_000));
    const outcome: Outcome = challenge
      ? "challenge"
      : response.ok && text.length >= 800
        ? "open"
        : response.ok
          ? "thin"
          : "http_error";
    return {
      domain: entry.domain,
      name: entry.name,
      outcome,
      status: response.status,
      bytes: text.length,
      ms: Date.now() - started,
    };
  } catch (error) {
    return {
      domain: entry.domain,
      name: entry.name,
      outcome: "network_error",
      status: 0,
      bytes: 0,
      ms: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 140) : "request failed",
    };
  }
}

async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function main() {
  const official = MARKETPLACES.filter((entry) => entry.access === "official-api");
  const pages = MARKETPLACES.filter((entry) => entry.access === "public-page");
  const rows = await pool(pages, 4, probe);
  const count = (outcome: Outcome) => rows.filter((row) => row.outcome === outcome).length;
  console.log(
    JSON.stringify(
      {
        catalog: MARKETPLACES.length,
        officialApiNotFetched: official.length,
        officialCommercialUse: "requires_clarification",
        publicPages: pages.length,
        open: count("open"),
        thin: count("thin"),
        challenge: count("challenge"),
        httpError: count("http_error"),
        networkError: count("network_error"),
        note: "open means the homepage returned ordinary HTML. It does not mean product price monitoring works.",
        notOpen: rows
          .filter((row) => row.outcome !== "open")
          .map((row) => ({
            domain: row.domain,
            outcome: row.outcome,
            status: row.status,
            error: row.error ?? null,
          })),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
