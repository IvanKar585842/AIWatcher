import type { MonitoringMode } from "@prisma/client";

export interface StructuredPrice {
  raw: string;
  value: number;
  currency: string | null;
}

export interface StructuredItem {
  key: string;
  title: string;
  url?: string;
  price?: number | null;
}

export interface StructuredLink {
  href: string;
  text: string;
}

export interface StructuredSnapshot {
  title?: string;
  description?: string;
  prices?: StructuredPrice[];
  availability?: "in_stock" | "out_of_stock" | "preorder" | "unknown";
  items?: StructuredItem[];
  listingsFound?: boolean;
  links?: StructuredLink[];
  images?: string[];
  version?: string | null;
}

export interface StructuredComparison {
  changed: boolean;
  decisive: boolean;
  summaryLines: string[];
}

const PRICE_RE =
  /(?:USD|EUR|GBP|\$|€|£)\s*\d{1,7}(?:[.,]\d{2})?|\d{1,7}(?:[.,]\d{2})?\s*(?:USD|EUR|GBP|\$|€|£)/gi;

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
];

export function parsePriceValue(raw: string): number | null {
  const match = raw.match(/\d[\d.,]*/);
  if (!match) return null;
  let token = match[0];
  if (token.includes(",") && token.includes(".")) {
    token =
      token.lastIndexOf(",") > token.lastIndexOf(".")
        ? token.replace(/\./g, "").replace(",", ".")
        : token.replace(/,/g, "");
  } else if (/,\d{2}$/.test(token)) {
    token = token.replace(",", ".");
  } else {
    token = token.replace(/,/g, "");
  }
  const value = Number(token);
  return Number.isFinite(value) ? value : null;
}

export function currencyOf(raw: string): string | null {
  if (/\$|USD/i.test(raw)) return "USD";
  if (/€|EUR/i.test(raw)) return "EUR";
  if (/£|GBP/i.test(raw)) return "GBP";
  return null;
}

export function availabilityOf(text: string): StructuredSnapshot["availability"] {
  if (/out\s*of\s*stock|sold\s*out|unavailable/i.test(text)) return "out_of_stock";
  if (/pre-?order/i.test(text)) return "preorder";
  if (/in\s*stock|available|add\s*to\s*cart/i.test(text)) return "in_stock";
  return "unknown";
}

function normalizeHref(href: string): string {
  try {
    const url = new URL(href, "https://placeholder.local");
    for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
    url.hash = "";
    if (url.hostname === "placeholder.local") {
      return `${url.pathname}${url.search}`;
    }
    return url.toString();
  } catch {
    return href.split("#")[0] ?? href;
  }
}

export function extractStructuredFields(html: string, text: string): StructuredSnapshot {
  const visibleLength = text.replace(/\s+/g, " ").trim().length;
  const offer = readProductOffer(html) ?? readMicrodataOffer(html);
  const cards = mergeItems(readJsonLdItems(html), readProductCards(html));
  const grid = cards.length >= 3;
  const prices: StructuredPrice[] = [];
  const seen = new Set<string>();
  if (offer?.price && !grid) {
    prices.push(offer.price);
    seen.add(offer.price.raw);
  }
  if (!offer?.price && !grid && visibleLength <= 8000) {
    for (const match of text.matchAll(PRICE_RE)) {
      const raw = match[0].replace(/\s+/g, " ").trim();
      if (!raw || seen.has(raw)) continue;
      seen.add(raw);
      const value = parsePriceValue(raw);
      if (value == null) continue;
      prices.push({ raw, value, currency: currencyOf(raw) });
      if (prices.length >= 8) break;
    }
  }

  const version = text.match(/\bv?\d+\.\d+\.\d+(?:[-+][\w.]+)?\b/)?.[0] ?? null;
  const titleTag = decodeEntities(
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? ""
  );

  return {
    title: (offer?.name ?? titleTag)?.slice(0, 300) || undefined,
    prices,
    availability: grid ? "unknown" : offer?.availability ?? (visibleLength > 8000 ? "unknown" : availabilityOf(text)),
    items: grid ? cards : [],
    listingsFound: grid,
    links: [],
    images: [],
    version,
  };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function mergeItems(...groups: StructuredItem[][]): StructuredItem[] {
  const seen = new Set<string>();
  const items: StructuredItem[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      items.push(item);
      if (items.length >= 24) return items;
    }
  }
  return items;
}

function readJsonLdItems(html: string): StructuredItem[] {
  const items: StructuredItem[] = [];
  const seen = new Set<string>();
  const push = (name: unknown, price: number | null) => {
    if (typeof name !== "string") return;
    const title = decodeEntities(name.replace(/\s+/g, " ").trim());
    const key = title.toLowerCase();
    if (title.length < 2 || seen.has(key)) return;
    seen.add(key);
    items.push({ key, title: title.slice(0, 140), price });
  };
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    const typeValue = record["@type"];
    const types = (Array.isArray(typeValue) ? typeValue : typeValue ? [typeValue] : []).map((item) => String(item));
    if (types.some((item) => item === "Product" || item.endsWith("/Product"))) {
      const offers = record.offers;
      const first = Array.isArray(offers) ? offers[0] : offers;
      const price = first && typeof first === "object" ? offerPrice(first as Record<string, unknown>) : undefined;
      push(record.name, price?.value ?? null);
    }
    if (record.itemListElement) visit(record.itemListElement);
    if (record.item) visit(record.item);
    if (record["@graph"]) visit(record["@graph"]);
  };
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(match[1].trim()) as unknown);
    } catch {
      continue;
    }
  }
  return items;
}

function readProductCards(html: string): StructuredItem[] {
  const items: StructuredItem[] = [];
  const seen = new Set<string>();
  const marker = /class=["'][^"']*(?:product_pod|product-card|product-item|product-tile|product-grid__item|type-product|wc-block-grid__product)[^"']*["']/gi;
  for (const match of html.matchAll(marker)) {
    const block = html.slice(match.index ?? 0, (match.index ?? 0) + 1800);
    const rawTitle =
      block.match(/<a\b[^>]*title=["']([^"']+)["']/i)?.[1] ??
      block.match(/class=["'][^"']*(?:woocommerce-loop-product__title|product-title|card-title)[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] ??
      block.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] ??
      "";
    const title = decodeEntities(rawTitle.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (title.length < 2) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const priceText = block.match(PRICE_RE)?.[0];
    items.push({
      key,
      title: title.slice(0, 140),
      price: priceText ? parsePriceValue(priceText) : null,
    });
    if (items.length >= 24) break;
  }
  return items;
}

function schemaAvailability(value: unknown): StructuredSnapshot["availability"] | undefined {
  const text = String(value ?? "");
  if (/OutOfStock/i.test(text)) return "out_of_stock";
  if (/PreOrder|PreSale/i.test(text)) return "preorder";
  if (/InStock/i.test(text)) return "in_stock";
  return undefined;
}

function offerPrice(record: Record<string, unknown>): StructuredPrice | undefined {
  const priceRaw = record.price ?? record.lowPrice;
  const currency = typeof record.priceCurrency === "string" ? record.priceCurrency : null;
  const value = typeof priceRaw === "number" ? priceRaw : typeof priceRaw === "string" ? parsePriceValue(priceRaw) : null;
  if (value == null) return undefined;
  return { raw: currency ? `${value} ${currency}` : String(value), value, currency };
}

function readProductOffer(html: string): { name?: string; price?: StructuredPrice; availability?: StructuredSnapshot["availability"] } | null {
  const found: { name?: string; price?: StructuredPrice; availability?: StructuredSnapshot["availability"] } = {};
  const visit = (node: unknown) => {
    if (found.price) return;
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    const typeValue = record["@type"];
    const types = (Array.isArray(typeValue) ? typeValue : typeValue ? [typeValue] : []).map((item) => String(item));
    if (types.some((item) => item === "Product" || item.endsWith("/Product"))) {
      const name = typeof record.name === "string" ? record.name.trim() : undefined;
      const offers = record.offers;
      const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
      if (offerList.length === 0 && name) found.name = found.name ?? name;
      for (const offer of offerList) {
        if (!offer || typeof offer !== "object") continue;
        const row = offer as Record<string, unknown>;
        const price = offerPrice(row);
        const availability = schemaAvailability(row.availability);
        if (price || name) {
          found.name = name;
          found.price = price;
          found.availability = availability;
          if (price) return;
        }
      }
    }
    if (record["@graph"]) visit(record["@graph"]);
  };
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(match[1].trim()) as unknown);
    } catch {
      continue;
    }
    if (found.price) break;
  }
  return found.price || found.name ? found : null;
}

function metaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<(?:meta|span|div)[^>]*(?:property|itemprop|name)=["']${escaped}["'][^>]*(?:content|value)=["']([^"']+)["']`, "i"),
    new RegExp(`<(?:meta|span|div)[^>]*(?:content|value)=["']([^"']+)["'][^>]*(?:property|itemprop|name)=["']${escaped}["']`, "i"),
    new RegExp(`<[^>]*itemprop=["']${escaped}["'][^>]*>\\s*([^<]{1,40})`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return null;
}

function readMicrodataOffer(html: string): { name?: string; price?: StructuredPrice; availability?: StructuredSnapshot["availability"] } | null {
  const amount = metaContent(html, "product:price:amount") ?? metaContent(html, "price");
  const currency = metaContent(html, "product:price:currency") ?? metaContent(html, "priceCurrency");
  const value = amount ? parsePriceValue(amount) : null;
  const name = metaContent(html, "name") ?? undefined;
  const availabilityText =
    metaContent(html, "availability") ??
    html.match(/<link[^>]*itemprop=["']availability["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
    html.match(/<link[^>]*href=["']([^"']+)["'][^>]*itemprop=["']availability["']/i)?.[1] ??
    "";
  const availability = schemaAvailability(availabilityText) ?? (availabilityText ? availabilityOf(availabilityText) : undefined);
  if (value == null && !name) return null;
  return {
    name,
    price: value == null ? undefined : { raw: currency ? `${value} ${currency}` : amount ?? String(value), value, currency },
    availability: availability === "unknown" ? undefined : availability,
  };
}

export function readStructured(metadata: Record<string, unknown> | null | undefined): StructuredSnapshot | null {
  const value = metadata?.structured;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as StructuredSnapshot;
}

function priceChanged(previous: StructuredSnapshot, current: StructuredSnapshot): StructuredComparison | null {
  const prev = previous.prices?.[0];
  const next = current.prices?.[0];
  if (!prev || !next) return null;
  const changed = Math.abs(prev.value - next.value) >= 0.009;
  return {
    changed,
    decisive: true,
    summaryLines: changed
      ? [`Price changed from ${prev.raw} to ${next.raw}`]
      : ["Price unchanged"],
  };
}

function availabilityChanged(
  previous: StructuredSnapshot,
  current: StructuredSnapshot
): StructuredComparison | null {
  const prev = previous.availability;
  const next = current.availability;
  if (!prev || !next || prev === "unknown" || next === "unknown") return null;
  const changed = prev !== next;
  return {
    changed,
    decisive: true,
    summaryLines: changed
      ? [`Availability changed from ${prev.replace(/_/g, " ")} to ${next.replace(/_/g, " ")}`]
      : ["Availability unchanged"],
  };
}

function itemsChanged(previous: StructuredSnapshot, current: StructuredSnapshot): StructuredComparison | null {
  if (!previous.listingsFound || !current.listingsFound) return null;
  const prev = new Map((previous.items ?? []).map((item) => [item.key, item]));
  const next = new Map((current.items ?? []).map((item) => [item.key, item]));
  const added = [...next.values()].filter((item) => !prev.has(item.key));
  const removed = [...prev.values()].filter((item) => !next.has(item.key));
  const lines: string[] = [];
  for (const item of added.slice(0, 5)) lines.push(`New item: ${item.title}`);
  for (const item of removed.slice(0, 5)) lines.push(`Removed item: ${item.title}`);
  for (const item of next.values()) {
    const old = prev.get(item.key);
    if (!old || old.price == null || item.price == null) continue;
    if (Math.abs(old.price - item.price) < 0.009) continue;
    lines.push(`Price changed for ${item.title}: ${old.price} -> ${item.price}`);
    if (lines.length >= 8) break;
  }
  return {
    changed: added.length > 0 || removed.length > 0 || lines.some((line) => line.startsWith("Price changed")),
    decisive: true,
    summaryLines: lines.length > 0 ? lines : ["Listing set unchanged"],
  };
}

function linksChanged(previous: StructuredSnapshot, current: StructuredSnapshot): string[] {
  const prev = new Set((previous.links ?? []).map((link) => normalizeHref(link.href)));
  const next = new Set((current.links ?? []).map((link) => normalizeHref(link.href)));
  if (prev.size === 0 || next.size === 0) return [];
  const added = [...next].filter((href) => !prev.has(href));
  const removed = [...prev].filter((href) => !next.has(href));
  const lines: string[] = [];
  for (const href of added.slice(0, 4)) lines.push(`Link added: ${href}`);
  for (const href of removed.slice(0, 4)) lines.push(`Link removed: ${href}`);
  return lines;
}

/**
 * Field-level comparison. Decisive modes (price, availability, listings)
 * override noisy HTML hashes. Other modes only contribute explanation lines.
 */
export function compareStructuredFields(input: {
  mode: MonitoringMode;
  previous: StructuredSnapshot | null;
  current: StructuredSnapshot | null;
}): StructuredComparison | null {
  const { previous, current, mode } = input;
  if (!previous || !current) return null;

  if (mode === "PRICE_DETECTION") {
    return priceChanged(previous, current);
  }
  if (mode === "PRODUCT_AVAILABILITY") {
    return availabilityChanged(previous, current);
  }
  if (mode === "JOB_LISTINGS") {
    return itemsChanged(previous, current);
  }

  const lines = [
    ...linksChanged(previous, current),
    ...(itemsChanged(previous, current)?.summaryLines.filter((line) => !line.includes("unchanged")) ?? []),
  ];
  const price = priceChanged(previous, current);
  if (price?.changed) lines.unshift(...price.summaryLines);

  if (lines.length === 0) return null;
  return { changed: true, decisive: false, summaryLines: lines.slice(0, 8) };
}
