import { extractStructuredFields } from "./structured-compare";
import { isNewsIndex } from "./sources/known-sites";
import { looksLikeFeed } from "./sources/describe";
import { feedAlternate } from "./sources/feeds";
import { githubReleaseTarget } from "./sources/releases";
import type { SourceKind } from "./sources/types";

export type MonitorRecommendation = {
  sourceType: SourceKind;
  watchScope: "page" | "structured";
  label: string;
  detail: string;
};

function webpage(detail: string): MonitorRecommendation {
  return {
    sourceType: "webpage",
    watchScope: "page",
    label: "General webpage",
    detail,
  };
}

/** Suggest how to watch a URL from the HTML we already fetched. Does not fetch. */
export function recommendMonitorSetup(rawUrl: string, html: string): MonitorRecommendation {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return webpage("Enter a full public URL.");
  }

  if (githubReleaseTarget(url)) {
    return {
      sourceType: "release",
      watchScope: "page",
      label: "Software releases",
      detail: "New versions come from the public releases API. Older tags leaving the latest page are not treated as deletions.",
    };
  }

  if (looksLikeFeed(url) || (isNewsIndex(url) && feedAlternate(html, url.toString()))) {
    return {
      sourceType: "news_feed",
      watchScope: "page",
      label: "News feed",
      detail: "New and updated items are compared by a stable id. A story falling off the latest page is not marked deleted.",
    };
  }

  const structured = extractStructuredFields(html, html.replace(/<[^>]+>/g, " "));
  if (structured.listingsFound) {
    return {
      sourceType: "webpage",
      watchScope: "page",
      label: "Product catalog",
      detail: "Each product is compared by name and price. The first price on the page is not treated as the whole catalog.",
    };
  }

  if ((structured.prices?.length ?? 0) > 0) {
    return {
      sourceType: "webpage",
      watchScope: "structured",
      label: "Product page",
      detail: "The published product price and availability are compared. A challenge page does not replace the last good snapshot.",
    };
  }

  return webpage("The main public text is compared. A browser runs only when the page is an empty script shell.");
}
