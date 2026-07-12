import { chromium as playwrightChromium, type Browser, type Page } from "playwright-core";
import { MonitoringMode } from "@prisma/client";
import path from "node:path";
import {
  cleanHtml,
  cleanText,
  extractTextFromHtml,
  type CleanOptions,
} from "./content-cleaner";
import { computeContentHash, hashScreenshotBuffer } from "./compare";
import { monitorLog, monitorLogError } from "./logger";
import { removeDynamicElements, waitForPageReady } from "./page-utils";
import {
  VISUAL_VIEWPORT,
} from "./visual-compare";
import {
  isUrlAllowedByRobotsTxt,
  robotsTxtBlockedMessage,
  shouldEnforceRobotsTxt,
} from "./robots";
import { assertSafeFetchUrl, fetchWithSafeRedirects } from "@/lib/security/url";

const FETCH_RETRY_BASE_MS = 1000;

/** Remote Chromium pack for Vercel — arch-specific (generic -pack.tar 404s on v149+) */
function defaultChromiumPackUrl(): string {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return `https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.${arch}.tar`;
}

const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL?.trim() || defaultChromiumPackUrl();

/** Match Sparticuz lib selection to the actual Node major on the function */
function resolveLambdaJsRuntime(): string {
  if (process.env.AWS_LAMBDA_JS_RUNTIME?.trim()) {
    return process.env.AWS_LAMBDA_JS_RUNTIME.trim();
  }
  const major = Number(process.versions.node.split(".")[0] || "22");
  if (major >= 24) return "nodejs24.x";
  if (major >= 22) return "nodejs22.x";
  return "nodejs20.x";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withFetchRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await sleep(FETCH_RETRY_BASE_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Fetch failed after retries");
}

let browserInstance: Browser | null = null;

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV
  );
}

function applyChromiumLdPath(executablePath: string): void {
  const execDir = path.dirname(executablePath);
  const al2023Lib = path.join("/tmp", "al2023", "lib");
  process.env.LD_LIBRARY_PATH = [execDir, al2023Lib, process.env.LD_LIBRARY_PATH]
    .filter(Boolean)
    .join(":");
}

async function launchPlaywrightWithExecutable(
  args: string[],
  executablePath: string
): Promise<Browser> {
  applyChromiumLdPath(executablePath);
  return playwrightChromium.launch({
    args,
    executablePath,
    headless: true,
  });
}

/**
 * Vercel: try bundled @sparticuz/chromium first (via NFT includes),
 * then chromium-min + remote pack (GitHub / CHROMIUM_PACK_URL).
 */
async function launchWithSparticuz(): Promise<Browser> {
  // Must be set BEFORE importing chromium so the correct AL2023 libs are selected
  process.env.AWS_LAMBDA_JS_RUNTIME = resolveLambdaJsRuntime();

  const runtimeInfo = `${process.env.AWS_LAMBDA_JS_RUNTIME}, ${process.arch}, node ${process.versions.node}`;

  // 1) Full package — binary ships with the function when file tracing includes bin/
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    chromium.setGraphicsMode = false;
    const executablePath = await chromium.executablePath();
    if (executablePath) {
      monitorLog({
        step: "fetch_start",
        message: `Chromium ready via @sparticuz/chromium (${runtimeInfo})`,
      });
      return launchPlaywrightWithExecutable(chromium.args, executablePath);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    monitorLog({
      step: "fetch_start",
      message: `Bundled Chromium unavailable, trying remote pack: ${detail}`,
    });
  }

  // 2) Min package — download arch-specific pack at runtime
  const chromiumMin = (await import("@sparticuz/chromium-min")).default;
  chromiumMin.setGraphicsMode = false;

  let executablePath: string;
  try {
    executablePath = await chromiumMin.executablePath(CHROMIUM_PACK_URL);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to download Chromium pack (${CHROMIUM_PACK_URL}). ` +
        `Host the pack on a fast HTTPS URL (Blob/S3) and set CHROMIUM_PACK_URL. Cause: ${detail}`,
      { cause: error }
    );
  }

  if (!executablePath) {
    throw new Error(
      `Serverless Chromium executable path is empty after downloading ${CHROMIUM_PACK_URL}`
    );
  }

  monitorLog({
    step: "fetch_start",
    message: `Chromium ready via remote pack (${runtimeInfo})`,
  });

  return launchPlaywrightWithExecutable(chromiumMin.args, executablePath);
}

function isMissingBrowserError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return (
    msg.includes("Executable doesn't exist") ||
    msg.includes("browserType.launch") ||
    msg.includes("Failed to launch") ||
    msg.includes("playwright install")
  );
}

async function launchBrowser(): Promise<Browser> {
  if (isServerlessRuntime()) {
    return launchWithSparticuz();
  }

  try {
    const { chromium } = await import("playwright");
    return await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  } catch (error) {
    if (isMissingBrowserError(error)) {
      console.warn(
        "Local Playwright browser not found, falling back to bundled Chromium. " +
          "For best results run: npx playwright install chromium"
      );
      try {
        return await launchWithSparticuz();
      } catch (fallbackError) {
        throw new Error(
          "Playwright browser is not installed. Run: npx playwright install chromium",
          { cause: fallbackError }
        );
      }
    }
    throw error;
  }
}

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  browserInstance = null;
  try {
    browserInstance = await launchBrowser();
    return browserInstance;
  } catch (error) {
    browserInstance = null;
    throw error;
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export interface FetchResult {
  rawHtml: string;
  cleanedHtml: string;
  extractedText: string;
  contentHash: string;
  metadata: Record<string, unknown>;
}

export interface FetchOptions {
  url: string;
  mode: MonitoringMode;
  monitorId?: string;
  selector?: string | null;
  keywords?: string[];
  respectRobots?: boolean;
  timeout?: number;
  ignoreAds?: boolean;
  cleanOptions?: CleanOptions;
  maxRetries?: number;
}

export async function fetchPageContent(options: FetchOptions): Promise<FetchResult> {
  const maxRetries = options.maxRetries ?? 3;
  let attempt = 0;

  return withFetchRetry(async () => {
    attempt++;
    if (attempt > 1) {
      monitorLog({
        step: "fetch_start",
        monitorId: options.monitorId,
        url: options.url,
        mode: options.mode,
        message: `Retrying fetch (attempt ${attempt}/${maxRetries})`,
      });
    }
    return fetchPageContentOnce(options);
  }, maxRetries);
}

async function checkRobotsTxt(url: string, mode: MonitoringMode, respectRobots: boolean): Promise<void> {
  if (!shouldEnforceRobotsTxt(mode, respectRobots)) {
    monitorLog({
      step: "fetch_start",
      url,
      mode,
      message: "robots.txt check skipped for this monitoring mode",
    });
    return;
  }

  const allowed = await isUrlAllowedByRobotsTxt(url);
  if (!allowed) {
    throw new Error(robotsTxtBlockedMessage(url));
  }
}

async function fetchPageContentOnce(options: FetchOptions): Promise<FetchResult> {
  const {
    url,
    mode,
    monitorId,
    selector,
    keywords,
    respectRobots = true,
    timeout = 30000,
    ignoreAds = true,
    cleanOptions,
  } = options;

  // Re-validate at fetch time (SSRF / private IP / DNS) — never trust stored URLs alone
  await assertSafeFetchUrl(url);

  monitorLog({
    step: "fetch_start",
    monitorId,
    url,
    mode,
    message: "Opening website with Playwright",
    data: { timeout, respectRobots },
  });

  if (mode === MonitoringMode.API_RESPONSE || mode === MonitoringMode.RSS_FEED) {
    const result = await fetchStaticContent(url, mode, timeout, cleanOptions, monitorId);
    monitorLog({
      step: "fetch_success",
      monitorId,
      url,
      mode,
      message: "Static content fetched",
      data: { hash: result.contentHash.slice(0, 16), textLength: result.extractedText.length },
    });
    return result;
  }

  if (respectRobots) {
    try {
      await checkRobotsTxt(url, mode, respectRobots);
    } catch (error) {
      monitorLogError("fetch_failed", "Robots.txt blocked request", error, {
        monitorId,
        url,
        mode,
      });
      throw error;
    }
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "WatchFlowing/1.0 (+https://watchflowing.com/bot; monitoring service)",
    viewport: { width: VISUAL_VIEWPORT.width, height: VISUAL_VIEWPORT.height },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });

  let page: Page | null = null;

  try {
    page = await context.newPage();

    // Block SSRF via redirect hops (re-validate every request URL)
    await page.route("**/*", async (route) => {
      try {
        await assertSafeFetchUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort("blockedbyclient");
      }
    });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout,
    });

    if (!response) {
      throw new Error("Navigation returned no response");
    }

    // Final landed URL must also be safe
    await assertSafeFetchUrl(response.url());

    if (response.status() >= 400) {
      throw new Error(`HTTP ${response.status()} loading page`);
    }

    await waitForPageReady(page, timeout);

    const removed = await removeDynamicElements(page, {
      ignoreAds,
      ignoreCookies: cleanOptions?.ignoreCookies !== false,
      ignoreSelectors: cleanOptions?.ignoreSelectors,
    });

    monitorLog({
      step: "page_cleaned",
      monitorId,
      url,
      mode,
      message: "Dynamic elements removed from DOM",
      data: removed,
    });

    let rawHtml: string;
    let metadata: Record<string, unknown> = { finalUrl: page.url() };

    switch (mode) {
      case MonitoringMode.CSS_SELECTOR: {
        if (!selector) throw new Error("CSS selector is required");
        const element = await page.$(selector);
        if (!element) throw new Error(`CSS selector not found: ${selector}`);
        rawHtml = await element.innerHTML();
        metadata = { ...metadata, selector };
        break;
      }

      case MonitoringMode.XPATH: {
        if (!selector) throw new Error("XPath is required");
        rawHtml = await page.evaluate((xpath) => {
          const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          const node = result.singleNodeValue;
          if (!node) throw new Error(`XPath not found: ${xpath}`);
          const el = node as Element;
          return el.innerHTML ?? el.textContent ?? "";
        }, selector);
        metadata = { ...metadata, xpath: selector };
        break;
      }

      case MonitoringMode.PRICE_DETECTION: {
        rawHtml = await extractPriceContent(page);
        metadata = { ...metadata, captureType: "price" };
        break;
      }

      case MonitoringMode.KEYWORD_DETECTION: {
        const pageText = await page.evaluate(() => document.body.innerText);
        const foundKeywords = (keywords ?? []).filter((kw) =>
          pageText.toLowerCase().includes(kw.toLowerCase())
        );
        rawHtml =
          foundKeywords.join("\n") + "\n" + extractKeywordContext(pageText, keywords ?? []);
        metadata = { ...metadata, captureType: "keywords", keywords: foundKeywords };
        break;
      }

      case MonitoringMode.TABLE_DETECTION: {
        rawHtml = await extractTableContent(page);
        metadata = { ...metadata, captureType: "table" };
        break;
      }

      case MonitoringMode.JOB_LISTINGS: {
        rawHtml = await extractJobListings(page);
        metadata = { ...metadata, captureType: "job_listings" };
        break;
      }

      case MonitoringMode.VISUAL_CHANGES:
      case MonitoringMode.SCREENSHOT_DIFF: {
        // Fixed viewport screenshot for stable comparisons (avoids fullPage height noise)
        const buffer = await page.screenshot({
          fullPage: false,
          type: "jpeg",
          quality: 55,
        });
        const screenshotHash = hashScreenshotBuffer(buffer);
        const previewBase64 = buffer.toString("base64");
        const fingerprint = (await page.evaluate(
          async ({ b64, size }) => {
            const img = new Image();
            img.src = `data:image/jpeg;base64,${b64}`;
            await img.decode();
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (!ctx) return [] as number[];
            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;
            const out: number[] = [];
            for (let i = 0; i < data.length; i += 4) {
              out.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
            }
            return out;
          },
          { b64: previewBase64, size: 48 }
        )) as number[];

        // Cap preview stored for history UI
        const storedPreview =
          previewBase64.length > 120_000
            ? previewBase64.slice(0, 120_000)
            : previewBase64;

        rawHtml = `[visual-screenshot:${screenshotHash}]`;
        metadata = {
          ...metadata,
          captureType: "screenshot",
          screenshotHash,
          screenshotBytes: buffer.length,
          visualFingerprint: fingerprint,
          screenshotPreview: storedPreview,
          screenshotMime: "image/jpeg",
          viewport: VISUAL_VIEWPORT,
        };
        break;
      }

      case MonitoringMode.HTML_DIFF: {
        rawHtml = await page.content();
        metadata = { ...metadata, captureType: "html_diff" };
        break;
      }

      case MonitoringMode.TEXT_CHANGES: {
        rawHtml = await page.evaluate(() => document.body.innerText);
        metadata = { ...metadata, captureType: "visible_text" };
        break;
      }

      case MonitoringMode.PRODUCT_AVAILABILITY: {
        rawHtml = await extractProductAvailability(page);
        metadata = { ...metadata, captureType: "product_availability" };
        break;
      }

      case MonitoringMode.DOCUMENTATION_CHANGES: {
        rawHtml = await extractDocumentationContent(page);
        metadata = { ...metadata, captureType: "documentation" };
        break;
      }

      case MonitoringMode.AI_SMART: {
        rawHtml = await extractSmartContent(page);
        metadata = { ...metadata, captureType: "ai_smart" };
        break;
      }

      case MonitoringMode.ENTIRE_PAGE:
      default: {
        rawHtml = await page.content();
        metadata = { ...metadata, captureType: "entire_page_html" };
        break;
      }
    }

    const isPlainText =
      mode === MonitoringMode.TEXT_CHANGES ||
      mode === MonitoringMode.PRICE_DETECTION ||
      mode === MonitoringMode.KEYWORD_DETECTION;

    const isVisual =
      mode === MonitoringMode.VISUAL_CHANGES || mode === MonitoringMode.SCREENSHOT_DIFF;

    const cleanedHtml = isVisual
      ? rawHtml
      : isPlainText
        ? cleanText(rawHtml, cleanOptions)
        : cleanHtml(rawHtml, cleanOptions);

    const extractedText = isPlainText
      ? cleanedHtml
      : isVisual
        ? String(metadata.screenshotHash ?? "")
        : extractTextFromHtml(cleanedHtml);

    const partial: FetchResult = {
      rawHtml,
      cleanedHtml,
      extractedText,
      contentHash: "",
      metadata,
    };

    const contentHash = computeContentHash(mode, partial);

    monitorLog({
      step: "fetch_success",
      monitorId,
      url,
      mode,
      message: "Page content ready for comparison",
      data: {
        captureType: metadata.captureType,
        hash: contentHash.slice(0, 16),
        textLength: extractedText.length,
        htmlLength: cleanedHtml.length,
      },
    });

    return { ...partial, contentHash };
  } catch (error) {
    monitorLogError("fetch_failed", "Failed to fetch website", error, {
      monitorId,
      url,
      mode,
    });
    throw error;
  } finally {
    if (page) await page.close();
    await context.close();
  }
}

async function fetchStaticContent(
  url: string,
  mode: MonitoringMode,
  timeout: number,
  cleanOptions?: CleanOptions,
  monitorId?: string
): Promise<FetchResult> {
  const response = await fetchWithSafeRedirects(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot; monitoring service)",
      Accept: mode === MonitoringMode.RSS_FEED ? "application/rss+xml, application/xml, text/xml" : "*/*",
    },
  });

  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
    monitorLogError("fetch_failed", "Static fetch failed", err, { monitorId, url, mode });
    throw err;
  }

  const rawHtml = await response.text();
  const cleanedHtml = cleanHtml(rawHtml, cleanOptions);
  const extractedText = extractTextFromHtml(cleanedHtml);
  const partial: FetchResult = {
    rawHtml,
    cleanedHtml,
    extractedText,
    contentHash: "",
    metadata: { captureType: mode === MonitoringMode.RSS_FEED ? "rss_feed" : "api_response" },
  };

  return { ...partial, contentHash: computeContentHash(mode, partial) };
}

async function extractProductAvailability(page: Page): Promise<string> {
  return page.evaluate(() => {
    const availabilitySelectors = [
      '[class*="stock"]',
      '[class*="availability"]',
      '[class*="in-stock"]',
      '[class*="out-of-stock"]',
      '[itemprop="availability"]',
      'button[class*="add-to-cart"]',
      'button[class*="buy"]',
      '[data-availability]',
    ];

    const signals: string[] = [];
    for (const sel of availabilitySelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length < 200) signals.push(text);
      });
    }

    const body = document.body.innerText;
    const patterns = [
      /in\s*stock/gi,
      /out\s*of\s*stock/gi,
      /available\s*now/gi,
      /sold\s*out/gi,
      /add\s*to\s*cart/gi,
      /pre-?order/gi,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) signals.push(...match);
    }

    return signals.length > 0 ? [...new Set(signals)].join("\n") : body.slice(0, 5000);
  });
}

async function extractDocumentationContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const docSelectors = [
      "article",
      "main",
      '[role="main"]',
      ".docs-content",
      ".documentation",
      ".markdown-body",
      "#readme",
      ".changelog",
      ".release-notes",
    ];

    for (const sel of docSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 80) {
        return el.innerHTML;
      }
    }

    return document.body.innerText.slice(0, 10000);
  });
}

async function extractPriceContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const priceSelectors = [
      '[class*="price"]',
      '[class*="Price"]',
      '[data-price]',
      '[itemprop="price"]',
      ".product-price",
      ".sale-price",
      ".current-price",
      "span[class*='cost']",
    ];

    const prices: string[] = [];
    for (const sel of priceSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const text = el.textContent?.trim();
        if (text && /[\$€£¥]\s*[\d,.]+|[\d,.]+\s*[\$€£¥]/.test(text)) {
          prices.push(text);
        }
      });
    }

    if (prices.length === 0) {
      const body = document.body.innerText;
      const matches = body.match(/[\$€£¥]\s*[\d,.]+(?:\.\d{2})?/g);
      if (matches) prices.push(...matches);
    }

    return prices.length > 0 ? prices.join("\n") : document.body.innerText.slice(0, 5000);
  });
}

async function extractTableContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const tables = document.querySelectorAll("table");
    if (tables.length === 0) return document.body.innerText.slice(0, 5000);

    const results: string[] = [];
    tables.forEach((table, i) => {
      const rows: string[] = [];
      table.querySelectorAll("tr").forEach((row) => {
        const cells = Array.from(row.querySelectorAll("td, th"))
          .map((c) => c.textContent?.trim() ?? "")
          .filter(Boolean);
        if (cells.length > 0) rows.push(cells.join(" | "));
      });
      if (rows.length > 0) results.push(`Table ${i + 1}:\n${rows.join("\n")}`);
    });

    return results.join("\n\n");
  });
}

async function extractJobListings(page: Page): Promise<string> {
  return page.evaluate(() => {
    const jobSelectors = [
      '[class*="job"]',
      '[class*="Job"]',
      '[class*="career"]',
      '[class*="position"]',
      '[class*="listing"]',
      '[data-job]',
      "li[class*='opening']",
      ".job-post",
      ".job-listing",
      ".careers-item",
    ];

    const listings: string[] = [];
    for (const sel of jobSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length > 10 && text.length < 2000) {
          listings.push(text.replace(/\s+/g, " "));
        }
      });
    }

    if (listings.length === 0) {
      return document.body.innerText.slice(0, 8000);
    }

    return [...new Set(listings)].join("\n---\n");
  });
}

async function extractSmartContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const mainSelectors = [
      "main",
      "article",
      '[role="main"]',
      ".content",
      "#content",
      ".main-content",
      "#main",
    ];

    for (const sel of mainSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 100) {
        return el.innerHTML;
      }
    }

    const clone = document.body.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll(
        "nav, header, footer, aside, script, style, noscript, [class*='nav'], [class*='footer'], [class*='sidebar'], [class*='ad-'], [class*='cookie']"
      )
      .forEach((el) => el.remove());

    return clone.innerHTML;
  });
}

function extractKeywordContext(text: string, keywords: string[]): string {
  const contexts: string[] = [];
  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    const idx = lowerText.indexOf(keyword.toLowerCase());
    if (idx !== -1) {
      const start = Math.max(0, idx - 100);
      const end = Math.min(text.length, idx + keyword.length + 100);
      contexts.push(text.slice(start, end));
    }
  }

  return contexts.join("\n...\n");
}
