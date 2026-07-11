import { NextRequest, NextResponse } from "next/server";
import { ChangeImportance, NotificationChannel, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { defaultRecommendedAction } from "@/lib/ai/types";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "notifications-list",
      async () => {
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get("q") ?? "").trim();
        const importanceParam = searchParams.get("importance")?.trim();
        const channelParam = searchParams.get("channel")?.trim();
        const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 100);

        const importance =
          importanceParam &&
          Object.values(ChangeImportance).includes(importanceParam as ChangeImportance)
            ? (importanceParam as ChangeImportance)
            : undefined;
        const channel =
          channelParam &&
          Object.values(NotificationChannel).includes(channelParam as NotificationChannel)
            ? (channelParam as NotificationChannel)
            : undefined;

        const where: Prisma.NotificationWhereInput = {
          userId: user.id,
          ...(channel ? { channel } : {}),
          change: {
            ...(importance ? { importance } : {}),
            ...(query
              ? {
                  OR: [
                    { summary: { contains: query, mode: "insensitive" } },
                    { monitor: { name: { contains: query, mode: "insensitive" } } },
                  ],
                }
              : {}),
          },
        };

        const notifications = await prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            change: {
              select: {
                id: true,
                summary: true,
                emoji: true,
                importance: true,
                category: true,
                bulletPoints: true,
                oldValue: true,
                newValue: true,
                createdAt: true,
                aiRawResponse: true,
                monitor: { select: { name: true, url: true, mode: true } },
              },
            },
          },
        });

        const enriched = notifications.map((n) => {
          const raw =
            n.change.aiRawResponse &&
            typeof n.change.aiRawResponse === "object" &&
            !Array.isArray(n.change.aiRawResponse)
              ? (n.change.aiRawResponse as Record<string, unknown>)
              : {};
          const recommendedAction =
            (typeof raw.recommendedAction === "string" && raw.recommendedAction) ||
            defaultRecommendedAction(n.change.importance, n.change.category);

          const { aiRawResponse: _omit, ...changeRest } = n.change;

          return {
            ...n,
            change: {
              ...changeRest,
              recommendedAction,
            },
          };
        });

        return NextResponse.json({ success: true, notifications: enriched });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
