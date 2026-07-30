/**
 * Pre-create compatibility probe — lightweight HTTP check (no Playwright).
 * Classifies whether monitoring is likely to work for a public URL.
 */
import {
  getProtectedSiteWarning,
  PROTECTED_SITE_WARNING,
} from "@/lib/monitor-types";
import { assertSafeFetchUrl, fetchWithSafeRedirects, validateMonitorUrl } from "@/lib/security/url";

export type CompatibilityVerdict =
  | "PUBLIC"
  | "DYNAMIC"
  | "REQUIRES_LOGIN"
  | "ANTI_BOT"
  | "UNSUPPORTED";

export type CompatibilityResult = {
  verdict: CompatibilityVerdict;
  label: string;
  explanation: string;
  /** Soft signal — creation is still allowed, but user should acknowledge risk. */
  risky: boolean;
  httpStatus: number | null;
  checkedUrl: string;
};

const PROBE_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 180_000;

const VERDICT_COPY: Record<
  CompatibilityVerdict,
  { label: string; explanation: string; risky: boolean }
> = {
  PUBLIC: {
    label: "Public page",
    explanation:
      "This looks like a public HTML page. Monitoring should work reliably.",
    risky: false,
  },
  DYNAMIC: {
    label: "Dynamic page",
    explanation:
      "This page appears heavily JavaScript-rendered. Monitoring can work, but results may vary — prefer a stable public HTML URL when possible.",
    risky: true,
  },
  REQUIRES_LOGIN: {
    label: "Requires login",
    explanation:
      "This URL looks private or behind authentication. WatchFlowing monitors public pages only — pick a page that loads without signing in.",
    risky: true,
  },
  ANTI_BOT: {
    label: "Protected by anti-bot",
    explanation:
      "This site appears to use bot protection (CAPTCHA, Cloudflare challenge, or similar). Automated checks may be blocked or unreliable.",
    risky: true,
  },
  UNSUPPORTED: {
    label: "Unsupported",
    explanation:
      "This site type is not a good fit for automated monitoring (marketplace, social network, or similar). Choose a public corporate, docs, news, or government page instead.",
    risky: true,
  },
};

const ANTI_BOT_HEADER_HINTS = [
  "cf-mitigated",
  "cf-chl-",
  "x-datadome",
  "x-akamai-bot",
  "x-bot-protection",
];

const ANTI_BOT_BODY_HINTS = [
  /cf-browser-verification/i,
  /challenge-platform/i,
  /just a moment\.\.\./i,
  /attention required/i,
  /enable javascript and cookies to continue/i,
  /datadome/i,
  /captcha/i,
  /access denied/i,
  /bot detection/i,
  /security check/i,
];

const LOGIN_BODY_HINTS = [
  /type=["']password["']/i,
  /name=["']password["']/i,
  /sign[\s-]?in/i,
  /log[\s-]?in/i,
  /create an account/i,
  /authenticate/i,
];

const SPA_ROOT_HINTS = [
  /id=["'](__next|root|app|__nuxt|sapper)["']/i,
  /data-reactroot/i,
];

function hostLooksUnsupported(hostname: string): boolean {
  return Boolean(getProtectedSiteWarning(`https://${hostname}/`));
}

function pathLooksPrivate(pathname: string): boolean {
  return /\/(login|signin|sign-in|signup|sign-up|account|dashboard|app|portal|auth|oauth|checkout|cart)(\/|$)/i.test(
    pathname
  );
}

function headersSuggestAntiBot(headers: Headers): boolean {
  const names = [...headers.keys()].map((k) => k.toLowerCase());
  if (names.some((n) => ANTI_BOT_HEADER_HINTS.some((h) => n.includes(h)))) {
    return true;
  }
  const server = headers.get("server")?.toLowerCase() ?? "";
  if (server.includes("cloudflare") && headers.get("cf-ray")) {
    // Cloudflare alone is fine; mitigated challenges are not
    const mitigated = headers.get("cf-mitigated");
    if (mitigated) return true;
  }
  return false;
}

/** Shared public-page challenge detection. This detects blocks; it does not evade them. */
export function containsAntiBotChallenge(body: string): boolean {
  return ANTI_BOT_BODY_HINTS.some((re) => re.test(body));
}

function bodySuggestsLogin(body: string): boolean {
  const hits = LOGIN_BODY_HINTS.filter((re) => re.test(body)).length;
  return hits >= 2;
}

function bodyLooksDynamicShell(body: string): boolean {
  const textish = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const scriptCount = (body.match(/<script\b/gi) ?? []).length;
  const hasSpaRoot = SPA_ROOT_HINTS.some((re) => re.test(body));
  if (hasSpaRoot && textish.length < 400) return true;
  if (scriptCount >= 8 && textish.length < 280) return true;
  return false;
}

async function readBodyLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text().catch(() => "");
    return text.slice(0, MAX_BODY_BYTES);
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.length;
    if (total >= MAX_BODY_BYTES) break;
  }
  try {
    await reader.cancel();
  } catch {
    /* ignore */
  }
  const merged = new Uint8Array(Math.min(total, MAX_BODY_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, merged.length - offset);
    merged.set(slice, offset);
    offset += slice.length;
    if (offset >= merged.length) break;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function result(
  verdict: CompatibilityVerdict,
  checkedUrl: string,
  httpStatus: number | null,
  explanationOverride?: string
): CompatibilityResult {
  const copy = VERDICT_COPY[verdict];
  return {
    verdict,
    label: copy.label,
    explanation: explanationOverride ?? copy.explanation,
    risky: copy.risky,
    httpStatus,
    checkedUrl,
  };
}

/**
 * Probe a candidate monitor URL and classify compatibility.
 * Never follows into private networks (SSRF-safe).
 */
export async function checkMonitorCompatibility(
  rawUrl: string
): Promise<CompatibilityResult> {
  const validated = validateMonitorUrl(rawUrl.trim());
  if (!validated.ok) {
    return result(
      "UNSUPPORTED",
      rawUrl.trim(),
      null,
      validated.error || "This URL cannot be monitored."
    );
  }

  const { url } = validated;
  const host = url.hostname.replace(/^www\./i, "");

  if (hostLooksUnsupported(host)) {
    return result("UNSUPPORTED", url.toString(), null, PROTECTED_SITE_WARNING);
  }

  if (pathLooksPrivate(url.pathname)) {
    return result("REQUIRES_LOGIN", url.toString(), null);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    await assertSafeFetchUrl(url.toString());

    const response = await fetchWithSafeRedirects(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; WatchFlowing/1.0; +https://watchflowing.com)",
        "Accept-Language": "en-US,en;q=0.8",
      },
    });

    const status = response.status;
    const finalUrl = response.url || url.toString();
    let finalPath = url.pathname;
    try {
      finalPath = new URL(finalUrl).pathname;
    } catch {
      /* keep */
    }

    if (pathLooksPrivate(finalPath) && finalPath !== url.pathname) {
      return result("REQUIRES_LOGIN", finalUrl, status);
    }

    if (status === 401 || status === 403) {
      return result(
        status === 401 ? "REQUIRES_LOGIN" : "ANTI_BOT",
        finalUrl,
        status
      );
    }

    if (status === 404 || status === 410) {
      return result(
        "UNSUPPORTED",
        finalUrl,
        status,
        "This page returned not found. Confirm the URL is public and correct before creating a monitor."
      );
    }

    if (status >= 500) {
      return result(
        "DYNAMIC",
        finalUrl,
        status,
        "The site returned a server error during the check. You can still create the monitor — we’ll retry on the normal schedule."
      );
    }

    if (headersSuggestAntiBot(response.headers)) {
      return result("ANTI_BOT", finalUrl, status);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const body = await readBodyLimited(response);

    if (containsAntiBotChallenge(body) || status === 429 || status === 503) {
      return result("ANTI_BOT", finalUrl, status);
    }

    if (bodySuggestsLogin(body) || pathLooksPrivate(finalPath)) {
      return result("REQUIRES_LOGIN", finalUrl, status);
    }

    if (
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml") ||
      body.trimStart().startsWith("<")
    ) {
      if (bodyLooksDynamicShell(body)) {
        return result("DYNAMIC", finalUrl, status);
      }
      return result("PUBLIC", finalUrl, status);
    }

    // Non-HTML (JSON API, feed, etc.) — still monitorable in some modes
    if (
      contentType.includes("json") ||
      contentType.includes("xml") ||
      contentType.includes("rss") ||
      contentType.includes("atom")
    ) {
      return result(
        "PUBLIC",
        finalUrl,
        status,
        "This URL returns structured public data (JSON/XML/feed). Monitoring should work with the right monitor type."
      );
    }

    return result(
      "DYNAMIC",
      finalUrl,
      status,
      "We could reach this URL, but the response type is unusual. Monitoring may still work depending on the monitor type you choose."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/private network|not allowed|credentials|Internal hostnames/i.test(message)) {
      return result("UNSUPPORTED", url.toString(), null, message);
    }
    if (/aborted|timeout|TimeoutError/i.test(message)) {
      return result(
        "DYNAMIC",
        url.toString(),
        null,
        "The page took too long to respond during the compatibility check. You can still create the monitor — slower sites sometimes succeed on scheduled checks."
      );
    }
    return result(
      "DYNAMIC",
      url.toString(),
      null,
      "We couldn’t fully verify this page right now. You can still create the monitor; the first scheduled check will confirm whether it works."
    );
  } finally {
    clearTimeout(timer);
  }
}
