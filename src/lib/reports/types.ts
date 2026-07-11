import { z } from "zod";

export const weeklyReportItemSchema = z.object({
  changeId: z.string(),
  monitorName: z.string(),
  monitorUrl: z.string(),
  summary: z.string(),
  importance: z.string(),
  category: z.string(),
  emoji: z.string().optional(),
  createdAt: z.string(),
});

export const weeklyReportPayloadSchema = z.object({
  periodLabel: z.string(),
  stats: z.object({
    totalChanges: z.number(),
    importantCount: z.number(),
    monitorsActive: z.number(),
    monitorsError: z.number(),
    monitorsPaused: z.number(),
    byImportance: z.record(z.number()),
    byDay: z.array(z.object({ date: z.string(), count: z.number() })),
  }),
  executiveSummary: z.string(),
  importantChanges: z.array(weeklyReportItemSchema),
  competitorIntelligence: z.array(z.string()),
  seoHealth: z.array(z.string()),
  recommendations: z.array(z.string()),
  unresolvedIssues: z.array(z.string()),
  reportType: z.enum(["BUSINESS", "DEVELOPER", "SEO", "COMPETITOR"]),
  aiUsed: z.boolean(),
});

export type WeeklyReportItem = z.infer<typeof weeklyReportItemSchema>;
export type WeeklyReportPayload = z.infer<typeof weeklyReportPayloadSchema>;
