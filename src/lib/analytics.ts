import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type AnalyticsEventType =
  | "user.active"
  | "monitor.check"
  | "check.failed"
  | "change.detected"
  | "email.sent"
  | "telegram.sent"
  | "ai.analysis"
  | "ai.chat"
  | "api.error";

interface TrackEventParams {
  type: AnalyticsEventType;
  userId?: string;
  metadata?: Record<string, unknown>;
  durationMs?: number;
}

export async function trackEvent(params: TrackEventParams): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        type: params.type,
        userId: params.userId ?? null,
        metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        durationMs: params.durationMs ?? null,
      },
    });
  } catch {
    // Analytics must never break the main flow
  }
}

export async function getAnalyticsSummary(userId?: string) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const where = userId ? { userId, createdAt: { gte: since } } : { createdAt: { gte: since } };

    const [changes, emails, checks, aiEvents] = await Promise.all([
      prisma.analyticsEvent.count({ where: { ...where, type: "change.detected" } }),
      prisma.analyticsEvent.count({ where: { ...where, type: "email.sent" } }),
      prisma.analyticsEvent.count({ where: { ...where, type: "monitor.check" } }),
      prisma.analyticsEvent.findMany({
        where: { ...where, type: "ai.analysis", durationMs: { not: null } },
        select: { durationMs: true },
        take: 500,
      }),
    ]);

    const avgAiMs =
      aiEvents.length > 0
        ? Math.round(aiEvents.reduce((s, e) => s + (e.durationMs ?? 0), 0) / aiEvents.length)
        : 0;

    const activeUsers = userId
      ? 1
      : await prisma.analyticsEvent
          .groupBy({
            by: ["userId"],
            where: { type: "user.active", createdAt: { gte: since }, userId: { not: null } },
          })
          .then((r) => r.length);

    const activeMonitors = await prisma.monitor.count({
      where: { status: "ACTIVE", ...(userId ? { userId } : {}) },
    });

    return {
      activeUsers,
      activeMonitors,
      changesDetected: changes,
      emailsSent: emails,
      monitoringChecks: checks,
      avgAiResponseMs: avgAiMs,
    };
  } catch {
    const activeMonitors = await prisma.monitor
      .count({ where: { status: "ACTIVE", ...(userId ? { userId } : {}) } })
      .catch(() => 0);

    return {
      activeUsers: 0,
      activeMonitors,
      changesDetected: 0,
      emailsSent: 0,
      monitoringChecks: 0,
      avgAiResponseMs: 0,
    };
  }
}
