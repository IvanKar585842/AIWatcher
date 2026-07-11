import { NextRequest, NextResponse } from "next/server";
import { ChangeImportance } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  estimateUptimePercent,
  monitorPublicStatus,
  STATUS_LABELS,
} from "@/lib/status-page";
import { getDomainFromUrl } from "@/lib/utils";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: raw } = await params;
  const username = raw.trim().toLowerCase();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anon";

  return withRateLimit(
    `status-page:${username || "empty"}:${ip}`,
    async () => {
      if (!username) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const user = await prisma.user.findFirst({
        where: { username, statusPageEnabled: true },
        select: {
          username: true,
          name: true,
          statusPageTitle: true,
          monitors: {
            where: { statusPageVisible: true },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              url: true,
              status: true,
              errorCount: true,
              errorMessage: true,
              lastCheckedAt: true,
              lastChangedAt: true,
              changes: {
                where: {
                  importance: { in: [ChangeImportance.HIGH, ChangeImportance.CRITICAL] },
                },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  id: true,
                  summary: true,
                  emoji: true,
                  importance: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        return NextResponse.json({ error: "Status page not found" }, { status: 404 });
      }

      const monitors = user.monitors.map((m) => {
        const publicStatus = monitorPublicStatus(m);
        return {
          id: m.id,
          name: m.name,
          domain: getDomainFromUrl(m.url),
          status: publicStatus,
          statusLabel: STATUS_LABELS[publicStatus],
          uptimePercent: estimateUptimePercent(m),
          lastSuccessfulCheck: m.status === "ERROR" ? null : m.lastCheckedAt,
          lastCheckedAt: m.lastCheckedAt,
          lastChangedAt: m.lastChangedAt,
        };
      });

      const incidents = user.monitors
        .flatMap((m) =>
          m.changes.map((c) => ({
            id: c.id,
            monitorName: m.name,
            summary: c.summary,
            emoji: c.emoji,
            importance: c.importance,
            createdAt: c.createdAt,
          }))
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 12);

      const overall =
        monitors.some((m) => m.status === "down")
          ? "down"
          : monitors.some((m) => m.status === "degraded")
            ? "degraded"
            : monitors.length === 0
              ? "operational"
              : monitors.every((m) => m.status === "paused")
                ? "paused"
                : "operational";

      return NextResponse.json({
        username: user.username,
        title: user.statusPageTitle || `${user.name ?? user.username}'s status`,
        overall,
        overallLabel: STATUS_LABELS[overall],
        monitors,
        incidents,
        updatedAt: new Date().toISOString(),
      });
    },
    null,
    "public"
  );
}
