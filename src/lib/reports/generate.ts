import { ReportFrequency, ReportType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateReportText } from "./ai-text";
import {
  collectReportData,
  getReportPeriod,
  isCompetitorish,
  isSeoCategory,
  toneForReportType,
  type CollectedReportData,
  type ReportPeriod,
} from "./collect";
import type { WeeklyReportPayload } from "./types";

function buildHeuristicPayload(
  data: CollectedReportData,
  period: ReportPeriod,
  reportType: ReportType
): WeeklyReportPayload {
  const importantChanges = data.changes
    .filter((c) => c.importance === "HIGH" || c.importance === "CRITICAL")
    .slice(0, 8);

  const showPool =
    importantChanges.length > 0 ? importantChanges : data.changes.slice(0, 6);

  const seoHealth = data.changes
    .filter((c) => isSeoCategory(c.category, c.summary))
    .slice(0, 5)
    .map((c) => `${c.monitorName}: ${c.summary}`);

  if (seoHealth.length === 0 && data.changes.length > 0) {
    seoHealth.push("No clear SEO-specific signals this period. Continue monitoring titles and robots.");
  } else if (seoHealth.length === 0) {
    seoHealth.push("No SEO changes detected this period.");
  }

  const competitorIntelligence = data.changes
    .filter((c) => isCompetitorish(c.category, c.summary))
    .slice(0, 5)
    .map((c) => `${c.monitorName}: ${c.summary}`);

  if (competitorIntelligence.length === 0) {
    competitorIntelligence.push(
      data.changes.length > 0
        ? "No strong competitor/pricing signals isolated this period."
        : "No competitor activity detected in the watched set."
    );
  }

  const unresolvedIssues: string[] = [];
  if (data.monitorsError > 0) {
    unresolvedIssues.push(
      `${data.monitorsError} monitor${data.monitorsError === 1 ? "" : "s"} currently in ERROR — check connectivity or selectors.`
    );
  }
  if (data.importantCount > 0) {
    unresolvedIssues.push(
      `${data.importantCount} high-importance change${data.importantCount === 1 ? "" : "s"} may still need human review.`
    );
  }
  if (unresolvedIssues.length === 0) {
    unresolvedIssues.push("No unresolved operational issues flagged.");
  }

  const recommendations: string[] = [];
  for (const c of showPool.slice(0, 4)) {
    if (c.importance === "CRITICAL" || c.importance === "HIGH") {
      recommendations.push(
        `Review “${c.monitorName}” — ${c.summary.slice(0, 120)}. This may affect conversions or trust.`
      );
    }
  }
  if (data.monitorsPaused > 0) {
    recommendations.push(
      `Resume or retire ${data.monitorsPaused} paused monitor${data.monitorsPaused === 1 ? "" : "s"} to keep coverage accurate.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Keep monitors active. Quiet weeks are a good time to refine AI prompts and alert thresholds."
    );
  }

  const executiveSummary =
    data.changes.length === 0
      ? `Quiet period (${period.label}). WatchFlowing watched ${data.monitorsActive} active site${data.monitorsActive === 1 ? "" : "s"} with no meaningful changes detected.`
      : `This period WatchFlowing detected ${data.changes.length} change${data.changes.length === 1 ? "" : "s"}. ${data.importantCount} require attention.`;

  return {
    periodLabel: period.label,
    stats: {
      totalChanges: data.changes.length,
      importantCount: data.importantCount,
      monitorsActive: data.monitorsActive,
      monitorsError: data.monitorsError,
      monitorsPaused: data.monitorsPaused,
      byImportance: data.byImportance,
      byDay: data.byDay,
    },
    executiveSummary,
    importantChanges: showPool,
    competitorIntelligence,
    seoHealth,
    recommendations,
    unresolvedIssues,
    reportType,
    aiUsed: false,
  };
}

async function enrichWithAI(
  payload: WeeklyReportPayload,
  reportType: ReportType
): Promise<WeeklyReportPayload> {
  // Skip AI when there is nothing meaningful — save cost
  if (payload.stats.totalChanges === 0) return payload;

  const contextLines = [
    ...payload.importantChanges.slice(0, 12).map(
      (c) =>
        `[${c.importance}] ${c.monitorName} (${c.category}): ${c.summary}`
    ),
    ...payload.unresolvedIssues.map((u) => `Issue: ${u}`),
  ].join("\n");

  // Hard cap context size
  const clipped = contextLines.slice(0, 3500);

  const system = `You are WatchFlowing's weekly intelligence analyst.
Return STRICT JSON only with keys:
executiveSummary (string, 1-2 sentences),
recommendations (string array, max 5),
competitorIntelligence (string array, max 4),
seoHealth (string array, max 4).
${toneForReportType(reportType)}
Do not invent monitors or changes not in the context.`;

  const user = `Period: ${payload.periodLabel}
Stats: ${payload.stats.totalChanges} changes, ${payload.stats.importantCount} important, ${payload.stats.monitorsActive} active monitors, ${payload.stats.monitorsError} errors.

Events:
${clipped || "(none)"}`;

  const raw = await generateReportText(system, user);
  if (!raw) return payload;

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return payload;
    const parsed = JSON.parse(jsonMatch[0]) as {
      executiveSummary?: string;
      recommendations?: string[];
      competitorIntelligence?: string[];
      seoHealth?: string[];
    };

    return {
      ...payload,
      executiveSummary:
        parsed.executiveSummary?.trim() || payload.executiveSummary,
      recommendations:
        Array.isArray(parsed.recommendations) && parsed.recommendations.length
          ? parsed.recommendations.slice(0, 5).map(String)
          : payload.recommendations,
      competitorIntelligence:
        Array.isArray(parsed.competitorIntelligence) &&
        parsed.competitorIntelligence.length
          ? parsed.competitorIntelligence.slice(0, 4).map(String)
          : payload.competitorIntelligence,
      seoHealth:
        Array.isArray(parsed.seoHealth) && parsed.seoHealth.length
          ? parsed.seoHealth.slice(0, 4).map(String)
          : payload.seoHealth,
      aiUsed: true,
    };
  } catch {
    return payload;
  }
}

export async function generateWeeklyReportForUser(
  userId: string,
  options?: {
    force?: boolean;
    frequency?: ReportFrequency;
    reportType?: ReportType;
  }
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      reportFrequency: true,
      reportType: true,
      weeklyReportEnabled: true,
    },
  });

  const frequency = options?.frequency ?? user.reportFrequency;
  const reportType = options?.reportType ?? user.reportType;
  const period = getReportPeriod(frequency);

  if (!options?.force) {
    const cached = await prisma.weeklyReport.findUnique({
      where: {
        userId_periodStart_periodEnd_reportType: {
          userId,
          periodStart: period.start,
          periodEnd: period.end,
          reportType,
        },
      },
    });
    if (cached && cached.status === "READY") {
      return { report: cached, cached: true as const };
    }
  }

  const data = await collectReportData(userId, period);
  let payload = buildHeuristicPayload(data, period, reportType);
  payload = await enrichWithAI(payload, reportType);

  const report = await prisma.weeklyReport.upsert({
    where: {
      userId_periodStart_periodEnd_reportType: {
        userId,
        periodStart: period.start,
        periodEnd: period.end,
        reportType,
      },
    },
    create: {
      userId,
      periodStart: period.start,
      periodEnd: period.end,
      reportType,
      frequency,
      status: "READY",
      executiveSummary: payload.executiveSummary,
      payload,
      aiUsed: payload.aiUsed,
    },
    update: {
      status: "READY",
      executiveSummary: payload.executiveSummary,
      payload,
      aiUsed: payload.aiUsed,
      frequency,
    },
  });

  return { report, cached: false as const };
}
