import { ChangeImportance, MonitorStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DashboardStatsOptions = {
  /** Skip recentNotifications query — load when Feed → Notifications tab opens */
  lean?: boolean;
};

export async function buildDashboardStats(userId: string, options: DashboardStatsOptions = {}) {
  const lean = options.lean ?? false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    statusGroups,
    changesToday,
    importantAlertChanges,
    recentChanges,
    recentNotifications,
    monitorActivity,
    monitors,
    successfulChecks,
  ] = await Promise.all([
    prisma.monitor.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.change.count({
      where: {
        monitor: { userId },
        createdAt: { gte: today },
      },
    }),
    prisma.change.findMany({
      where: {
        monitor: { userId },
        createdAt: { gte: today },
        importance: { in: [ChangeImportance.HIGH, ChangeImportance.CRITICAL] },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        summary: true,
        emoji: true,
        importance: true,
        createdAt: true,
        monitor: { select: { name: true } },
      },
    }),
    prisma.change.findMany({
      where: { monitor: { userId } },
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
    lean
      ? Promise.resolve([])
      : prisma.notification.findMany({
          where: { userId },
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
      where: { monitor: { userId } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    }),
    prisma.monitor.findMany({
      where: { userId },
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
        userId,
        status: MonitorStatus.ACTIVE,
        errorCount: 0,
        lastCheckedAt: { not: null },
      },
    }),
  ]);

  const countByStatus = Object.fromEntries(
    statusGroups.map((g) => [g.status, g._count._all])
  ) as Partial<Record<MonitorStatus, number>>;

  const totalMonitors = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const activeMonitors = countByStatus[MonitorStatus.ACTIVE] ?? 0;
  const pausedMonitors = countByStatus[MonitorStatus.PAUSED] ?? 0;
  const errorMonitors = countByStatus[MonitorStatus.ERROR] ?? 0;

  let mostActiveWebsite: {
    name: string;
    url: string;
    changeCount: number;
  } | null = null;

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

  return {
    totalMonitors,
    activeMonitors,
    pausedMonitors,
    errorMonitors,
    changesToday,
    importantAlerts: importantAlertChanges.length,
    importantAlertChanges,
    aiAccuracy,
    monitoringHealth,
    mostActiveWebsite,
    recentChanges,
    recentNotifications,
    monitors,
    analytics: {
      activeUsers: 1,
      activeMonitors,
      changesDetected: changesToday,
      emailsSent: 0,
      avgAiResponseMs: 0,
    },
    avgResponseTime: 0,
    lean,
  };
}

export function buildUserContextPayload(user: {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  onboardingCompleted?: boolean | null;
  isAdmin: boolean;
  plan: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? "USER",
    isAdmin: user.isAdmin,
    plan: user.plan,
    onboardingCompleted: Boolean(user.onboardingCompleted),
  };
}
