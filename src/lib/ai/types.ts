import { ChangeCategory, ChangeImportance } from "@prisma/client";
import { z } from "zod";
import {
  defaultCategoryLabel,
  mapCategoryLabelToPrisma,
} from "./change-insight";

const prismaCategoryEnum = z.enum([
  "PRICE",
  "CONTENT",
  "JOBS",
  "POLICY",
  "CONTACT_INFO",
  "PRODUCT",
  "DOCUMENTATION",
  "FEATURES",
  "OTHER",
]);

export const changeAnalysisSchema = z
  .object({
    summary: z.string(),
    importance: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    /** Prisma enum and/or free-form label — normalized in transform */
    category: z.string(),
    categoryLabel: z.string().optional(),
    category_label: z.string().optional(),
    changes: z.array(z.string()).default([]),
    shouldNotify: z.boolean().default(true),
    old_value: z.string().nullable().optional(),
    new_value: z.string().nullable().optional(),
    bullet_points: z.array(z.string()).optional(),
    emoji: z.string().default("🔔"),
    recommendedAction: z.string().optional().default(""),
    recommended_action: z.string().optional(),
    potentialImpact: z.string().optional().default(""),
    potential_impact: z.string().optional(),
  })
  .transform((data) => {
    const changes = (data.changes.length > 0 ? data.changes : (data.bullet_points ?? []))
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 8);

    const categoryLabelRaw =
      (data.categoryLabel || data.category_label || data.category || "").trim() || "Other";
    const prismaCategory = mapCategoryLabelToPrisma(
      prismaCategoryEnum.safeParse(data.category.toUpperCase()).success
        ? data.category.toUpperCase()
        : categoryLabelRaw
    );

    const categoryLabel =
      data.categoryLabel?.trim() ||
      data.category_label?.trim() ||
      (prismaCategoryEnum.safeParse(data.category.toUpperCase()).success
        ? defaultCategoryLabel(data.category.toUpperCase())
        : categoryLabelRaw) ||
      defaultCategoryLabel(prismaCategory);

    const potentialImpact =
      (data.potentialImpact || data.potential_impact || "").trim() ||
      defaultPotentialImpact(data.importance, prismaCategory, changes);

    const recommendedAction =
      (data.recommendedAction || data.recommended_action || "").trim() ||
      defaultRecommendedAction(data.importance, prismaCategory);

    const summary = data.summary.trim() || "A meaningful update was detected on this page.";

    return {
      summary,
      importance: data.importance,
      category: prismaCategory as z.infer<typeof prismaCategoryEnum>,
      categoryLabel,
      changes,
      bullet_points: changes,
      shouldNotify: data.shouldNotify,
      old_value: data.old_value ?? null,
      new_value: data.new_value ?? null,
      emoji: data.emoji || "🔔",
      recommendedAction,
      potentialImpact,
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

export function defaultPotentialImpact(
  importance: string,
  category?: string,
  changes: string[] = []
): string {
  const hint = changes[0]?.toLowerCase() ?? "";
  if (category === "PRICE" || /price|pricing|tier|plan/.test(hint)) {
    return "This pricing update may indicate a new subscription tier or competitive repositioning.";
  }
  if (category === "DOCUMENTATION" || /api|endpoint|docs/.test(hint)) {
    return "This documentation update may introduce or change an API surface your team depends on.";
  }
  if (category === "JOBS" || /hir|career|job/.test(hint)) {
    return "This hiring update may signal team expansion or a strategic shift.";
  }
  if (category === "POLICY" || /privacy|terms|legal|security/.test(hint)) {
    return "This legal or security update may affect compliance or customer trust.";
  }
  if (importance === "LOW") {
    return "Limited business impact expected — likely routine or cosmetic.";
  }
  if (importance === "HIGH" || importance === "CRITICAL") {
    return "This change may affect how customers discover, evaluate, or use the product.";
  }
  return "Worth a quick review to confirm it aligns with your monitoring goals.";
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

export const CHANGE_ANALYSIS_PROMPT = `You analyze website monitoring changes for WatchFlowing.

You receive a compact CHANGE PACKAGE (not full page HTML). Be specific — never write vague lines like "Content changed."

Monitor URL: {url}
Monitor Name: {monitorName}
Monitoring Mode: {mode}

User instructions (follow these when present):
{userPrompt}

CHANGE PACKAGE:
{oldHtml}

ADDITIONAL CONTEXT:
{newHtml}

Write a structured analysis users can act on immediately.

Summary rules:
- 2–4 complete sentences
- Name what specifically changed (section, price, CTA, heading, image, nav, docs, etc.)
- Mention before→after when values are clear
- Do NOT use generic phrases alone ("Content changed.", "Page updated.")

What changed (changes array):
- 2–6 short bullets
- Prefer concrete verbs: "New section added", "Price updated", "CTA changed", "Heading changed", "Link changed", "Image changed", "Navigation changed", "Text removed"
- Each bullet must be understandable alone

Category classification (set categoryLabel to the best match):
Pricing | Product | Documentation | Blog | Careers | Security | Legal | Marketing | Landing Page | Navigation | Images | Design | Footer | Contact Information | Terms of Service | Privacy Policy | Features | Content | Other

Also set category to the closest internal enum:
PRICE | CONTENT | JOBS | POLICY | CONTACT_INFO | PRODUCT | DOCUMENTATION | FEATURES | OTHER
(Examples: Pricing→PRICE, Careers→JOBS, Privacy Policy→POLICY, Blog→CONTENT, Navigation→OTHER)

Importance:
- LOW: noise — cookies, ads, timestamps, counters, loading states, tiny formatting
- MEDIUM: real but non-urgent (small copy, minor UI)
- HIGH: important user-facing change (pricing, CTA, key content, policy)
- CRITICAL: urgent business impact (outage/error page, large price swing, security/legal)

potentialImpact:
- 1–2 sentences explaining WHY this could matter
- Examples: "This pricing update may indicate a new subscription tier." / "This documentation update introduces a new API endpoint." / "This new hiring page suggests company expansion."

Notification:
- shouldNotify=true ONLY for HIGH or CRITICAL (unless user instructions say otherwise)
- shouldNotify=false for LOW and MEDIUM

recommendedAction: short next step for the user

Respond ONLY with valid JSON:
{
  "summary": "2–4 sentence overview of the most important change",
  "importance": "LOW|MEDIUM|HIGH|CRITICAL",
  "category": "PRICE|CONTENT|JOBS|POLICY|CONTACT_INFO|PRODUCT|DOCUMENTATION|FEATURES|OTHER",
  "categoryLabel": "Pricing|Product|Documentation|Blog|Careers|…",
  "changes": ["concrete bullet", "concrete bullet"],
  "shouldNotify": true,
  "old_value": "string or null",
  "new_value": "string or null",
  "emoji": "string",
  "potentialImpact": "why this change may matter",
  "recommendedAction": "short actionable recommendation"
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
