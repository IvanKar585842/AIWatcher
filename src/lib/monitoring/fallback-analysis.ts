import * as Diff from "diff";
import { MonitoringMode } from "@prisma/client";
import type { ChangeAnalysis } from "@/lib/ai/types";
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

export function buildFallbackAnalysis(params: {
  monitorName: string;
  url: string;
  mode: string;
  oldContent: string;
  newContent: string;
  visualDiffPercent?: number | null;
}): ChangeAnalysis {
  const visual = isVisualMode(params.mode, params.oldContent, params.newContent);

  if (visual) {
    const pct = params.visualDiffPercent;
    const small = pct != null && pct < 4;
    return {
      summary:
        pct != null
          ? `Visual change on ${params.monitorName} (~${pct.toFixed(1)}% difference)`
          : `Visual change detected on ${params.monitorName}`,
      importance: small ? "MEDIUM" : "HIGH",
      category: "CONTENT",
      changes: [
        pct != null
          ? `Screenshot difference approximately ${pct.toFixed(1)}%`
          : "The page layout or appearance has changed",
      ],
      bullet_points: [
        pct != null
          ? `Screenshot difference approximately ${pct.toFixed(1)}%`
          : "The page layout or appearance has changed",
      ],
      shouldNotify: !small,
      old_value: null,
      new_value: null,
      emoji: "👁️",
      recommendedAction: small
        ? "Review when convenient — visual shift looks minor."
        : "Compare screenshots in the dashboard and confirm the update is expected.",
    };
  }

  const packageText = `${params.oldContent}\n${params.newContent}`;
  if (looksLikeNoise(packageText) && !/price|pricing|available|stock|job|policy/i.test(packageText)) {
    return {
      summary: `Minor or noisy update on ${params.monitorName}`,
      importance: "LOW",
      category: "OTHER",
      changes: ["Likely non-critical page noise (ads, cookies, or dynamic counters)"],
      bullet_points: ["Likely non-critical page noise (ads, cookies, or dynamic counters)"],
      shouldNotify: false,
      old_value: null,
      new_value: null,
      emoji: "🔕",
      recommendedAction: "No action needed.",
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
    bullets.push(`Removed: ${line}`);
  }
  for (const line of added.slice(0, 3)) {
    bullets.push(`Added: ${line}`);
  }

  // Prefer structure summary lines already in package
  const structureHints = params.oldContent
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2))
    .slice(0, 5);

  for (const hint of structureHints) {
    if (bullets.length >= 5) break;
    if (!bullets.includes(hint)) bullets.push(hint);
  }

  if (bullets.length === 0) {
    bullets.push("Page content has been updated");
  }

  const hostname = (() => {
    try {
      return new URL(params.url).hostname;
    } catch {
      return params.url;
    }
  })();

  const changeCount = added.length + removed.length + structureHints.length;
  const importance: ChangeAnalysis["importance"] =
    changeCount > 5 || /price|pricing|available|stock/i.test(packageText)
      ? "HIGH"
      : "MEDIUM";

  return {
    summary: `Change detected on ${params.monitorName} (${hostname})`,
    importance,
    category: params.mode === MonitoringMode.PRICE_DETECTION ? "PRICE" : "CONTENT",
    changes: bullets.slice(0, 5),
    bullet_points: bullets.slice(0, 5),
    shouldNotify: importance === "HIGH",
    old_value: removed[0]?.slice(0, 500) ?? null,
    new_value: added[0]?.slice(0, 500) ?? null,
    emoji: "🔔",
    recommendedAction:
      importance === "HIGH"
        ? params.mode === MonitoringMode.PRICE_DETECTION
          ? "Review pricing immediately and update your strategy if needed."
          : "Open the full analysis and decide next steps."
        : "Review when convenient — confirm the update is expected.",
  };
}
