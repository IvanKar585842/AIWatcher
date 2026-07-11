import { MonitorStatus, NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/db";

const DAYS = 30;

function sinceDays(days = DAYS): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** Per-user SaaS usage aggregates (no payments). */
export async function getUserUsage(userId: string, days = DAYS) {
  const since = sinceDays(days);

  const [monitors, aiRequests, monitoringChecks, notificationsSent, emailSent, telegramSent] =
    await Promise.all([
      prisma.monitor.count({ where: { userId } }),
      prisma.analyticsEvent.count({
        where: {
          userId,
          type: { in: ["ai.analysis", "ai.chat"] },
          createdAt: { gte: since },
        },
      }),
      prisma.analyticsEvent.count({
        where: { userId, type: "monitor.check", createdAt: { gte: since } },
      }),
      prisma.notification.count({
        where: {
          userId,
          status: "SENT",
          channel: { in: [NotificationChannel.EMAIL, NotificationChannel.TELEGRAM] },
          createdAt: { gte: since },
        },
      }),
      prisma.analyticsEvent.count({
        where: { userId, type: "email.sent", createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: { userId, type: "telegram.sent", createdAt: { gte: since } },
      }),
    ]);

  return {
    periodDays: days,
    monitors,
    aiRequests,
    monitoringChecks,
    notificationsSent,
    emailSent,
    telegramSent,
  };
}

/** Platform-wide usage for the admin dashboard. */
export async function getPlatformUsage(days = DAYS) {
  const since = sinceDays(days);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    activeMonitors,
    totalChecks,
    checksToday,
    aiRequests,
    aiRequestsToday,
    emailNotifications,
    emailsToday,
    telegramNotifications,
    errorMonitors,
    failedChecks,
    apiErrors,
    failedNotifications,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.monitor.count({ where: { status: MonitorStatus.ACTIVE } }),
    prisma.analyticsEvent.count({
      where: { type: "monitor.check", createdAt: { gte: since } },
    }),
    prisma.analyticsEvent.count({
      where: { type: "monitor.check", createdAt: { gte: today } },
    }),
    prisma.analyticsEvent.count({
      where: { type: { in: ["ai.analysis", "ai.chat"] }, createdAt: { gte: since } },
    }),
    prisma.analyticsEvent.count({
      where: { type: { in: ["ai.analysis", "ai.chat"] }, createdAt: { gte: today } },
    }),
    prisma.analyticsEvent.count({
      where: { type: "email.sent", createdAt: { gte: since } },
    }),
    prisma.analyticsEvent.count({
      where: { type: "email.sent", createdAt: { gte: today } },
    }),
    prisma.analyticsEvent.count({
      where: { type: "telegram.sent", createdAt: { gte: since } },
    }),
    prisma.monitor.count({ where: { status: MonitorStatus.ERROR } }),
    prisma.analyticsEvent.count({
      where: { type: "check.failed", createdAt: { gte: since } },
    }),
    prisma.analyticsEvent.count({
      where: { type: "api.error", createdAt: { gte: since } },
    }),
    prisma.notification.count({
      where: { status: "FAILED", createdAt: { gte: since } },
    }),
  ]);

  return {
    periodDays: days,
    totalUsers,
    activeMonitors,
    totalChecks,
    checksToday,
    aiRequests,
    aiRequestsToday,
    emailNotifications,
    emailsToday,
    telegramNotifications,
    errors: errorMonitors + failedChecks + apiErrors + failedNotifications,
    errorMonitors,
    failedChecks,
    apiErrors,
    failedNotifications,
  };
}
