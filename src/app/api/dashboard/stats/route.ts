import { NextResponse } from "next/server";
import { MonitorStatus, ChangeImportance } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  return withRateLimit("dashboard-stats", async () => {
    try {
      const user = await requireUser();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [
        totalMonitors,
        activeMonitors,
        errorMonitors,
        changesToday,
        importantAlerts,
        recentChanges,
        recentNotifications,
        monitorActivity,
        monitors,
        successfulChecks,
      ] = await Promise.all([
        prisma.monitor.count({ where: { userId: user.id } }),
        prisma.monitor.count({
          where: { userId: user.id, status: MonitorStatus.ACTIVE },
        }),
        prisma.monitor.count({
          where: { userId: user.id, status: MonitorStatus.ERROR },
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
          include: { monitor: { select: { name: true, url: true } } },
        }),
        prisma.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
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
      ]);

      let mostActiveWebsite = null;
      if (monitorActivity.length > 0) {
        const monitor = await prisma.monitor.findUnique({
          where: { id: monitorActivity[0].monitorId },
          select: { name: true, url: true },
        });
        mostActiveWebsite = monitor
          ? { ...monitor, changeCount: monitorActivity[0]._count.id }
          : null;
      }

      const monitoringHealth =
        totalMonitors === 0
          ? 100
          : Math.round(((totalMonitors - errorMonitors) / totalMonitors) * 100);

      const aiAccuracy =
        activeMonitors === 0
          ? 100
          : Math.min(99, Math.round((successfulChecks / activeMonitors) * 100));

      return NextResponse.json({
        stats: {
          totalMonitors,
          activeMonitors,
          changesToday,
          importantAlerts,
          aiAccuracy,
          monitoringHealth,
          mostActiveWebsite,
          recentChanges,
          recentNotifications,
          monitors,
        },
      });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  });
}
