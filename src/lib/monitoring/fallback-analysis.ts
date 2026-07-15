import * as Diff from "diff";
import { MonitoringMode } from "@prisma/client";
import type { ChangeAnalysis } from "@/lib/ai/types";
import { defaultPotentialImpact, defaultRecommendedAction } from "@/lib/ai/types";
import { hostnameFromUrl } from "@/lib/ai/change-insight";
import { extractTextFromHtml } from "./content-cleaner";

function toPlainText(content: string): string {
  if (content.startsWith("[visual-screenshot:") || content.includes("screenshot:")) {
    return content;
  }
  if (content.trim().startsWith("{") && content.includes('"type":"visual"')) {
    return content;
  }
  if (content.includes("<") && content.includes(">")) {
    return extractTextFromHtml(content);
  }
  return content.replace(/\s+/g, " ").trim();
}

function isVisualMode(mode: string, oldContent: string, newContent: string): boolean {
  return (
    mode === MonitoringMode.VISUAL_CHANGES ||
    mode === MonitoringMode.SCREENSHOT_DIFF ||
    oldContent.includes("visual") ||
    newContent.includes("visual") ||
    oldContent.includes("Visual difference")
  );
}

function looksLikeNoise(text: string): boolean {
  return /cookie|consent|gdpr|advertisement|\bad\b|timestamp|loading|spinner/i.test(text);
}

/** Exported for cost control — skip paid AI on obvious noise packages */
export function isLikelyTechnicalNoise(text: string): boolean {
  return looksLikeNoise(text) && !/price|pricing|available|stock|job|policy|login|security/i.test(text);
}

function classifyFallbackCategory(
  mode: string,
  packageText: string
): { category: ChangeAnalysis["category"]; categoryLabel: string } {
  if (mode === MonitoringMode.PRICE_DETECTION || /price|pricing|\$|€|£/.test(packageText)) {
    return { category: "PRICE", categoryLabel: "Pricing" };
  }
  if (/privacy|terms of service|cookie policy|gdpr|legal/.test(packageText)) {
    return { category: "POLICY", categoryLabel: "Legal" };
  }
  if (/career|hiring|job opening|we.?re hiring/.test(packageText)) {
    return { category: "JOBS", categoryLabel: "Careers" };
  }
  if (/api reference|changelog|documentation|endpoint/.test(packageText)) {
    return { category: "DOCUMENTATION", categoryLabel: "Documentation" };
  }
  if (/contact@|phone:|mailto:|address/.test(packageText)) {
    return { category: "CONTACT_INFO", categoryLabel: "Contact Information" };
  }
  if (mode === MonitoringMode.DOCUMENTATION_CHANGES) {
    return { category: "DOCUMENTATION", categoryLabel: "Documentation" };
  }
  return { category: "CONTENT", categoryLabel: "Content" };
}

export function buildFallbackAnalysis(params: {
  monitorName: string;
  url: string;
  mode: string;
  oldContent: string;
  newContent: string;
  visualDiffPercent?: number | null;
}): ChangeAnalysis {
  const host = hostnameFromUrl(params.url);
  const visual = isVisualMode(params.mode, params.oldContent, params.newContent);

  if (visual) {
    const pct = params.visualDiffPercent;
    const small = pct != null && pct < 4;
    const importance = small ? "MEDIUM" : "HIGH";
    const changes = [
      pct != null
        ? `Visible layout or imagery shifted (~${pct.toFixed(1)}% difference)`
        : "Page layout or imagery changed",
      "Design or media elements may have been updated",
    ];
    return {
      summary:
        pct != null
          ? `A visual update was detected on ${params.monitorName} (${host}). Screenshots differ by about ${pct.toFixed(1)}%, which usually means layout, imagery, or key UI chrome changed. Review the before/after frames to confirm whether the shift is intentional.`
          : `A visual update was detected on ${params.monitorName} (${host}). The page appearance differs from the previous snapshot. Compare the stored screenshots to see which regions moved.`,
      importance,
      category: "OTHER",
      categoryLabel: "Design",
      changes,
      bullet_points: changes,
      shouldNotify: !small,
      old_value: null,
      new_value: null,
      emoji: "👁️",
      recommendedAction: small
        ? "Review when convenient — visual shift looks minor."
        : "Compare screenshots in the dashboard and confirm the update is expected.",
      potentialImpact: defaultPotentialImpact(importance, "OTHER", changes),
    };
  }

  const packageText = `${params.oldContent}\n${params.newContent}`;
  if (looksLikeNoise(packageText) && !/price|pricing|available|stock|job|policy/i.test(packageText)) {
    const changes = ["Likely non-critical page noise (ads, cookies, or dynamic counters)"];
    return {
      summary: `A minor, likely non-critical update appeared on ${params.monitorName} (${host}). The differences resemble cookie banners, ads, or dynamic counters rather than core product content. These are usually safe to ignore unless you specifically track them.`,
      importance: "LOW",
      category: "OTHER",
      categoryLabel: "Other",
      changes,
      bullet_points: changes,
      shouldNotify: false,
      old_value: null,
      new_value: null,
      emoji: "🔕",
      recommendedAction: "No action needed.",
      potentialImpact: defaultPotentialImpact("LOW", "OTHER", changes),
    };
  }

  const oldPlain = toPlainText(params.oldContent).slice(0, 4000);
  const newPlain = toPlainText(params.newContent).slice(0, 4000);

  const parts = Diff.diffLines(oldPlain, newPlain);
  const added: string[] = [];
  const removed: string[] = [];

  for (const part of parts) {
    const lines = part.value
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 2 && l.length < 300);

    if (part.added) added.push(...lines);
    if (part.removed) removed.push(...lines);
  }

  const bullets: string[] = [];

  for (const line of removed.slice(0, 2)) {
    bullets.push(`Text removed: ${line}`);
  }
  for (const line of added.slice(0, 3)) {
    bullets.push(`New or updated text: ${line}`);
  }

  const structureHints = params.oldContent
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2))
    .slice(0, 5);

  for (const hint of structureHints) {
    if (bullets.length >= 6) break;
    if (!bullets.includes(hint)) bullets.push(hint);
  }

  if (bullets.length === 0) {
    bullets.push("Existing page content was modified");
  }

  const { category, categoryLabel } = classifyFallbackCategory(params.mode, packageText);
  const changeCount = added.length + removed.length + structureHints.length;
  const importance: ChangeAnalysis["importance"] =
    changeCount > 5 || /price|pricing|available|stock/i.test(packageText)
      ? "HIGH"
      : "MEDIUM";

  const focus =
    added[0]?.slice(0, 120) ||
    removed[0]?.slice(0, 120) ||
    structureHints[0] ||
    "key page content";

  const summary = [
    `An update was detected on ${params.monitorName} (${host}).`,
    added.length && removed.length
      ? `Existing copy was revised (${removed.length} removed line(s), ${added.length} added), with the most notable snippet around “${focus}”.`
      : added.length
        ? `New material appeared on the page, including “${focus}”.`
        : removed.length
          ? `Material was removed from the page, including “${focus}”.`
          : `Structural or text differences were found around “${focus}”.`,
    importance === "HIGH"
      ? "This looks material enough to review soon."
      : "Confirm whether the update is expected for your monitoring goal.",
  ].join(" ");

  return {
    summary,
    importance,
    category,
    categoryLabel,
    changes: bullets.slice(0, 6),
    bullet_points: bullets.slice(0, 6),
    shouldNotify: importance === "HIGH",
    old_value: removed[0]?.slice(0, 500) ?? null,
    new_value: added[0]?.slice(0, 500) ?? null,
    emoji: category === "PRICE" ? "💰" : "🔔",
    recommendedAction: defaultRecommendedAction(importance, category),
    potentialImpact: defaultPotentialImpact(importance, category, bullets),
  };
}
