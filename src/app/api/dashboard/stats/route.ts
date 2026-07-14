import { NextResponse } from "next/server";
import { getAnalyticsSummary, trackEvent } from "@/lib/analytics";
import { MonitorStatus, ChangeImportance } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "dashboard-stats",
      async () => {
        void trackEvent({ type: "user.active", userId: user.id });
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
          statusGroups,
          changesToday,
          importantAlerts,
          recentChanges,
          recentNotifications,
          monitorActivity,
          monitors,
          successfulChecks,
          analytics,
        ] = await Promise.all([
          prisma.monitor.groupBy({
            by: ["status"],
            where: { userId: user.id },
            _count: { _all: true },
          }),
          prisma.change.count({
            where: {
              monitor: { userId: user.id },
              createdAt: { gte: today },
            },
          }),
          prisma.change.count({
            where: {
              monitor: { userId: user.id },
              createdAt: { gte: today },
              importance: { in: [ChangeImportance.HIGH, ChangeImportance.CRITICAL] },
            },
          }),
          prisma.change.findMany({
            where: { monitor: { userId: user.id } },
            orderBy: { createdAt: "desc" },
            take: 12,
            select: {
              id: true,
              summary: true,
              emoji: true,
              importance: true,
              category: true,
              createdAt: true,
              monitor: { select: { name: true, url: true } },
            },
          }),
          prisma.notification.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              channel: true,
              status: true,
              createdAt: true,
              change: {
                select: {
                  id: true,
                  summary: true,
                  emoji: true,
                  monitor: { select: { name: true } },
                },
              },
            },
          }),
          prisma.change.groupBy({
            by: ["monitorId"],
            where: { monitor: { userId: user.id } },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 1,
          }),
          prisma.monitor.findMany({
            where: { userId: user.id },
            select: {
              id: true,
              name: true,
              url: true,
              faviconUrl: true,
              status: true,
              lastChangedAt: true,
              errorCount: true,
              _count: { select: { changes: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          }),
          prisma.monitor.count({
            where: {
              userId: user.id,
              status: MonitorStatus.ACTIVE,
              errorCount: 0,
              lastCheckedAt: { not: null },
            },
          }),
          getAnalyticsSummary(user.id).catch(() => ({
            activeUsers: 1,
            activeMonitors: 0,
            changesDetected: 0,
            emailsSent: 0,
            avgAiResponseMs: 0,
          })),
        ]);

        const countByStatus = Object.fromEntries(
          statusGroups.map((g) => [g.status, g._count._all])
        ) as Partial<Record<MonitorStatus, number>>;

        const totalMonitors = statusGroups.reduce((s, g) => s + g._count._all, 0);
        const activeMonitors = countByStatus[MonitorStatus.ACTIVE] ?? 0;
        const pausedMonitors = countByStatus[MonitorStatus.PAUSED] ?? 0;
        const errorMonitors = countByStatus[MonitorStatus.ERROR] ?? 0;

        let mostActiveWebsite = null;
        if (monitorActivity.length > 0) {
          const top = monitors.find((m) => m.id === monitorActivity[0].monitorId);
          if (top) {
            mostActiveWebsite = {
              name: top.name,
              url: top.url,
              changeCount: monitorActivity[0]._count.id,
            };
          } else {
            const monitor = await prisma.monitor.findUnique({
              where: { id: monitorActivity[0].monitorId },
              select: { name: true, url: true },
            });
            mostActiveWebsite = monitor
              ? { ...monitor, changeCount: monitorActivity[0]._count.id }
              : null;
          }
        }

        const monitoringHealth =
          totalMonitors === 0
            ? 100
            : Math.round(((totalMonitors - errorMonitors) / totalMonitors) * 100);

        const aiAccuracy =
          activeMonitors === 0
            ? 100
            : Math.min(99, Math.round((successfulChecks / activeMonitors) * 100));

        return NextResponse.json(
          {
            stats: {
              totalMonitors,
              activeMonitors,
              pausedMonitors,
              errorMonitors,
              changesToday,
              importantAlerts,
              aiAccuracy,
              monitoringHealth,
              mostActiveWebsite,
              recentChanges,
              recentNotifications,
              monitors,
              analytics: {
                ...analytics,
                activeMonitors: analytics.activeMonitors || activeMonitors,
                changesDetected: analytics.changesDetected || changesToday,
              },
              avgResponseTime: analytics.avgAiResponseMs,
            },
          },
          {
            headers: {
              "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
            },
          }
        );
      },
      user.id
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to load dashboard stats" }, { status: 500 });
  }
}
