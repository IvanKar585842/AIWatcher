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

  await page.waitForTimeout(1000);
}

export async function removeDynamicElements(
  page: Page,
  options: { ignoreAds?: boolean; ignoreCookies?: boolean }
): Promise<{ adsRemoved: number; cookiesRemoved: number }> {
  let adsRemoved = 0;
  let cookiesRemoved = 0;

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

  return { adsRemoved, cookiesRemoved };
}
