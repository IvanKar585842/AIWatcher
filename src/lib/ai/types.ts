import { ChangeCategory, ChangeImportance } from "@prisma/client";
import { z } from "zod";

export const changeAnalysisSchema = z.object({
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
  old_value: z.string().nullable().optional(),
  new_value: z.string().nullable().optional(),
  bullet_points: z.array(z.string()),
  emoji: z.string(),
});

export type ChangeAnalysis = z.infer<typeof changeAnalysisSchema>;

export interface AIProvider {
  analyzeChange(params: {
    url: string;
    monitorName: string;
    mode: string;
    oldContent: string;
    newContent: string;
  }): Promise<ChangeAnalysis>;
}

export const CHANGE_ANALYSIS_PROMPT = `You are an expert web change analyst for WatchFlow AI.

Analyze the changes between two versions of a monitored webpage and explain WHAT changed and WHY it matters.

Monitor URL: {url}
Monitor Name: {monitorName}
Monitoring Mode: {mode}

OLD CONTENT:
{oldContent}

NEW CONTENT:
{newContent}

Instructions:
1. Summarize exactly what changed in clear, concise language
2. Classify the change into one category: PRICE, CONTENT, JOBS, POLICY, CONTACT_INFO, PRODUCT, DOCUMENTATION, FEATURES, or OTHER
3. Rate importance: LOW, MEDIUM, HIGH, or CRITICAL
4. Extract old_value and new_value for the primary change (if applicable)
5. Provide 2-5 bullet points highlighting key changes
6. Choose a relevant emoji

Respond ONLY with valid JSON in this exact format:
{
  "summary": "string",
  "importance": "LOW|MEDIUM|HIGH|CRITICAL",
  "category": "PRICE|CONTENT|JOBS|POLICY|CONTACT_INFO|PRODUCT|DOCUMENTATION|FEATURES|OTHER",
  "old_value": "string or null",
  "new_value": "string or null",
  "bullet_points": ["string"],
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
