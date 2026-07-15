import type { Page } from "playwright-core";
import { getAdSelectors, getCookieBannerSelectors } from "./content-cleaner";
import type { WaitStrategy } from "@/lib/monitor-config";

export interface PageReadyOptions {
  timeout: number;
  waitStrategy?: WaitStrategy;
  /** Extra settle delay after primary wait (ms). */
  stabilizeMs?: number;
  scrollForLazyLoad?: boolean;
  scrollDepthPx?: number;
  /** Adaptive: wait for this selector to appear. */
  waitForSelector?: string | null;
  /** Comma-separated CSS selectors to click/expand before capture. */
  expandSelectors?: string;
}

/**
 * Wait until the page is stable enough for meaningful content capture.
 * Favors reliability for JS-rendered apps without fighting anti-bot systems.
 */
export async function waitForPageReady(
  page: Page,
  options: PageReadyOptions | number
): Promise<void> {
  const opts: PageReadyOptions =
    typeof options === "number" ? { timeout: options } : options;

  const timeout = opts.timeout;
  const strategy: WaitStrategy = opts.waitStrategy ?? "stabilize";
  // Honor configured timeout (clamped) so user timeout actually binds readiness
  const budget = Math.max(6_000, Math.min(timeout, 90_000));
  const started = Date.now();
  const remaining = () => Math.max(400, budget - (Date.now() - started));

  // Always ensure DOM is at least parseable
  try {
    await page.waitForLoadState("domcontentloaded", {
      timeout: Math.min(remaining(), strategy === "dom" ? budget : 12_000),
    });
  } catch {
    // May already be past DOMContentLoaded
  }

  if (strategy === "load" || strategy === "networkidle" || strategy === "stabilize") {
    if (strategy === "load") {
      await page
        .waitForLoadState("load", { timeout: Math.min(remaining(), budget) })
        .catch(() => {});
    } else {
      // networkidle + stabilize
      try {
        await page.waitForLoadState("networkidle", {
          timeout: Math.min(remaining(), Math.min(18_000, budget)),
        });
      } catch {
        await page
          .waitForLoadState("load", {
            timeout: Math.min(remaining(), 8_000),
          })
          .catch(() => {});
      }
    }
  }

  await page.waitForSelector("body", { timeout: Math.min(remaining(), 5_000) }).catch(() => {});

  if (strategy === "stabilize") {
    // JS-rendered shells: wait until there is real text or common landmarks
    await page
      .waitForFunction(
        () => {
          const body = document.body;
          if (!body) return false;
          const text = (body.innerText || "").replace(/\s+/g, " ").trim();
          if (text.length >= 48) return true;
          return Boolean(
            body.querySelector(
              "main, article, [role='main'], img, table, [data-testid], #root, #__next, .app"
            )
          );
        },
        { timeout: Math.min(remaining(), 10_000) }
      )
      .catch(() => {});
  }

  const waitSel = opts.waitForSelector?.trim();
  if (waitSel) {
    await page
      .waitForSelector(waitSel, {
        state: "attached",
        timeout: Math.min(remaining(), Math.max(4_000, Math.floor(budget * 0.45))),
      })
      .catch(() => {
        // Soft: continue — selector modes throw later with a clearer error
      });
  }

  const stabilize = Math.min(
    Math.max(0, opts.stabilizeMs ?? (strategy === "stabilize" ? 700 : 200)),
    remaining()
  );
  if (stabilize > 0) {
    await page.waitForTimeout(stabilize);
  }

  if (opts.scrollForLazyLoad !== false && (opts.scrollDepthPx ?? 2400) > 0) {
    const depth = Math.min(opts.scrollDepthPx ?? 2400, 12_000);
    await page
      .evaluate(async (maxY) => {
        const target = Math.min(document.body.scrollHeight, maxY);
        const steps = Math.max(2, Math.min(6, Math.ceil(target / 800)));
        for (let i = 1; i <= steps; i++) {
          window.scrollTo(0, Math.floor((target * i) / steps));
          await new Promise((r) => setTimeout(r, 180));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 200));
      }, depth)
      .catch(() => {});

    // After scroll, give lazy network a brief chance to settle
    if (strategy === "stabilize" || strategy === "networkidle") {
      await page
        .waitForLoadState("networkidle", { timeout: Math.min(remaining(), 4_000) })
        .catch(() => {});
    }
  }

  const expandRaw = opts.expandSelectors ?? "";
  const expandList = expandRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  for (const sel of expandList) {
    try {
      const loc = page.locator(sel).first();
      if ((await loc.count()) === 0) continue;
      await loc.click({ timeout: Math.min(remaining(), 2_500), force: false });
      await page.waitForTimeout(Math.min(350, remaining()));
    } catch {
      // Invalid / obscured — skip; do not fail the whole check
    }
  }

  // Stabilize animations / transitions that cause false visual diffs
  await page
    .addStyleTag({
      content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
    })
    .catch(() => {});

  await page.waitForTimeout(Math.min(strategy === "dom" ? 150 : 400, remaining()));
}

export async function removeDynamicElements(
  page: Page,
  options: {
    ignoreAds?: boolean;
    ignoreCookies?: boolean;
    ignoreSelectors?: string;
  }
): Promise<{ adsRemoved: number; cookiesRemoved: number; customRemoved: number }> {
  let adsRemoved = 0;
  let cookiesRemoved = 0;
  let customRemoved = 0;

  if (options.ignoreAds !== false) {
    for (const selector of getAdSelectors()) {
      const count = await page.evaluate((sel) => {
        const nodes = document.querySelectorAll(sel);
        const n = nodes.length;
        nodes.forEach((el) => el.remove());
        return n;
      }, selector);
      adsRemoved += count;
    }
  }

  if (options.ignoreCookies !== false) {
    for (const selector of getCookieBannerSelectors()) {
      const count = await page.evaluate((sel) => {
        const nodes = document.querySelectorAll(sel);
        const n = nodes.length;
        nodes.forEach((el) => el.remove());
        return n;
      }, selector);
      cookiesRemoved += count;
    }

    // Dismiss common consent buttons (noise reduction only — not anti-bot evasion)
    await page
      .evaluate(() => {
        const labels = ["accept", "agree", "got it", "ok", "allow all", "принять", "согласен"];
        document.querySelectorAll("button, a[role='button']").forEach((el) => {
          const text = el.textContent?.toLowerCase().trim() ?? "";
          if (labels.some((l) => text.includes(l)) && text.length < 30) {
            (el as HTMLElement).click?.();
          }
        });
      })
      .catch(() => {});
  }

  const customSelectors = (options.ignoreSelectors ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);

  for (const selector of customSelectors) {
    try {
      const count = await page.evaluate((sel) => {
        const nodes = document.querySelectorAll(sel);
        const n = nodes.length;
        nodes.forEach((el) => el.remove());
        return n;
      }, selector);
      customRemoved += count;
    } catch {
      // Invalid selector — skip
    }
  }

  return { adsRemoved, cookiesRemoved, customRemoved };
}
