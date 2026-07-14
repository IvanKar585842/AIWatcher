import { getFaviconUrl } from "@/lib/utils";
import {
  assertSafeFetchUrl,
  fetchWithSafeRedirects,
  validateMonitorUrl,
} from "@/lib/security/url";

const FETCH_TIMEOUT_MS = 2800;
const MAX_HTML_BYTES = 120_000;
const MAX_PROBE_CANDIDATES = 3;

const ICON_REL =
  /rel=["']([^"']*icon[^"']*|apple-touch-icon[^"']*)["']/i;
const HREF_ATTR = /href=["']([^"']+)["']/i;
const OG_IMAGE =
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i;
const OG_IMAGE_ALT =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i;

function absolutize(base: string, href: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function isSafeHttpUrl(url: string): boolean {
  return validateMonitorUrl(url).ok;
}

/** Prefer square-ish icon assets; skip huge marketing OG images when possible. */
function scoreCandidate(url: string, kind: "icon" | "apple" | "og" | "ico"): number {
  const lower = url.toLowerCase();
  let score = kind === "apple" ? 40 : kind === "icon" ? 50 : kind === "ico" ? 30 : 10;
  if (lower.includes("favicon")) score += 20;
  if (lower.endsWith(".ico")) score += 15;
  if (lower.includes("apple-touch")) score += 10;
  if (/\d{2,3}x\d{2,3}/.test(lower)) score += 5;
  if (kind === "og" && (lower.includes("banner") || lower.includes("cover"))) score -= 20;
  return score;
}

function extractFromHtml(html: string, pageUrl: string): string[] {
  const candidates: Array<{ url: string; score: number }> = [];
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

  for (const tag of linkTags) {
    if (!ICON_REL.test(tag)) continue;
    const hrefMatch = tag.match(HREF_ATTR);
    if (!hrefMatch?.[1]) continue;
    const abs = absolutize(pageUrl, hrefMatch[1].trim());
    if (!abs || !isSafeHttpUrl(abs)) continue;
    const kind = /apple-touch/i.test(tag) ? "apple" : "icon";
    candidates.push({ url: abs, score: scoreCandidate(abs, kind) });
  }

  const og =
    html.match(OG_IMAGE)?.[1]?.trim() || html.match(OG_IMAGE_ALT)?.[1]?.trim();
  if (og) {
    const abs = absolutize(pageUrl, og);
    if (abs && isSafeHttpUrl(abs)) {
      candidates.push({ url: abs, score: scoreCandidate(abs, "og") });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return [...new Set(candidates.map((c) => c.url))];
}

async function probeUrl(url: string): Promise<boolean> {
  try {
    await assertSafeFetchUrl(url);
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(1500),
      headers: { "User-Agent": "WatchFlowingFaviconBot/1.0" },
    });
    if (res.ok) return true;
    // Some CDNs reject HEAD — soft-accept GET for icons under a short timeout
    if (res.status === 405 || res.status === 403) {
      const get = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(1500),
        headers: {
          "User-Agent": "WatchFlowingFaviconBot/1.0",
          Range: "bytes=0-0",
        },
      });
      return get.ok || get.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve a durable favicon/logo URL for a monitored page.
 * Always returns a usable URL (Google s2 fallback) so the UI never has null display issues.
 * Uses the same SSRF guards as the monitoring fetcher.
 */
export async function resolveFaviconUrl(pageUrl: string): Promise<string> {
  const fallback = getFaviconUrl(pageUrl, 128);

  let safePage: URL;
  try {
    safePage = await assertSafeFetchUrl(pageUrl);
  } catch {
    return fallback;
  }

  const ico = `${safePage.origin}/favicon.ico`;
  const ordered: string[] = [];

  try {
    const res = await fetchWithSafeRedirects(safePage.href, {
      method: "GET",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WatchFlowing/1.0; +https://watchflowing.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (res.ok) {
      if (!isSafeHttpUrl(res.url || safePage.href)) {
        return fallback;
      }
      const buf = await res.arrayBuffer();
      const slice = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;
      const html = new TextDecoder("utf-8", { fatal: false }).decode(slice);
      ordered.push(...extractFromHtml(html, res.url || safePage.href));
    }
  } catch {
    // Fall through to favicon.ico / Google
  }

  if (isSafeHttpUrl(ico)) ordered.push(ico);

  const toProbe = ordered.slice(0, MAX_PROBE_CANDIDATES);
  for (const candidate of toProbe) {
    if (await probeUrl(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

/** Client/SSR display helper — stored value or Google domain favicon. */
export function monitorFaviconSrc(
  monitor: { faviconUrl?: string | null; url: string },
  size = 64
): string {
  const stored = monitor.faviconUrl?.trim();
  if (stored && isSafeHttpUrl(stored)) {
    return stored;
  }
  return getFaviconUrl(monitor.url, size);
}
