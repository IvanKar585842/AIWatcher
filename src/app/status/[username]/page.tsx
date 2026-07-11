import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChangeImportance } from "@prisma/client";
import { StatusPageView } from "@/components/status/status-page-view";
import { prisma } from "@/lib/db";
import {
  estimateUptimePercent,
  monitorPublicStatus,
  STATUS_LABELS,
  type PublicMonitorStatus,
} from "@/lib/status-page";
import { getDomainFromUrl } from "@/lib/utils";

type PageProps = { params: Promise<{ username: string }> };

async function loadStatusPage(usernameRaw: string) {
  const username = usernameRaw.trim().toLowerCase();
  if (!username) return null;

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
          lastCheckedAt: true,
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

  if (!user?.username) return null;

  const monitors = user.monitors.map((m) => {
    const status = monitorPublicStatus(m);
    return {
      id: m.id,
      name: m.name,
      domain: getDomainFromUrl(m.url),
      status,
      statusLabel: STATUS_LABELS[status],
      uptimePercent: estimateUptimePercent(m),
      lastSuccessfulCheck: m.status === "ERROR" ? null : m.lastCheckedAt?.toISOString() ?? null,
      lastCheckedAt: m.lastCheckedAt?.toISOString() ?? null,
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
        createdAt: c.createdAt.toISOString(),
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 12);

  let overall: PublicMonitorStatus = "operational";
  if (monitors.some((m) => m.status === "down")) overall = "down";
  else if (monitors.some((m) => m.status === "degraded")) overall = "degraded";
  else if (monitors.length > 0 && monitors.every((m) => m.status === "paused")) overall = "paused";

  return {
    username: user.username,
    title: user.statusPageTitle || `${user.name ?? user.username}'s status`,
    overall,
    overallLabel: STATUS_LABELS[overall],
    monitors,
    incidents,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const data = await loadStatusPage(username);
  if (!data) return { title: "Status — Not found" };
  return {
    title: `${data.title} | WatchFlowing`,
    description: `Public monitoring status for ${data.username}`,
  };
}

export default async function PublicStatusPage({ params }: PageProps) {
  const { username } = await params;
  const data = await loadStatusPage(username);
  if (!data) notFound();
  return <StatusPageView data={data} />;
}
