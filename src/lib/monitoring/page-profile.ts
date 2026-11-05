import { normalizeForComparison } from "./content-cleaner";

export type WatchScope =
  | "page"
  | "section"
  | "keyword"
  | "links"
  | "structured"
  | "images"
  | "numbers"
  | "tables"
  | "files";

export interface PageProfile {
  headings: string[];
  paragraphs: string[];
  links: string[];
  images: string[];
  numbers: string[];
  tables: string[];
  structured: string[];
}

export interface PageProfileDiff {
  changed: boolean;
  summaryLines: string[];
}

const TRACKING = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "mc_cid", "ref"];

/** Main or article body when it actually contains text. Chrome stays outside the comparison. */
export function extractMainRegion(html: string): string | null {
  const match = html.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i);
  if (!match) return null;
  const text = stripTags(match[2]).replace(/\s+/g, " ").trim();
  if (text.length < 80) return null;
  return match[2];
}

export function comparablePair(previousHtml: string, currentHtml: string): { previous: string; current: string } | null {
  const previous = extractMainRegion(previousHtml);
  const current = extractMainRegion(currentHtml);
  if (!previous || !current) return null;
  return { previous, current };
}

export function extractPageProfile(rawHtml: string, cleanedHtml: string): PageProfile {
  const html = extractMainRegion(cleanedHtml || rawHtml) ?? (cleanedHtml || rawHtml);
  return {
    headings: unique(matches(html, /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi).map(stripTags)),
    paragraphs: unique(paragraphs(html)),
    links: unique(links(html)),
    images: unique(images(html)),
    numbers: unique(numbers(stripTags(html))),
    tables: unique(tableRows(html)),
    structured: unique(structuredData(rawHtml)),
  };
}

export function comparePageProfiles(
  previous: PageProfile | null,
  current: PageProfile | null,
  scope: WatchScope = "page",
  keywords: string[] = []
): PageProfileDiff | null {
  if (!previous || !current) return null;
  const lines: string[] = [];
  const full = scope === "page" || scope === "section";
  const want = (name: WatchScope) => full || scope === name;

  if (full || scope === "keyword") {
    const prevText = filterKeywords(previous.paragraphs.concat(previous.headings), keywords, scope);
    const nextText = filterKeywords(current.paragraphs.concat(current.headings), keywords, scope);
    pushSet(lines, "Heading or text added", added(previous.headings, current.headings));
    pushSet(lines, "Heading or text removed", removed(previous.headings, current.headings));
    pushSet(lines, "Text added", added(prevText, nextText).filter((line) => !current.headings.includes(line)));
    pushSet(lines, "Text removed", removed(prevText, nextText).filter((line) => !previous.headings.includes(line)));
  }
  if (want("links")) {
    pushSet(lines, "Link added", added(previous.links, current.links));
    pushSet(lines, "Link removed", removed(previous.links, current.links));
  }
  if (want("images")) {
    pushSet(lines, "Image added", added(previous.images, current.images));
    pushSet(lines, "Image removed", removed(previous.images, current.images));
  }
  if (want("numbers")) {
    pushSet(lines, "Number added", added(previous.numbers, current.numbers));
    pushSet(lines, "Number removed", removed(previous.numbers, current.numbers));
  }
  if (want("tables")) {
    pushSet(lines, "Table row added", added(previous.tables, current.tables));
    pushSet(lines, "Table row removed", removed(previous.tables, current.tables));
  }
  if (want("structured")) {
    pushSet(lines, "Structured data added", added(previous.structured, current.structured));
    pushSet(lines, "Structured data removed", removed(previous.structured, current.structured));
  }

  return {
    changed: lines.length > 0,
    summaryLines: lines.slice(0, 12),
  };
}

export function readPageProfile(metadata: Record<string, unknown> | null | undefined): PageProfile | null {
  const value = metadata?.pageProfile;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const profile = value as Partial<PageProfile>;
  if (!Array.isArray(profile.headings) || !Array.isArray(profile.links)) return null;
  return {
    headings: profile.headings ?? [],
    paragraphs: profile.paragraphs ?? [],
    links: profile.links ?? [],
    images: profile.images ?? [],
    numbers: profile.numbers ?? [],
    tables: profile.tables ?? [],
    structured: profile.structured ?? [],
  };
}

function filterKeywords(lines: string[], keywords: string[], scope: WatchScope): string[] {
  if (scope !== "keyword" || keywords.length === 0) return lines;
  const needles = keywords.map((keyword) => keyword.toLowerCase());
  return lines.filter((line) => needles.some((needle) => line.toLowerCase().includes(needle)));
}

function pushSet(lines: string[], label: string, items: string[]) {
  for (const item of items.slice(0, 3)) lines.push(`${label}: ${item.slice(0, 140)}`);
}

function added(previous: string[], current: string[]): string[] {
  const prev = new Set(previous);
  return current.filter((item) => !prev.has(item));
}

function removed(previous: string[], current: string[]): string[] {
  const next = new Set(current);
  return previous.filter((item) => !next.has(item));
}

function paragraphs(html: string): string[] {
  return matches(html, /<(?:p|li|td|button|a)[^>]*>([\s\S]*?)<\/(?:p|li|td|button|a)>/gi)
    .map(stripTags)
    .filter((line) => line.length > 12 && !/^\[timestamp\]$/i.test(line));
}

function links(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = normalizeUrl(match[1]);
    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
    const text = stripTags(match[2]).slice(0, 80);
    found.push(text ? `${text} -> ${href}` : href);
  }
  return found;
}

function images(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*>/gi)].flatMap((match) => {
    const src = normalizeUrl(attr(match[0], "src") ?? "");
    if (!src || src.startsWith("data:")) return [];
    const alt = attr(match[0], "alt");
    return [alt ? `${src} alt=${alt}` : src];
  });
}

function numbers(text: string): string[] {
  return [...text.matchAll(/(?:[$€£]\s*)?\d{1,3}(?:[ ,]\d{3})*(?:[.,]\d+)?(?:\s?(?:USD|EUR|GBP|%))?/gi)]
    .map((match) => match[0].replace(/\s+/g, " ").trim())
    .filter((value) => /\d/.test(value) && !/^\d{4}$/.test(value));
}

function tableRows(html: string): string[] {
  const rows: string[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = matches(row[1], /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi).map(stripTags).filter(Boolean);
    if (cells.length > 1) rows.push(cells.join(" | "));
  }
  return rows;
}

function structuredData(rawHtml: string): string[] {
  const lines: string[] = [];
  for (const match of rawHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(match[1].trim()) as unknown;
      lines.push(...flattenJsonLd(data));
    } catch {
      lines.push("json-ld: unparsed");
    }
  }
  const title = meta(rawHtml, "og:title");
  const description = meta(rawHtml, "og:description") ?? metaName(rawHtml, "description");
  const canonical = rawHtml.match(/<link[^>]*rel=["']canonical["'][^>]*>/i);
  const canonicalHref = canonical ? attr(canonical[0], "href") : null;
  const price = meta(rawHtml, "product:price:amount");
  const currency = meta(rawHtml, "product:price:currency");
  if (title) lines.push(`og:title=${title}`);
  if (description) lines.push(`description=${description.slice(0, 160)}`);
  if (canonicalHref) lines.push(`canonical=${normalizeUrl(canonicalHref)}`);
  if (price) lines.push(`price=${price} ${currency ?? ""}`.trim());
  return lines;
}

function flattenJsonLd(data: unknown, prefix = "json-ld"): string[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) return data.flatMap((item) => flattenJsonLd(item, prefix));
  const record = data as Record<string, unknown>;
  const type = typeof record["@type"] === "string" ? record["@type"] : "object";
  const name = typeof record.name === "string" ? record.name : typeof record.headline === "string" ? record.headline : "";
  const offers = record.offers && typeof record.offers === "object" ? (record.offers as Record<string, unknown>) : null;
  const price = offers && (offers.price ?? offers.lowPrice);
  const availability = offers && typeof offers.availability === "string" ? offers.availability.split("/").pop() : "";
  const line = [`${prefix}:${type}`, name, price != null ? `price=${price}` : "", availability ? `availability=${availability}` : ""]
    .filter(Boolean)
    .join(" ");
  return line ? [line.slice(0, 180)] : [];
}

function meta(html: string, property: string): string | null {
  const match = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*>`, "i"));
  return match ? attr(match[0], "content") : null;
}

function metaName(html: string, name: string): string | null {
  const match = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*>`, "i"));
  return match ? attr(match[0], "content") : null;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function matches(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((match) => match[1] ?? "");
}

function stripTags(value: string): string {
  return normalizeForComparison(value.replace(/<[^>]+>/g, " "));
}

function unique(items: string[], limit = 30): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const value = item.replace(/\s+/g, " ").trim().slice(0, 160);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value, "https://placeholder.local");
    for (const key of TRACKING) url.searchParams.delete(key);
    url.hash = "";
    const rendered = url.hostname === "placeholder.local" ? `${url.pathname}${url.search}` : url.toString();
    return rendered;
  } catch {
    return value.split("#")[0] ?? value;
  }
}
