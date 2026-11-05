import { runSourceCheck } from "./sources/registry";
import type { SourceRunOptions } from "./sources/types";

export interface OfficialContent {
  rawHtml: string;
  metadata: Record<string, unknown>;
}

/**
 * Structured sources run before Scrapling.
 * Amazon, eBay, Etsy, and marketplaces without a permitted API never fall through to a browser.
 * Returns null for ordinary public webpages.
 */
export async function tryOfficialSource(
  url: string,
  _timeoutMs: number,
  options?: SourceRunOptions
): Promise<OfficialContent | null> {
  return runSourceCheck(url, options);
}
