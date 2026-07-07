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
  })
  .transform((data) => ({
    ...data,
    changes: data.changes.length > 0 ? data.changes : (data.bullet_points ?? []),
    bullet_points: data.bullet_points ?? data.changes,
  }));

export type ChangeAnalysis = z.infer<typeof changeAnalysisSchema>;

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

export const CHANGE_ANALYSIS_PROMPT = `You are an expert web change analyst for WatchFlow AI.

Analyze the changes between two versions of a monitored webpage and explain WHAT changed and WHY it matters.

Monitor URL: {url}
Monitor Name: {monitorName}
Monitoring Mode: {mode}
User Context: {userPrompt}

OLD HTML (cleaned):
{oldHtml}

NEW HTML (cleaned):
{newHtml}

Instructions:
1. Summarize exactly what changed in clear, concise language
2. Classify the change: PRICE, CONTENT, JOBS, POLICY, CONTACT_INFO, PRODUCT, DOCUMENTATION, FEATURES, or OTHER
3. Rate importance: LOW, MEDIUM, HIGH, or CRITICAL
4. List specific detected changes in the "changes" array (2-5 items)
5. Set shouldNotify to true only if the change is meaningful enough to alert the user (false for noise, ads, timestamps, minor formatting)
6. Extract old_value and new_value for the primary change (if applicable)
7. Choose a relevant emoji

Respond ONLY with valid JSON:
{
  "summary": "string",
  "importance": "LOW|MEDIUM|HIGH|CRITICAL",
  "category": "PRICE|CONTENT|JOBS|POLICY|CONTACT_INFO|PRODUCT|DOCUMENTATION|FEATURES|OTHER",
  "changes": ["string"],
  "shouldNotify": true,
  "old_value": "string or null",
  "new_value": "string or null",
  "emoji": "string"
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
