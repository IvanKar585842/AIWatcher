import type { ChangeAnalysis } from "@/lib/ai/types";

export type ImportanceLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const IMPORTANCE_RANK: Record<ImportanceLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const CRITICAL_SIGNALS =
  /\b(outage|unavailable|down|500\b|502\b|503\b|login\s+(failed|unavailable|broken)|sign[\s-]?in\s+(failed|unavailable)|security\s+(breach|update|advisory|vuln)|cve-\d|data\s+breach|ransomware|product\s+launch|launched\s+today|breaking\s+news|urgent\s+announcement|price\s+(increased|decreased|changed|drop|hike)|pricing\s+(update|change|increase|decrease)|\$\s*\d|€\s*\d|£\s*\d)\b/i;

const HIGH_SIGNALS =
  /\b(new\s+feature|feature\s+launch|changelog|api\s+(endpoint|reference)|documentation\s+update|docs?\s+updated|career|hiring|we.?re\s+hiring|job\s+opening|redesign|hero\s+(image|banner)|cta\s+changed|call[\s-]to[\s-]action|navigation\s+(changed|updated)|nav\s+menu)\b/i;

const MEDIUM_SIGNALS =
  /\b(article|blog\s+post|faq|help\s+center|minor\s+(copy|text)|paragraph|heading\s+updated|layout\s+tweak)\b/i;

const LOW_SIGNALS =
  /\b(footer|copyright|©\s*20\d{2}|cookie\s*(banner|consent|policy)|gdpr\s+banner|analytics|gtag|google[\s-]?tag|hotjar|clarity\.ms|pixel|tracking\s+script|whitespace|margin|padding|font[\s-]?size|color:\s*#|spinner|loading\s+state|timestamp|last\s+updated:\s*\d)\b/i;

const MODE_BIAS: Record<string, number> = {
  PRICE_DETECTION: 1,
  PRODUCT_AVAILABILITY: 1,
  JOB_LISTINGS: 0.5,
  DOCUMENTATION_CHANGES: 0.35,
  KEYWORD_DETECTION: 0.35,
  AI_SMART: 0.15,
  VISUAL_CHANGES: 0,
  SCREENSHOT_DIFF: 0,
  ENTIRE_PAGE: 0,
  TEXT_CHANGES: -0.15,
  HTML_DIFF: -0.15,
  CSS_SELECTOR: 0,
  XPATH: 0,
  TABLE_DETECTION: 0.2,
  API_RESPONSE: 0.25,
  RSS_FEED: -0.1,
};

function clampRank(n: number): ImportanceLevel {
  if (n >= 2.75) return "CRITICAL";
  if (n >= 1.75) return "HIGH";
  if (n >= 0.85) return "MEDIUM";
  return "LOW";
}

function textBlob(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join("\n").toLowerCase();
}

/**
 * Heuristic importance from change magnitude + signals + monitoring mode.
 * Used by fallback analysis and to recalibrate over-eager AI labels.
 */
export function scoreImportance(input: {
  mode?: string;
  packageText?: string;
  changes?: string[];
  category?: string;
  categoryLabel?: string;
  changeCount?: number;
  visualDiffPercent?: number | null;
  charDelta?: number;
}): ImportanceLevel {
  const blob = textBlob([
    input.packageText,
    ...(input.changes ?? []),
    input.category,
    input.categoryLabel,
  ]);

  let score = 1; // default MEDIUM-ish

  const count = input.changeCount ?? input.changes?.length ?? 0;
  if (count <= 1) score -= 0.45;
  else if (count <= 3) score -= 0.1;
  else if (count >= 8) score += 0.55;
  else if (count >= 5) score += 0.3;

  const delta = input.charDelta ?? 0;
  if (delta > 0 && delta < 40) score -= 0.55;
  else if (delta > 0 && delta < 120) score -= 0.25;
  else if (delta > 800) score += 0.45;
  else if (delta > 300) score += 0.2;

  if (input.visualDiffPercent != null) {
    const pct = input.visualDiffPercent;
    if (pct < 2) score -= 0.7;
    else if (pct < 4) score -= 0.25;
    else if (pct < 8) score += 0.15;
    else if (pct < 15) score += 0.45;
    else score += 0.85;
  }

  if (LOW_SIGNALS.test(blob) && !CRITICAL_SIGNALS.test(blob) && !HIGH_SIGNALS.test(blob)) {
    score -= 0.95;
  }
  if (MEDIUM_SIGNALS.test(blob)) score += 0.05;
  if (HIGH_SIGNALS.test(blob)) score += 0.85;
  if (CRITICAL_SIGNALS.test(blob)) score += 1.35;

  const cat = String(input.category ?? "").toUpperCase();
  if (cat === "PRICE" || cat === "POLICY") score += 0.75;
  if (cat === "JOBS" || cat === "FEATURES" || cat === "PRODUCT" || cat === "DOCUMENTATION") {
    score += 0.45;
  }
  if (cat === "CONTACT_INFO") score += 0.2;

  const label = String(input.categoryLabel ?? "").toLowerCase();
  if (/footer|design|images|navigation/.test(label) && !CRITICAL_SIGNALS.test(blob)) {
    score -= 0.35;
  }
  if (/security|legal|pricing|product launch|announcement/.test(label)) {
    score += 0.55;
  }

  score += MODE_BIAS[input.mode ?? ""] ?? 0;

  return clampRank(score);
}

/**
 * Keep AI judgment when plausible; pull HIGH→MEDIUM and MEDIUM→LOW when signals disagree.
 * Never silently promote past AI unless heuristics scream CRITICAL and AI said HIGH.
 */
export function recalibrateImportance(
  analysis: ChangeAnalysis,
  ctx: {
    mode?: string;
    packageText?: string;
    visualDiffPercent?: number | null;
    charDelta?: number;
  }
): ChangeAnalysis {
  const heuristic = scoreImportance({
    mode: ctx.mode,
    packageText: ctx.packageText,
    changes: analysis.changes,
    category: analysis.category,
    categoryLabel: analysis.categoryLabel,
    changeCount: analysis.changes?.length,
    visualDiffPercent: ctx.visualDiffPercent,
    charDelta: ctx.charDelta,
  });

  const ai = analysis.importance as ImportanceLevel;
  const aiRank = IMPORTANCE_RANK[ai] ?? 1;
  const hRank = IMPORTANCE_RANK[heuristic];

  let next: ImportanceLevel = ai;

  // Over-classification: AI HIGH/CRITICAL but heuristics say lower → pull down
  if (aiRank - hRank >= 2) {
    next = heuristic;
  } else if (aiRank - hRank === 1 && hRank <= 1) {
    next = heuristic;
  }

  // Under-classification of clear critical signals
  if (hRank === 3 && aiRank >= 2) {
    next = "CRITICAL";
  }

  // Clear noise must stay LOW
  if (heuristic === "LOW" && aiRank <= 2 && LOW_SIGNALS.test(ctx.packageText ?? "")) {
    next = "LOW";
  }

  if (next === ai) return analysis;
  return { ...analysis, importance: next };
}

/** Display labels for UI (Critical / High / Medium / Low). */
export function importanceLabel(importance: string): string {
  switch (String(importance).toUpperCase()) {
    case "CRITICAL":
      return "Critical";
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Low";
    default:
      return "Medium";
  }
}
