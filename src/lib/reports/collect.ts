import { ReportFrequency, ReportType } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { WeeklyReportItem } from "./types";

export type ReportPeriod = {
  start: Date;
  end: Date;
  label: string;
};

export function getReportPeriod(
  frequency: ReportFrequency,
  now = new Date()
): ReportPeriod {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  if (frequency === "MONTHLY") {
    start.setDate(start.getDate() - 30);
  } else {
    start.setDate(start.getDate() - 7);
  }
  start.setHours(0, 0, 0, 0);

  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    start,
    end,
    label: `${fmt.format(start)} – ${fmt.format(end)}`,
  };
}

export type CollectedReportData = {
  monitorsActive: number;
  monitorsError: number;
  monitorsPaused: number;
  totalMonitors: number;
  changes: WeeklyReportItem[];
  byImportance: Record<string, number>;
  byDay: Array<{ date: string; count: number }>;
  importantCount: number;
};

/** Pull compact change summaries only — never raw HTML. */
export async function collectReportData(
  userId: string,
  period: ReportPeriod
): Promise<CollectedReportData> {
  const monitors = await prisma.monitor.findMany({
    where: { userId },
    select: { id: true, name: true, url: true, status: true },
  });

  const monitorIds = monitors.map((m) => m.id);
  const monitorsActive = monitors.filter((m) => m.status === "ACTIVE").length;
  const monitorsError = monitors.filter((m) => m.status === "ERROR").length;
  const monitorsPaused = monitors.filter((m) => m.status === "PAUSED").length;

  if (monitorIds.length === 0) {
    return {
      monitorsActive,
      monitorsError,
      monitorsPaused,
      totalMonitors: 0,
      changes: [],
      byImportance: {},
      byDay: [],
      importantCount: 0,
    };
  }

  // Cap rows for cost/control — prefer important first via order
  const rows = await prisma.change.findMany({
    where: {
      monitorId: { in: monitorIds },
      createdAt: { gte: period.start, lte: period.end },
    },
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      summary: true,
      importance: true,
      category: true,
      emoji: true,
      createdAt: true,
      monitor: { select: { name: true, url: true } },
    },
  });

  const changes: WeeklyReportItem[] = rows.map((r) => ({
    changeId: r.id,
    monitorName: r.monitor.name,
    monitorUrl: r.monitor.url,
    summary: r.summary.slice(0, 280),
    importance: r.importance,
    category: r.category,
    emoji: r.emoji || undefined,
    createdAt: r.createdAt.toISOString(),
  }));

  const byImportance: Record<string, number> = {};
  const byDayMap = new Map<string, number>();

  for (const c of changes) {
    byImportance[c.importance] = (byImportance[c.importance] ?? 0) + 1;
    const day = c.createdAt.slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
  }

  const byDay = Array.from(byDayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const importantCount = changes.filter(
    (c) => c.importance === "HIGH" || c.importance === "CRITICAL"
  ).length;

  return {
    monitorsActive,
    monitorsError,
    monitorsPaused,
    totalMonitors: monitors.length,
    changes,
    byImportance,
    byDay,
    importantCount,
  };
}

export function isSeoCategory(category: string, summary: string): boolean {
  const hay = `${category} ${summary}`.toLowerCase();
  return /seo|title|meta|robots|sitemap|canonical|h1|schema|og:|open graph/.test(
    hay
  );
}

export function isCompetitorish(category: string, summary: string): boolean {
  const hay = `${category} ${summary}`.toLowerCase();
  return /competitor|pricing|price|tier|plan|feature|launch|product/.test(hay);
}

export function toneForReportType(type: ReportType): string {
  switch (type) {
    case "DEVELOPER":
      return "Focus on technical regressions, broken elements, and release risk.";
    case "SEO":
      return "Focus on SEO signals: titles, meta, robots, structure, indexability.";
    case "COMPETITOR":
      return "Focus on competitive moves: pricing, offers, product messaging.";
    case "BUSINESS":
    default:
      return "Focus on business impact, conversions, and what leadership should review.";
  }
}
