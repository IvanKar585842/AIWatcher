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
    label: "A page you own",
    detail,
  };
}

/** Suggest how to watch a URL from the HTML we already fetched. Does not fetch. */
export function recommendMonitorSetup(rawUrl: string, html: string): MonitorRecommendation {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return webpage("Enter the full address of a page your company owns.");
  }

  if (githubReleaseTarget(url)) {
    return {
      sourceType: "release",
      watchScope: "page",
      label: "Releases you publish",
      detail: "New versions come from the releases page. Older tags leaving the latest page are not treated as deletions.",
    };
  }

  if (looksLikeFeed(url) || (isNewsIndex(url) && feedAlternate(html, url.toString()))) {
    return {
      sourceType: "news_feed",
      watchScope: "page",
      label: "A feed you publish",
      detail: "New and updated items are compared. A story falling off the latest page is not marked deleted.",
    };
  }

  const structured = extractStructuredFields(html, html.replace(/<[^>]+>/g, " "));
  if (structured.listingsFound) {
    return {
      sourceType: "webpage",
      watchScope: "page",
      label: "A catalog you publish",
      detail: "Each product on your page is compared by name and price.",
    };
  }

  if ((structured.prices?.length ?? 0) > 0) {
    return {
      sourceType: "webpage",
      watchScope: "structured",
      label: "A product page you publish",
      detail: "The price and availability you publish are compared. A challenge page does not replace the last good snapshot.",
    };
  }

  return webpage("The text on your page is compared. A browser runs only when the page is an empty script shell.");
}
