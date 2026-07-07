import * as Diff from "diff";
import { MonitoringMode } from "@prisma/client";
import type { ChangeAnalysis } from "@/lib/ai/types";
import { extractTextFromHtml } from "./content-cleaner";

function toPlainText(content: string): string {
  if (content.startsWith("[visual-screenshot:") || content.includes("screenshot:")) {
    return content;
  }
  if (content.includes("<") && content.includes(">")) {
    return extractTextFromHtml(content);
  }
  return content.replace(/\s+/g, " ").trim();
}

function isVisualContent(content: string): boolean {
  return content.includes("visual-screenshot") || content.includes("screenshot:");
}

export function buildFallbackAnalysis(params: {
  monitorName: string;
  url: string;
  mode: string;
  oldContent: string;
  newContent: string;
}): ChangeAnalysis {
  const visual =
    params.mode === MonitoringMode.VISUAL_CHANGES ||
    params.mode === MonitoringMode.SCREENSHOT_DIFF ||
    isVisualContent(params.oldContent) ||
    isVisualContent(params.newContent);

  if (visual) {
    return {
      summary: `Visual change detected on ${params.monitorName}`,
      importance: "MEDIUM",
      category: "CONTENT",
      changes: ["The page layout or appearance has changed"],
      bullet_points: ["The page layout or appearance has changed"],
      shouldNotify: true,
      old_value: null,
      new_value: null,
      emoji: "👁️",
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

  return {
    summary: `Change detected on ${params.monitorName} (${hostname})`,
    importance: added.length + removed.length > 3 ? "HIGH" : "MEDIUM",
    category: params.mode === MonitoringMode.PRICE_DETECTION ? "PRICE" : "CONTENT",
    changes: bullets.slice(0, 5),
    bullet_points: bullets.slice(0, 5),
    shouldNotify: true,
    old_value: removed[0]?.slice(0, 500) ?? null,
    new_value: added[0]?.slice(0, 500) ?? null,
    emoji: "🔔",
  };
}
