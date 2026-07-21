import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type AnalyticsEventType =
  | "user.active"
  | "user.signup"
  | "monitor.check"
  | "monitor.created"
  | "monitor.first_created"
  | "check.failed"
  | "change.detected"
  | "alert.first"
  | "email.sent"
  | "telegram.sent"
  | "ai.analysis"
  | "ai.chat"
  | "ai.failed"
  | "api.error"
  | "cron.monitoring"
  | "cron.failed"
  | "onboarding.completed"
  | "checkout.started"
  | "subscription.upgraded"
  | "subscription.canceled"
  | "report_created"
  | "report_shared"
  | "badge_installed"
  | "referral_created"
  | "signup_from_report"
  | "score_generated";

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

/** Avoid write amplification from dashboard polls (one write per user per TTL). */
const lastUserActiveAt = new Map<string, number>();
const USER_ACTIVE_TTL_MS = 5 * 60 * 1000;

export function trackUserActiveThrottled(userId: string): void {
  const now = Date.now();
  const prev = lastUserActiveAt.get(userId) ?? 0;
  if (now - prev < USER_ACTIVE_TTL_MS) return;
  lastUserActiveAt.set(userId, now);
  void trackEvent({ type: "user.active", userId });
}

export async function getAnalyticsSummary(userId?: string) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const where = userId ? { userId, createdAt: { gte: since } } : { createdAt: { gte: since } };

    const [changes, emails, checks, aiEvents, signups, upgrades] = await Promise.all([
      prisma.analyticsEvent.count({ where: { ...where, type: "change.detected" } }),
      prisma.analyticsEvent.count({ where: { ...where, type: "email.sent" } }),
      prisma.analyticsEvent.count({ where: { ...where, type: "monitor.check" } }),
      prisma.analyticsEvent.findMany({
        where: { ...where, type: "ai.analysis", durationMs: { not: null } },
        select: { durationMs: true },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      prisma.analyticsEvent.count({ where: { ...where, type: "user.signup" } }),
      prisma.analyticsEvent.count({ where: { ...where, type: "subscription.upgraded" } }),
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
      signups,
      upgrades,
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
      signups: 0,
      upgrades: 0,
    };
  }
}
