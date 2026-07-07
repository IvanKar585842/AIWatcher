import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit("notifications-list", async () => {
      const notifications = await prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          change: {
            select: {
              id: true,
              summary: true,
              emoji: true,
              importance: true,
              createdAt: true,
              monitor: { select: { name: true, url: true } },
            },
          },
        },
      });

      return NextResponse.json({ success: true, notifications });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}
