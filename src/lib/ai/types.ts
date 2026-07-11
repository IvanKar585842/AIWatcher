import { ChangeCategory, ChangeImportance } from "@prisma/client";
import { z } from "zod";

export const changeAnalysisSchema = z
  .object({
    summary: z.string(),
    importance: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    category: z.enum([
      "PRICE",
      "CONTENT",
      "JOBS",
      "POLICY",
      "CONTACT_INFO",
      "PRODUCT",
      "DOCUMENTATION",
      "FEATURES",
      "OTHER",
    ]),
    changes: z.array(z.string()).default([]),
    shouldNotify: z.boolean().default(true),
    old_value: z.string().nullable().optional(),
    new_value: z.string().nullable().optional(),
    bullet_points: z.array(z.string()).optional(),
    emoji: z.string().default("🔔"),
    recommendedAction: z.string().optional().default(""),
    recommended_action: z.string().optional(),
  })
  .transform((data) => {
    const changes = data.changes.length > 0 ? data.changes : (data.bullet_points ?? []);
    const recommendedAction =
      (data.recommendedAction || data.recommended_action || "").trim() ||
      defaultRecommendedAction(data.importance, data.category);
    return {
      ...data,
      changes,
      bullet_points: data.bullet_points ?? data.changes,
      recommendedAction,
    };
  });

export type ChangeAnalysis = z.infer<typeof changeAnalysisSchema>;

export function defaultRecommendedAction(
  importance: string,
  category?: string
): string {
  if (importance === "LOW") {
    return "No action needed — this looks like routine page noise.";
  }
  if (importance === "MEDIUM") {
    return "Review when convenient — confirm the update is expected.";
  }
  if (category === "PRICE") {
    return "Review pricing immediately and update your strategy if needed.";
  }
  if (category === "POLICY") {
    return "Read the updated policy and check compliance impact.";
  }
  if (category === "JOBS") {
    return "Review the listing and decide if you should apply or notify your team.";
  }
  if (importance === "CRITICAL") {
    return "Investigate immediately — this may require urgent business action.";
  }
  return "Open the full analysis and decide next steps.";
}

export interface AIProvider {
  analyzeChange(params: {
    url: string;
    monitorName: string;
    mode: string;
    oldHtml: string;
    newHtml: string;
    userPrompt?: string;
  }): Promise<ChangeAnalysis>;
}

export const CHANGE_ANALYSIS_PROMPT = `You analyze website monitoring changes for WatchFlow.

You receive a compact CHANGE PACKAGE (not full page HTML). Decide importance carefully.

Monitor URL: {url}
Monitor Name: {monitorName}
Monitoring Mode: {mode}

User instructions (follow these when present):
{userPrompt}

CHANGE PACKAGE:
{oldHtml}

ADDITIONAL CONTEXT:
{newHtml}

Classification rules:
- LOW: noise — cookie banners, ads, timestamps, counters, loading states, minor formatting. Ignore for alerts.
- MEDIUM: real change worth keeping in history, but not urgent (small copy edits, non-critical UI tweaks).
- HIGH: important user-facing change (pricing, availability, key content, CTAs, policy).
- CRITICAL: urgent business impact (major outage/error page, large price change, security/legal).

Notification rules:
- shouldNotify=true ONLY for HIGH or CRITICAL (unless user instructions say otherwise)
- shouldNotify=false for LOW and MEDIUM

Always include recommendedAction:
- LOW: "No action needed."
- MEDIUM: what the user should review
- HIGH/CRITICAL: concrete next step (e.g. "Review pricing strategy.")

Respond ONLY with valid JSON:
{
  "summary": "string — clear explanation of what changed",
  "importance": "LOW|MEDIUM|HIGH|CRITICAL",
  "category": "PRICE|CONTENT|JOBS|POLICY|CONTACT_INFO|PRODUCT|DOCUMENTATION|FEATURES|OTHER",
  "changes": ["string"],
  "shouldNotify": true,
  "old_value": "string or null",
  "new_value": "string or null",
  "emoji": "string",
  "recommendedAction": "string — short actionable recommendation"
}`;

export function parseChangeAnalysis(raw: string): ChangeAnalysis {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response: no JSON found");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return changeAnalysisSchema.parse(parsed);
}

export function toPrismaImportance(
  importance: ChangeAnalysis["importance"]
): ChangeImportance {
  return ChangeImportance[importance];
}

export function toPrismaCategory(
  category: ChangeAnalysis["category"]
): ChangeCategory {
  return ChangeCategory[category];
}

export function buildAnalysisPrompt(params: {
  url: string;
  monitorName: string;
  mode: string;
  oldHtml: string;
  newHtml: string;
  userPrompt?: string;
}): string {
  return CHANGE_ANALYSIS_PROMPT.replace("{url}", params.url)
    .replace("{monitorName}", params.monitorName)
    .replace("{mode}", params.mode)
    .replace("{userPrompt}", params.userPrompt?.trim() || "None")
    .replace("{oldHtml}", params.oldHtml)
    .replace("{newHtml}", params.newHtml);
}
