import { requireUser } from "@/lib/auth";
import { getUserPlanLimits, isAdminUser, getEffectivePlan } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { getAnalyticsSummary } from "@/lib/analytics";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit("billing-overview", async () => {
      const plan = getEffectivePlan(user);
      const limits = getUserPlanLimits(user);
      const admin = isAdminUser(user);

      const since = new Date();
      since.setDate(since.getDate() - 30);

      const [monitorCount, notificationCount, changeCount, analytics] = await Promise.all([
        prisma.monitor.count({ where: { userId: user.id } }),
        prisma.notification.count({
          where: { userId: user.id, createdAt: { gte: since } },
        }),
        prisma.change.count({
          where: { monitor: { userId: user.id } },
        }),
        getAnalyticsSummary(user.id),
      ]);

      const aiUsage = await prisma.analyticsEvent.count({
        where: { userId: user.id, type: "ai.analysis", createdAt: { gte: since } },
      });

      const storageMb = Math.round(changeCount * 0.12 * 10) / 10;
      const storageLimitMb = admin ? null : plan === "FREE" ? 50 : plan === "PRO" ? 5000 : null;

      return apiSuccess({
        plan,
        isAdmin: admin,
        limits: {
          maxMonitors: limits.maxMonitors === Infinity ? null : limits.maxMonitors,
          aiSummaries: limits.aiSummaries,
          telegram: limits.telegram,
        },
        usage: {
          monitors: monitorCount,
          aiAnalyses: aiUsage,
          notifications: notificationCount,
          storageMb,
        },
        storageLimitMb,
        aiLimit: admin ? null : plan === "FREE" ? 50 : plan === "PRO" ? 5000 : null,
        notificationLimit: admin ? null : plan === "FREE" ? 100 : plan === "PRO" ? 10000 : null,
      });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}
