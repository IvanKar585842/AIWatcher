import { MonitorStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { getPlatformUsage } from "@/lib/usage";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const admin = await requireAdmin();
    return withRateLimit(
      "admin-stats",
      async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
          usage,
          adminUsers,
          totalMonitors,
          activeSubscriptions,
          changesToday,
          pendingAnalyses,
          recentUsers,
          recentErrors,
        ] = await Promise.all([
            getPlatformUsage(30),
            prisma.user.count({ where: { role: "ADMIN" } }),
            prisma.monitor.count(),
            prisma.subscription.count({
              where: {
                status: "active",
                plan: { not: "FREE" },
              },
            }),
            prisma.change.count({ where: { createdAt: { gte: today } } }),
            prisma.change.count({ where: { analysisStatus: "PENDING" } }),
            prisma.user.findMany({
              orderBy: { createdAt: "desc" },
              take: 10,
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                subscription: { select: { plan: true } },
                _count: { select: { monitors: true } },
              },
            }),
            prisma.monitor.findMany({
              where: { status: MonitorStatus.ERROR },
              orderBy: { updatedAt: "desc" },
              take: 8,
              select: {
                id: true,
                name: true,
                url: true,
                errorMessage: true,
                errorCount: true,
                user: { select: { email: true } },
              },
            }),
          ]);

        return apiSuccess({
          totalUsers: usage.totalUsers,
          adminUsers,
          totalMonitors,
          activeMonitors: usage.activeMonitors,
          activeSubscriptions,
          errorMonitors: usage.errorMonitors,
          totalChecks: usage.totalChecks,
          checksToday: usage.checksToday,
          aiRequests: usage.aiRequests,
          aiRequestsToday: usage.aiRequestsToday,
          emailNotifications: usage.emailNotifications,
          emailsToday: usage.emailsToday,
          telegramNotifications: usage.telegramNotifications,
          errors: usage.errors,
          failedChecks: usage.failedChecks,
          apiErrors: usage.apiErrors,
          failedNotifications: usage.failedNotifications,
          changesToday,
          pendingAnalyses,
          recentUsers,
          recentErrors,
        });
      },
      admin.id,
      "admin"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
