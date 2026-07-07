import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type AnalyticsEventType =
  | "user.active"
  | "monitor.check"
  | "change.detected"
  | "email.sent"
  | "ai.analysis";

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
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const where = userId ? { userId, createdAt: { gte: since } } : { createdAt: { gte: since } };

  const [changes, emails, aiEvents] = await Promise.all([
    prisma.analyticsEvent.count({ where: { ...where, type: "change.detected" } }),
    prisma.analyticsEvent.count({ where: { ...where, type: "email.sent" } }),
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
    : await prisma.analyticsEvent.groupBy({
        by: ["userId"],
        where: { type: "user.active", createdAt: { gte: since }, userId: { not: null } },
      }).then((r) => r.length);

  const activeMonitors = await prisma.monitor.count({
    where: { status: "ACTIVE", ...(userId ? { userId } : {}) },
  });

  return { activeUsers, activeMonitors, changesDetected: changes, emailsSent: emails, avgAiResponseMs: avgAiMs };
}
