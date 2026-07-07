import { MonitorStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError, apiSuccess } from "@/lib/api-response";

export async function GET() {
  try {
    await requireAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      adminUsers,
      totalMonitors,
      activeMonitors,
      errorMonitors,
      changesToday,
      pendingAnalyses,
      recentUsers,
      recentErrors,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.monitor.count(),
      prisma.monitor.count({ where: { status: MonitorStatus.ACTIVE } }),
      prisma.monitor.count({ where: { status: MonitorStatus.ERROR } }),
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
      totalUsers,
      adminUsers,
      totalMonitors,
      activeMonitors,
      errorMonitors,
      changesToday,
      pendingAnalyses,
      recentUsers,
      recentErrors,
    });
  } catch (error) {
    return apiFailureFromError(error);
  }
}
