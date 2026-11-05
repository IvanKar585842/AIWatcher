import { makeRecord } from "./records";
import type { SourceRecord } from "./types";

export function parseNewsSitemap(xml: string, limit: number): SourceRecord[] {
  const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].slice(0, limit);
  const records: SourceRecord[] = [];
  for (const match of urls) {
    const block = match[1];
    const loc = text(block, "loc");
    if (!loc) continue;
    const title = text(block, "news:title") ?? text(block, "title");
    records.push(
      makeRecord({
        sourceType: "news_feed",
        adapter: "news-sitemap",
        id: loc,
        title,
        url: loc,
        summary: null,
        content: title,
        publishedAt: text(block, "news:publication_date") ?? text(block, "lastmod"),
        updatedAt: text(block, "lastmod"),
        author: null,
        publisher: text(block, "news:name"),
        tags: [text(block, "news:keywords")].filter((tag): tag is string => Boolean(tag)),
        imageUrl: null,
        price: null,
        currency: null,
        availability: null,
        seller: null,
        variant: null,
        version: null,
        condition: null,
      })
    );
  }
  return records;
}

function text(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  const value = match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/\s+/g, " ").trim();
  return value || null;
}
