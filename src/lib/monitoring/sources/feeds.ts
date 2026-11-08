import { makeRecord } from "./records";
import type { SourceKind, SourceRecord } from "./types";

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!match) return null;
  const text = decode(match[1]);
  return text || null;
}

function atomLink(block: string): string | null {
  const match = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return match?.[1] ?? tag(block, "link");
}

function blocks(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "gi"))].map((match) => match[1]);
}

export function parseFeed(xml: string, feedUrl: string, sourceType: SourceKind, keywords: string[] = []): SourceRecord[] {
  const publisher = tag(xml, "title");
  const chunks = blocks(xml, "item");
  const entries = chunks.length > 0 ? chunks : blocks(xml, "entry");
  const records: SourceRecord[] = [];
  for (const chunk of entries) {
    const title = tag(chunk, "title");
    const summary = tag(chunk, "description") ?? tag(chunk, "summary");
    const content = tag(chunk, "content:encoded") ?? tag(chunk, "content") ?? summary;
    const link = atomLink(chunk);
    const id = tag(chunk, "guid") ?? tag(chunk, "id") ?? link ?? title;
    if (!id) continue;
    const haystack = `${title ?? ""} ${summary ?? ""} ${content ?? ""}`.toLowerCase();
    if (keywords.length > 0 && !keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) continue;
    records.push(
      makeRecord({
        sourceType,
        adapter: "feed",
        id: id.slice(0, 300),
        title,
        url: absolute(link, feedUrl),
        summary,
        content,
        publishedAt: tag(chunk, "pubDate") ?? tag(chunk, "published") ?? tag(chunk, "updated"),
        updatedAt: tag(chunk, "updated") ?? tag(chunk, "dc:date"),
        author: tag(chunk, "author") ?? tag(chunk, "dc:creator") ?? tag(chunk, "name"),
        publisher,
        tags: categories(chunk),
        imageUrl: image(chunk),
        price: null,
        currency: null,
        availability: null,
        seller: null,
        variant: null,
        version: versionFrom(title),
        condition: null,
      })
    );
  }
  return records;
}

function categories(block: string): string[] {
  return [...block.matchAll(/<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi)]
    .map((match) => decode(match[1]))
    .filter(Boolean)
    .slice(0, 8);
}

function image(block: string): string | null {
  const enclosure = block.match(/<enclosure[^>]*url=["']([^"']+)["']/i);
  if (enclosure) return enclosure[1];
  const media = block.match(/<media:content[^>]*url=["']([^"']+)["']/i);
  return media?.[1] ?? null;
}

function absolute(link: string | null, base: string): string | null {
  if (!link) return null;
  try {
    return new URL(link, base).toString();
  } catch {
    return link;
  }
}

function versionFrom(title: string | null): string | null {
  return title?.match(/\bv?\d+\.\d+(?:\.\d+)?\b/)?.[0] ?? null;
}

export function feedAlternate(html: string, pageUrl: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!/\brel=["'][^"']*\balternate\b/i.test(tag)) continue;
    const type = tag.match(/\btype=["']([^"']+)["']/i)?.[1] ?? "";
    if (!/rss|atom|xml/i.test(type)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) return absolute(href, pageUrl);
  }
  return null;
}
