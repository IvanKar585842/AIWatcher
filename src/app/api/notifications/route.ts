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
        const lean = searchParams.get("lean") === "1" || searchParams.get("lean") === "true";
        const limit = Math.min(
          Number(searchParams.get("limit") ?? (lean ? 15 : 50)) || (lean ? 15 : 50),
          lean ? 30 : 100
        );

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

        const alertWhere = {
          userId: user.id,
          ...(channel && channel !== NotificationChannel.IN_APP ? { id: "__no_match__" } : {}),
          ...(importance ? { id: "__no_match__" } : {}),
          ...(query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" as const } },
                  { explanation: { contains: query, mode: "insensitive" as const } },
                  { monitor: { name: { contains: query, mode: "insensitive" as const } } },
                ],
              }
            : {}),
        };

        if (lean) {
          const [notifications, alerts] = await Promise.all([
            prisma.notification.findMany({
              where,
              orderBy: { createdAt: "desc" },
              take: limit,
              select: {
                id: true,
                channel: true,
                status: true,
                createdAt: true,
                change: {
                  select: {
                    id: true,
                    summary: true,
                    emoji: true,
                    importance: true,
                    category: true,
                    createdAt: true,
                    monitor: { select: { name: true, url: true, mode: true } },
                  },
                },
              },
            }),
            prisma.monitorAlert.findMany({
              where: alertWhere,
              orderBy: { createdAt: "desc" },
              take: limit,
              select: {
                id: true,
                kind: true,
                title: true,
                explanation: true,
                errorKind: true,
                resolvedAt: true,
                createdAt: true,
                monitor: { select: { id: true, name: true, url: true, mode: true } },
              },
            }),
          ]);

          return NextResponse.json({
            success: true,
            notifications: [
              ...notifications.map((n) => ({
                ...n,
                type: "change" as const,
                change: {
                  ...n.change,
                  recommendedAction: defaultRecommendedAction(
                    n.change.importance,
                    n.change.category
                  ),
                },
              })),
              ...alerts.map((alert) => ({
                id: `monitor-alert:${alert.id}`,
                type: "monitor_error" as const,
                channel: NotificationChannel.IN_APP,
                status: alert.resolvedAt ? "RESOLVED" : "SENT",
                createdAt: alert.createdAt,
                monitorAlert: alert,
              })),
            ]
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(0, limit),
          });
        }

        const [notifications, alerts] = await Promise.all([
          prisma.notification.findMany({
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
          }),
          prisma.monitorAlert.findMany({
            where: alertWhere,
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
              monitor: { select: { id: true, name: true, url: true, mode: true } },
            },
          }),
        ]);

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

        const monitorAlerts = alerts.map((alert) => ({
          id: `monitor-alert:${alert.id}`,
          type: "monitor_error" as const,
          channel: NotificationChannel.IN_APP,
          status: alert.resolvedAt ? "RESOLVED" : "SENT",
          createdAt: alert.createdAt,
          monitorAlert: {
            id: alert.id,
            kind: alert.kind,
            title: alert.title,
            explanation: alert.explanation,
            possibleCause: alert.possibleCause,
            suggestedAction: alert.suggestedAction,
            errorKind: alert.errorKind,
            resolvedAt: alert.resolvedAt,
            monitor: alert.monitor,
          },
        }));

        return NextResponse.json({
          success: true,
          notifications: [...enriched, ...monitorAlerts]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit),
        });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
