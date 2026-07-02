import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  return withRateLimit("dashboard-stats", async () => {
    try {
      const user = await requireUser();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalMonitors, changesToday, recentChanges, recentNotifications, monitorActivity] =
        await Promise.all([
          prisma.monitor.count({ where: { userId: user.id } }),
          prisma.change.count({
            where: {
              monitor: { userId: user.id },
              createdAt: { gte: today },
            },
          }),
          prisma.change.findMany({
            where: { monitor: { userId: user.id } },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { monitor: { select: { name: true, url: true } } },
          }),
          prisma.notification.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
              change: {
                include: { monitor: { select: { name: true } } },
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

      return NextResponse.json({
        stats: {
          totalMonitors,
          changesToday,
          mostActiveWebsite,
          recentChanges,
          recentNotifications,
        },
      });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  });
}
