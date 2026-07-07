import { chromium as playwrightChromium, type Browser, type Page } from "playwright-core";
import { MonitoringMode } from "@prisma/client";
import path from "node:path";
import {
  cleanHtml,
  extractTextFromHtml,
  getAdSelectors,
  getCookieBannerSelectors,
  hashContent,
  type CleanOptions,
} from "./content-cleaner";

const FETCH_RETRY_BASE_MS = 1000;

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

async function launchWithSparticuz(): Promise<Browser> {
  const chromium = (await import("@sparticuz/chromium")).default;
  const executablePath = await chromium.executablePath();

  if (executablePath) {
    process.env.LD_LIBRARY_PATH = path.dirname(executablePath);
  }

  return playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: chromium.headless ?? true,
  });
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
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await launchBrowser();
  }
  return browserInstance;
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
  return withFetchRetry(() => fetchPageContentOnce(options), maxRetries);
}

async function checkRobotsTxt(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.origin}/robots.txt`;
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return true;

    const text = await response.text();
    const urlPath = parsed.pathname;

    let inUserAgentAll = false;
    for (const line of text.split("\n")) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith("user-agent:")) {
        const agent = trimmed.split(":")[1]?.trim();
        inUserAgentAll = agent === "*";
      }
      if (inUserAgentAll && trimmed.startsWith("disallow:")) {
        const disallowPath = trimmed.split(":")[1]?.trim() ?? "";
        if (disallowPath && urlPath.startsWith(disallowPath)) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return true;
  }
}

async function fetchPageContentOnce(options: FetchOptions): Promise<FetchResult> {
  const {
    url,
    mode,
    selector,
    keywords,
    respectRobots = true,
    timeout = 30000,
    ignoreAds = true,
    cleanOptions,
  } = options;

  if (mode === MonitoringMode.API_RESPONSE || mode === MonitoringMode.RSS_FEED) {
    return fetchStaticContent(url, mode, timeout, cleanOptions);
  }

  if (respectRobots) {
    const allowed = await checkRobotsTxt(url);
    if (!allowed) {
      throw new Error("Access denied by robots.txt");
    }
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "WatchFlowAI/1.0 (+https://watchflow.ai/bot; monitoring service)",
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });

  let page: Page | null = null;

  try {
    page = await context.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout,
    });

    await page.waitForTimeout(2000);

    if (ignoreAds) {
      for (const adSelector of getAdSelectors()) {
        await page.evaluate((sel) => {
          document.querySelectorAll(sel).forEach((el) => el.remove());
        }, adSelector);
      }
    }

    const ignoreCookies = cleanOptions?.ignoreCookies !== false;
    if (ignoreCookies) {
      for (const cookieSelector of getCookieBannerSelectors()) {
        await page.evaluate((sel) => {
          document.querySelectorAll(sel).forEach((el) => el.remove());
        }, cookieSelector);
      }
    }

    let rawHtml: string;
    let metadata: Record<string, unknown> = {};

    switch (mode) {
      case MonitoringMode.CSS_SELECTOR: {
        if (!selector) throw new Error("CSS selector is required");
        const element = await page.$(selector);
        if (!element) throw new Error(`CSS selector not found: ${selector}`);
        rawHtml = await element.innerHTML();
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
        break;
      }

      case MonitoringMode.PRICE_DETECTION: {
        rawHtml = await extractPriceContent(page);
        metadata = { mode: "price_detection" };
        break;
      }

      case MonitoringMode.KEYWORD_DETECTION: {
        rawHtml = await page.content();
        const text = extractTextFromHtml(rawHtml);
        const foundKeywords = (keywords ?? []).filter((kw) =>
          text.toLowerCase().includes(kw.toLowerCase())
        );
        rawHtml = foundKeywords.join("\n") + "\n" + extractKeywordContext(text, keywords ?? []);
        metadata = { keywords: foundKeywords };
        break;
      }

      case MonitoringMode.TABLE_DETECTION: {
        rawHtml = await extractTableContent(page);
        metadata = { mode: "table_detection" };
        break;
      }

      case MonitoringMode.JOB_LISTINGS: {
        rawHtml = await extractJobListings(page);
        metadata = { mode: "job_listings" };
        break;
      }

      case MonitoringMode.VISUAL_CHANGES:
      case MonitoringMode.HTML_DIFF: {
        rawHtml = await page.content();
        metadata = { mode: mode === MonitoringMode.VISUAL_CHANGES ? "visual" : "html_diff" };
        break;
      }

      case MonitoringMode.TEXT_CHANGES: {
        rawHtml = await page.evaluate(() => document.body.innerText);
        metadata = { mode: "text_changes" };
        break;
      }

      case MonitoringMode.SCREENSHOT_DIFF: {
        rawHtml = await page.content();
        metadata = { mode: "screenshot_diff" };
        break;
      }

      case MonitoringMode.PRODUCT_AVAILABILITY: {
        rawHtml = await extractProductAvailability(page);
        metadata = { mode: "product_availability" };
        break;
      }

      case MonitoringMode.DOCUMENTATION_CHANGES: {
        rawHtml = await extractDocumentationContent(page);
        metadata = { mode: "documentation" };
        break;
      }

      case MonitoringMode.AI_SMART: {
        rawHtml = await extractSmartContent(page);
        metadata = { mode: "ai_smart" };
        break;
      }

      case MonitoringMode.ENTIRE_PAGE:
      default: {
        rawHtml = await page.content();
        break;
      }
    }

    const cleanedHtml = cleanHtml(rawHtml, cleanOptions);
    const extractedText = extractTextFromHtml(cleanedHtml);
    const contentHash = hashContent(cleanedHtml);

    return {
      rawHtml,
      cleanedHtml,
      extractedText,
      contentHash,
      metadata,
    };
  } finally {
    if (page) await page.close();
    await context.close();
  }
}

async function fetchStaticContent(
  url: string,
  mode: MonitoringMode,
  timeout: number,
  cleanOptions?: CleanOptions
): Promise<FetchResult> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      "User-Agent": "WatchFlowAI/1.0 (+https://watchflow.ai/bot; monitoring service)",
      Accept: mode === MonitoringMode.RSS_FEED ? "application/rss+xml, application/xml, text/xml" : "*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const rawHtml = await response.text();
  const cleanedHtml = cleanHtml(rawHtml, cleanOptions);
  const extractedText = extractTextFromHtml(cleanedHtml);
  const contentHash = hashContent(cleanedHtml);

  return {
    rawHtml,
    cleanedHtml,
    extractedText,
    contentHash,
    metadata: { mode: mode === MonitoringMode.RSS_FEED ? "rss_feed" : "api_response" },
  };
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
