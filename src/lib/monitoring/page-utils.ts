import type { Page } from "playwright-core";
import { getAdSelectors, getCookieBannerSelectors } from "./content-cleaner";

export async function waitForPageReady(page: Page, timeout: number): Promise<void> {
  const networkIdleTimeout = Math.min(timeout, 20_000);

  try {
    await page.waitForLoadState("networkidle", { timeout: networkIdleTimeout });
  } catch {
    try {
      await page.waitForLoadState("load", { timeout: 8000 });
    } catch {
      // continue — partial load is better than aborting
    }
  }

  await page.waitForSelector("body", { timeout: 5000 }).catch(() => {});

  // Trigger lazy-loaded content
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 800));
    window.scrollTo(0, 0);
  });

  // Stabilize animations / transitions that cause false visual diffs
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
  }).catch(() => {});

  await page.waitForTimeout(1000);
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

    // Dismiss common consent buttons
    await page.evaluate(() => {
      const labels = ["accept", "agree", "got it", "ok", "allow all", "принять", "согласен"];
      document.querySelectorAll("button, a[role='button']").forEach((el) => {
        const text = el.textContent?.toLowerCase().trim() ?? "";
        if (labels.some((l) => text.includes(l)) && text.length < 30) {
          (el as HTMLElement).click?.();
        }
      });
    }).catch(() => {});
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
