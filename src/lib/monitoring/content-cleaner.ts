import { createHash } from "crypto";

const AD_SELECTORS = [
  '[class*="ad-"]',
  '[class*="ads-"]',
  '[class*="advert"]',
  '[id*="ad-"]',
  '[id*="ads-"]',
  '[data-ad]',
  '[data-ad-slot]',
  "iframe[src*='doubleclick']",
  "iframe[src*='googlesyndication']",
  ".google-auto-placed",
  ".adsbygoogle",
];

const TRACKING_PATTERNS = [
  /<script[\s\S]*?<\/script>/gi,
  /<noscript[\s\S]*?<\/noscript>/gi,
  /<style[\s\S]*?<\/style>/gi,
  /<!--[\s\S]*?-->/g,
  /<link[^>]*rel=["']stylesheet["'][^>]*>/gi,
  /<meta[^>]*>/gi,
  /data-[a-z-]+="[^"]*"/gi,
  /nonce="[^"]*"/gi,
];

const DYNAMIC_PATTERNS = [
  /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z?\b/g,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\b\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)?\b/g,
  /\b\d+\s*(seconds?|minutes?|hours?|days?)\s*ago\b/gi,
  /\bjust\s*now\b/gi,
  /\bupdated\s*:?\s*\d+/gi,
  /\blast\s*(seen|updated|modified)\s*:?\s*[\w\s,:-]+/gi,
  /\bcsrf[_-]?token["\s:=]+[\w-]+/gi,
  /\bsession[_-]?id["\s:=]+[\w-]+/gi,
];

const RANDOM_ID_PATTERNS = [
  /\bid="[a-f0-9]{8,}"/gi,
  /\bclass="[^"]*\b[a-f0-9]{8,}\b[^"]*"/gi,
  /\b_[a-f0-9]{8,}\b/g,
  /\buuid["\s:=]+[a-f0-9-]{36}/gi,
];

export interface CleanOptions {
  ignoreTimestamps?: boolean;
  ignoreRandomIds?: boolean;
  ignoreDynamicContent?: boolean;
}

export function cleanHtml(html: string, options: CleanOptions = {}): string {
  const {
    ignoreTimestamps = true,
    ignoreRandomIds = true,
    ignoreDynamicContent = true,
  } = options;

  let cleaned = html;

  for (const pattern of TRACKING_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  if (ignoreTimestamps || ignoreDynamicContent) {
    for (const pattern of DYNAMIC_PATTERNS) {
      cleaned = cleaned.replace(pattern, "[TIMESTAMP]");
    }
  }

  if (ignoreRandomIds) {
    for (const pattern of RANDOM_ID_PATTERNS) {
      cleaned = cleaned.replace(pattern, "");
    }
  }

  cleaned = cleaned
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<img[^>]*>/gi, "[IMAGE]")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();

  return cleaned;
}

export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function getAdSelectors(): string[] {
  return AD_SELECTORS;
}

export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s$€£¥.,%-]/g, "")
    .trim();
}

export function hasMeaningfulChange(oldContent: string, newContent: string): boolean {
  const oldNorm = normalizeForComparison(oldContent);
  const newNorm = normalizeForComparison(newContent);

  if (oldNorm === newNorm) return false;

  const lengthDiff = Math.abs(oldNorm.length - newNorm.length);
  const maxLen = Math.max(oldNorm.length, newNorm.length);

  if (maxLen > 0 && lengthDiff / maxLen < 0.005) {
    return false;
  }

  return true;
}
