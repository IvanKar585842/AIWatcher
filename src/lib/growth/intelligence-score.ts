import { assertSafeFetchUrl, fetchWithSafeRedirects } from "@/lib/security/url";

export type ScoreDimension = {
  key: "health" | "seo" | "performance" | "risks";
  label: string;
  score: number;
  notes: string[];
};

export type IntelligenceScoreResult = {
  url: string;
  hostname: string;
  overallScore: number;
  dimensions: ScoreDimension[];
  risks: string[];
  recommendations: string[];
  changeFrequencyHint: string;
  previewOnly: boolean;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function extractTag(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = html.match(re);
  return m?.[1]?.replace(/<[^>]+>/g, "").trim() || null;
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>|<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`,
    "i"
  );
  const m = html.match(re);
  return (m?.[1] || m?.[2] || "").trim() || null;
}

/**
 * Lightweight public analyzer — HTTP + HTML heuristics only.
 * No Playwright / no full AI — keeps cost low for viral top-of-funnel.
 */
export async function analyzeIntelligenceScore(
  rawUrl: string
): Promise<IntelligenceScoreResult> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const safeUrl = await assertSafeFetchUrl(url);
  const safe = safeUrl.href;
  const hostname = safeUrl.hostname.replace(/^www\./, "");

  const healthNotes: string[] = [];
  const seoNotes: string[] = [];
  const perfNotes: string[] = [];
  const riskNotes: string[] = [];
  let health = 55;
  let seo = 50;
  let performance = 55;
  let risksScore = 60;

  const started = Date.now();
  let status = 0;
  let html = "";
  let finalUrl = safe;
  let headers: Headers | null = null;

  try {
    const res = await fetchWithSafeRedirects(safe, {
      method: "GET",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "WatchFlowingIntelligenceBot/1.0 (+https://watchflowing.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    status = res.status;
    headers = res.headers;
    finalUrl = res.url || safe;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html") || ct.includes("application/xhtml")) {
      html = (await res.text()).slice(0, 180_000);
    }

    if (status >= 200 && status < 400) {
      health += 25;
      healthNotes.push(`Responded with HTTP ${status}`);
    } else {
      health -= 20;
      riskNotes.push(`Unusual HTTP status: ${status}`);
      risksScore -= 15;
    }
  } catch (err) {
    health -= 30;
    risksScore -= 25;
    riskNotes.push(
      err instanceof Error ? `Fetch issue: ${err.message}` : "Could not reach website"
    );
    healthNotes.push("Site did not respond within the scan window");
  }

  const elapsed = Date.now() - started;
  if (elapsed < 800) {
    performance += 25;
    perfNotes.push(`TTFB-like response in ${elapsed}ms`);
  } else if (elapsed < 2000) {
    performance += 10;
    perfNotes.push(`Acceptable response time (${elapsed}ms)`);
  } else {
    performance -= 15;
    perfNotes.push(`Slow response (${elapsed}ms) — may affect conversions`);
    riskNotes.push("Slow server response detected");
    risksScore -= 10;
  }

  const isHttps = finalUrl.startsWith("https://");
  if (isHttps) {
    health += 10;
    healthNotes.push("HTTPS enabled");
  } else {
    health -= 20;
    riskNotes.push("Site is not served over HTTPS");
    risksScore -= 20;
  }

  if (headers?.get("strict-transport-security")) {
    health += 5;
    healthNotes.push("HSTS header present");
  } else if (isHttps) {
    seoNotes.push("Consider adding Strict-Transport-Security");
  }

  const title = extractTag(html, "title");
  const description = extractMeta(html, "description");
  const robotsMeta = extractMeta(html, "robots");
  const canonical = html.match(
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
  )?.[1];
  const h1 = extractTag(html, "h1");
  const hasViewport = /name=["']viewport["']/i.test(html);

  if (title && title.length >= 10 && title.length <= 70) {
    seo += 20;
    seoNotes.push(`Title looks healthy (${title.length} chars)`);
  } else if (title) {
    seo += 5;
    seoNotes.push("Title present but length may hurt SEO");
  } else if (html) {
    seo -= 15;
    riskNotes.push("Missing <title> tag");
    risksScore -= 10;
  }

  if (description && description.length >= 50) {
    seo += 15;
    seoNotes.push("Meta description found");
  } else if (html) {
    seoNotes.push("Add a clear meta description");
  }

  if (canonical) {
    seo += 10;
    seoNotes.push("Canonical URL declared");
  }

  if (h1) {
    seo += 8;
    seoNotes.push("H1 present");
  } else if (html) {
    seoNotes.push("No clear H1 detected");
  }

  if (hasViewport) {
    performance += 8;
    perfNotes.push("Mobile viewport meta present");
  }

  if (robotsMeta && /noindex/i.test(robotsMeta)) {
    risksScore -= 20;
    riskNotes.push("Page meta robots includes noindex");
    seo -= 10;
  }

  // Robots.txt probe (cheap)
  try {
    const robotsUrl = new URL("/robots.txt", finalUrl).toString();
    const r = await fetchWithSafeRedirects(robotsUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "WatchFlowingIntelligenceBot/1.0" },
    });
    if (r.ok) {
      const body = (await r.text()).slice(0, 4000);
      seo += 5;
      seoNotes.push("robots.txt reachable");
      if (/disallow:\s*\/\s*$/im.test(body)) {
        riskNotes.push("robots.txt appears to disallow all crawlers");
        risksScore -= 15;
      }
    }
  } catch {
    seoNotes.push("robots.txt not checked / unreachable");
  }

  health = clamp(health);
  seo = clamp(seo);
  performance = clamp(performance);
  risksScore = clamp(risksScore);

  const overallScore = clamp(
    health * 0.3 + seo * 0.25 + performance * 0.2 + risksScore * 0.25
  );

  const recommendations: string[] = [];
  if (!isHttps) recommendations.push("Enable HTTPS across the site.");
  if (!title || title.length < 10)
    recommendations.push("Improve the page title for clarity and SEO.");
  if (!description)
    recommendations.push("Add a compelling meta description.");
  if (elapsed > 2000)
    recommendations.push("Investigate server/TTFB performance.");
  if (riskNotes.length)
    recommendations.push("Review flagged risks before a campaign or launch.");
  if (recommendations.length === 0) {
    recommendations.push(
      "Connect continuous monitoring to catch regressions after this snapshot."
    );
  }

  return {
    url: finalUrl,
    hostname,
    overallScore,
    dimensions: [
      { key: "health", label: "Website health", score: health, notes: healthNotes },
      { key: "seo", label: "SEO", score: seo, notes: seoNotes },
      {
        key: "performance",
        label: "Performance",
        score: performance,
        notes: perfNotes,
      },
      {
        key: "risks",
        label: "Risk posture",
        score: risksScore,
        notes: riskNotes.length ? riskNotes : ["No critical risks in this snapshot"],
      },
    ],
    risks: riskNotes,
    recommendations: recommendations.slice(0, 5),
    changeFrequencyHint:
      "Change frequency requires continuous monitoring — create a free WatchFlowing monitor for a live baseline.",
    previewOnly: true,
  };
}
