import { MonitorStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const admin = await requireAdmin();
    return withRateLimit(
      "admin-system",
      async () => {
        const since = new Date();
        since.setDate(since.getDate() - 30);

        const [failedMonitors, failedNotifications, failedChecks, apiErrors] = await Promise.all([
          prisma.monitor.findMany({
            where: { status: MonitorStatus.ERROR },
            orderBy: { updatedAt: "desc" },
            take: 25,
            select: {
              id: true,
              name: true,
              url: true,
              errorMessage: true,
              errorCount: true,
              updatedAt: true,
              user: { select: { id: true, email: true } },
            },
          }),
          prisma.notification.findMany({
            where: { status: "FAILED", createdAt: { gte: since } },
            orderBy: { createdAt: "desc" },
            take: 25,
            select: {
              id: true,
              channel: true,
              error: true,
              createdAt: true,
              user: { select: { email: true } },
              change: {
                select: {
                  id: true,
                  summary: true,
                  monitor: { select: { name: true } },
                },
              },
            },
          }),
          prisma.analyticsEvent.findMany({
            where: { type: "check.failed", createdAt: { gte: since } },
            orderBy: { createdAt: "desc" },
            take: 25,
            select: {
              id: true,
              userId: true,
              metadata: true,
              createdAt: true,
            },
          }),
          prisma.analyticsEvent.findMany({
            where: { type: "api.error", createdAt: { gte: since } },
            orderBy: { createdAt: "desc" },
            take: 25,
            select: {
              id: true,
              userId: true,
              metadata: true,
              createdAt: true,
            },
          }),
        ]);

        return apiSuccess({
          failedMonitors,
          failedNotifications,
          failedChecks,
          apiErrors,
        });
      },
      admin.id,
      "admin"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
