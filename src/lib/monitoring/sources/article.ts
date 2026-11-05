import { MonitorCheckError } from "../check-error";
import { containsAntiBotChallenge } from "../compatibility";
import { fetchWithSafeRedirects } from "@/lib/security/url";
import { makeRecord } from "./records";
import type { FetchLike, SourceRecord } from "./types";

export async function fetchArticle(url: string, fetchImpl?: FetchLike): Promise<SourceRecord> {
  const run = fetchImpl ?? fetchWithSafeRedirects;
  const response = await run(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot; monitoring service)",
    },
  });
  if (!response.ok) throw new MonitorCheckError(`HTTP ${response.status} loading article`, response.status >= 500);
  const html = await response.text();
  if (containsAntiBotChallenge(html)) {
    throw new MonitorCheckError("Anti-bot challenge detected on this article. Use the site's RSS feed instead.", true);
  }
  const title = meta(html, "og:title") ?? text(html, "title");
  const canonical = linkRel(html, "canonical") ?? url;
  const description = meta(html, "og:description") ?? metaName(html, "description");
  const content = articleText(html);
  if (!title && !content) {
    throw new MonitorCheckError("Partial extraction: the article text was not in the HTML response. Use the site's RSS feed.", true);
  }
  return makeRecord({
    sourceType: "news_article",
    adapter: "article",
    id: canonical,
    title,
    url: canonical,
    summary: description,
    content: content ?? description,
    publishedAt: meta(html, "article:published_time") ?? timeTag(html),
    updatedAt: meta(html, "article:modified_time"),
    author: metaName(html, "author") ?? meta(html, "article:author"),
    publisher: meta(html, "og:site_name"),
    tags: [],
    imageUrl: meta(html, "og:image"),
    price: null,
    currency: null,
    availability: null,
    seller: null,
    variant: null,
    version: null,
    condition: null,
  });
}

function meta(html: string, property: string): string | null {
  const match = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*>`, "i"));
  return match ? attr(match[0], "content") : null;
}

function metaName(html: string, name: string): string | null {
  const match = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*>`, "i"));
  return match ? attr(match[0], "content") : null;
}

function linkRel(html: string, rel: string): string | null {
  const match = html.match(new RegExp(`<link[^>]*rel=["']${rel}["'][^>]*>`, "i"));
  return match ? attr(match[0], "href") : null;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function text(html: string, tagName: string): string | null {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? clean(match[1]) : null;
}

function timeTag(html: string): string | null {
  const match = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function articleText(html: string): string | null {
  const match = html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i) ?? html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
  const text = match ? clean(match[1]) : null;
  return text && text.length > 40 ? text.slice(0, 4000) : null;
}

function clean(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
