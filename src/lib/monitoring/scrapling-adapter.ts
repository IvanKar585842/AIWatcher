import { createHash } from "node:crypto";
import type { MonitoringMode } from "@prisma/client";
import type { WaitStrategy } from "@/lib/monitor-config";
import { assertSafeFetchUrl } from "@/lib/security/url";
import type { PlaywrightCookieInput } from "./session-cookies";
import { MonitorCheckError } from "./check-error";
import { recordFetchSample, withDomainTurn } from "./fetch-budget";
import { httpResponseNeedsBrowser } from "./render-need";
import {
  isScraplingRuntimeUnavailable,
  scraplingRequest,
  type ScraplingWorkerResponse,
} from "./scrapling-client";
import {
  extractStructuredFields,
  type StructuredSnapshot,
} from "./structured-compare";
import { VISUAL_VIEWPORT } from "./visual-compare";

export type FetchStrategyName = "http" | "dynamic" | "advanced";

export interface ScraplingFetchRequest {
  url: string;
  mode: MonitoringMode;
  selector?: string | null;
  keywords?: string[];
  timeoutMs: number;
  waitStrategy?: WaitStrategy;
  stabilizeMs?: number;
  scrollForLazyLoad?: boolean;
  scrollDepthPx?: number;
  waitForSelector?: string | null;
  expandSelectors?: string;
  followLinkSelectors?: string | null;
  fetchStrategy?: "auto" | FetchStrategyName;
  preferredStrategy?: FetchStrategyName | null;
  cookies?: PlaywrightCookieInput[];
  captureScreenshot: boolean;
}

export interface ScraplingPage {
  rawHtml: string;
  metadata: Record<string, unknown>;
  refreshedCookies?: PlaywrightCookieInput[];
}

function isLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initialStrategy(request: ScraplingFetchRequest): FetchStrategyName {
  if (request.fetchStrategy && request.fetchStrategy !== "auto") return request.fetchStrategy;
  if (request.captureScreenshot) return "dynamic";
  if (request.preferredStrategy === "dynamic" || request.preferredStrategy === "advanced") {
    return request.preferredStrategy;
  }
  return "http";
}

function nextStrategy(current: FetchStrategyName, response: ScraplingWorkerResponse): FetchStrategyName | null {
  if (response.outcome === "blocked") return null;
  const status = response.status ?? 0;
  if (status === 401 || status === 403 || status === 404 || status === 410) return null;
  const message = (response.message ?? "").toLowerCase();
  const selectorMiss = message.includes("selector not found") || message.includes("xpath not found");
  if (selectorMiss && !response.dynamicShell) return null;

  const thinScript = httpResponseNeedsBrowser(response.rawHtml ?? "", response.text ?? "");
  if (current === "http" && (response.dynamicShell || thinScript || (selectorMiss && response.dynamicShell))) {
    return "dynamic";
  }
  if (current === "dynamic" && response.outcome === "failure" && response.retryable && status < 400) {
    return "advanced";
  }
  return null;
}

function proxyFor(strategy: FetchStrategyName): string | null {
  if (strategy !== "advanced") return null;
  const proxy = process.env.MONITOR_PROXY_URL?.trim();
  if (!proxy) return null;
  if (!/^https?:\/\//i.test(proxy)) return null;
  return proxy;
}

async function runStrategy(
  request: ScraplingFetchRequest,
  strategy: FetchStrategyName
): Promise<ScraplingWorkerResponse> {
  const domain = new URL(request.url).hostname;
  const allowLoopback = process.env.SCRAPLING_ALLOW_TEST_LOOPBACK === "1" && isLoopback(request.url);
  return withDomainTurn(domain, () =>
    scraplingRequest(
      {
        cmd: "fetch",
        url: request.url,
        strategy,
        mode: request.mode,
        selector: request.selector ?? null,
        keywords: request.keywords ?? [],
        timeoutMs: request.timeoutMs,
        waitStrategy: request.waitStrategy ?? "stabilize",
        stabilizeMs: request.stabilizeMs ?? 700,
        scroll: request.scrollForLazyLoad !== false && strategy !== "http",
        scrollDepthPx: request.scrollDepthPx ?? 1600,
        waitForSelector: request.waitForSelector ?? null,
        expandSelectors: request.expandSelectors ?? "",
        followLinkSelectors: request.followLinkSelectors ?? "",
        cookies: request.cookies ?? [],
        proxy: proxyFor(strategy),
        captureScreenshot: request.captureScreenshot,
        allowLoopback,
      },
      request.timeoutMs
    )
  );
}

function mergeStructured(rawHtml: string, text: string, incoming: unknown): StructuredSnapshot {
  const derived = extractStructuredFields(rawHtml, text);
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return derived;
  const parsed = incoming as StructuredSnapshot;
  return {
    ...derived,
    ...parsed,
    prices: parsed.prices && parsed.prices.length > 0 ? parsed.prices : derived.prices,
    items: parsed.items && parsed.items.length > 0 ? parsed.items : derived.items,
    links: parsed.links && parsed.links.length > 0 ? parsed.links : derived.links,
    availability: parsed.availability && parsed.availability !== "unknown" ? parsed.availability : derived.availability,
  };
}

function toPage(request: ScraplingFetchRequest, response: ScraplingWorkerResponse, attempts: number, browserLaunches: number, durationMs: number): ScraplingPage {
  const text = response.text ?? "";
  let rawHtml = response.rawHtml ?? "";
  const metadata: Record<string, unknown> = {
    engine: "scrapling",
    fetchStrategy: response.strategy ?? "http",
    browserLaunched: browserLaunches > 0,
    browserLaunches,
    durationMs,
    attempts,
    checkStatus: "success",
    requiresBrowser: (response.strategy ?? "http") !== "http",
    finalUrl: response.finalUrl ?? request.url,
    httpStatus: response.status ?? null,
    dynamicShell: Boolean(response.dynamicShell),
  };

  if (request.captureScreenshot) {
    const shot = response.screenshotBase64;
    if (!shot) {
      throw new MonitorCheckError("Partial extraction: screenshot was not captured");
    }
    const buffer = Buffer.from(shot, "base64");
    const screenshotHash = createHash("sha256").update(buffer).digest("hex");
    rawHtml = `[visual-screenshot:${screenshotHash}]`;
    metadata.captureType = "screenshot";
    metadata.screenshotHash = screenshotHash;
    metadata.screenshotBytes = buffer.length;
    metadata.screenshotMime = "image/jpeg";
    metadata.screenshotPreview = shot.length > 120_000 ? shot.slice(0, 120_000) : shot;
    metadata.visualFingerprint = Array.isArray(response.visualFingerprint) ? response.visualFingerprint : [];
    metadata.viewport = VISUAL_VIEWPORT;
    metadata.browserEngine = "scrapling-chromium";
  }

  const structured = mergeStructured(rawHtml, text, response.structured);
  metadata.structured = structured;

  const hasSignal =
    rawHtml.trim().length >= 20 ||
    text.trim().length >= 20 ||
    (structured.prices?.length ?? 0) > 0 ||
    (structured.items?.length ?? 0) > 0 ||
    (structured.availability != null && structured.availability !== "unknown");

  if (!request.captureScreenshot && !hasSignal) {
    throw new MonitorCheckError("Partial extraction: page content was empty");
  }
  if (request.mode === "PRICE_DETECTION" && (structured.prices?.length ?? 0) === 0) {
    throw new MonitorCheckError("Partial extraction: price was not found on the page");
  }
  if (
    request.mode === "PRODUCT_AVAILABILITY" &&
    (structured.availability === "unknown" || !structured.availability)
  ) {
    throw new MonitorCheckError("Partial extraction: availability was not found on the page");
  }

  const refreshed: PlaywrightCookieInput[] = [];
  for (const cookie of response.cookies ?? []) {
    const name = String(cookie.name ?? "");
    const value = String(cookie.value ?? "");
    const domain = typeof cookie.domain === "string" ? cookie.domain : undefined;
    if (!name || !value || !domain) continue;
    const sameSite =
      cookie.sameSite === "Strict" || cookie.sameSite === "Lax" || cookie.sameSite === "None"
        ? cookie.sameSite
        : undefined;
    refreshed.push({
      name,
      value,
      domain,
      path: typeof cookie.path === "string" ? cookie.path : "/",
      expires: typeof cookie.expires === "number" ? cookie.expires : undefined,
      httpOnly: Boolean(cookie.httpOnly),
      secure: cookie.secure !== false,
      sameSite,
    });
    if (refreshed.length >= 80) break;
  }

  return {
    rawHtml,
    metadata,
    refreshedCookies: refreshed.length > 0 ? refreshed : undefined,
  };
}

function throwOutcome(response: ScraplingWorkerResponse): never {
  const message = response.message || "Scrapling fetch failed";
  const terminal = response.outcome === "blocked" || response.outcome === "partial" || !response.retryable;
  throw new MonitorCheckError(message, terminal);
}

/**
 * Cheapest successful strategy wins: HTTP, then one dynamic render, then one
 * advanced browser attempt. Blocked and selector-missing pages are not retried
 * with a stealth browser.
 */
export async function fetchViaScrapling(request: ScraplingFetchRequest): Promise<ScraplingPage> {
  const allowLoopback = process.env.SCRAPLING_ALLOW_TEST_LOOPBACK === "1" && isLoopback(request.url);
  if (!allowLoopback) {
    await assertSafeFetchUrl(request.url);
  }

  let strategy = initialStrategy(request);
  let attempts = 0;
  let browserLaunches = 0;
  let durationMs = 0;
  let last: ScraplingWorkerResponse | null = null;

  let retriedTransient = false;

  for (let cycle = 0; cycle < 4; cycle++) {
    let response: ScraplingWorkerResponse;
    try {
      response = await runStrategy(request, strategy);
    } catch (error) {
      // A missing Python runtime is not a failed page check. The caller falls back to Playwright.
      if (isScraplingRuntimeUnavailable(error)) throw error;
      const message = error instanceof Error ? error.message : "Scrapling fetch failed";
      if (!retriedTransient && strategy === "http" && /timed out|timeout/i.test(message)) {
        retriedTransient = true;
        await sleep(1000);
        continue;
      }
      recordFetchSample({
        outcome: "failure",
        strategy,
        browserLaunches,
        durationMs,
      });
      throw new MonitorCheckError(message, true);
    }
    attempts += 1;
    durationMs += response.durationMs ?? 0;
    if (response.browserLaunched) browserLaunches += 1;
    last = response;

    if (response.retryable && response.outcome === "failure" && strategy === "http" && (response.status === 429 || response.status === 503)) {
      await sleep(1500);
      continue;
    }

    const escalate = nextStrategy(strategy, response);
    if (escalate && escalate !== strategy) {
      strategy = escalate;
      continue;
    }

    if (response.outcome === "success" && response.ok) {
      const page = toPage(request, response, attempts, browserLaunches, durationMs);
      recordFetchSample({
        outcome: "success",
        strategy: String(response.strategy ?? strategy),
        browserLaunches,
        durationMs,
      });
      return page;
    }

    recordFetchSample({
      outcome: response.outcome === "blocked" || response.outcome === "partial" ? response.outcome : "failure",
      strategy: String(response.strategy ?? strategy),
      browserLaunches,
      durationMs,
    });
    throwOutcome(response);
  }

  recordFetchSample({
    outcome: "failure",
    strategy,
    browserLaunches,
    durationMs,
  });
  throw new MonitorCheckError(last?.message || "Scrapling fetch failed", true);
}
