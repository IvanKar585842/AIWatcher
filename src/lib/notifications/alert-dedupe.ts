import { NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { alertsLookRelated, shouldFoldRepeat } from "@/lib/notifications/alert-group";

/** Default cooldown for identical outbound alerts (same monitor + channel + summary). */
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;
/** Same client and the same kind of change. A higher importance still sends. */
const CLIENT_GROUP_MS = 30 * 60 * 1000;

/**
 * Prevents spam when a page flaps with the same change repeatedly.
 * Also blocks re-sending the same changeId on the same channel.
 */
export async function shouldSkipDuplicateOutboundAlert(params: {
  userId: string;
  changeId: string;
  monitorId: string;
  channel: NotificationChannel;
  summary: string;
  cooldownMs?: number;
  clientId?: string | null;
  category?: string | null;
  importance?: string | null;
}): Promise<{ skip: boolean; reason?: string }> {
  const alreadyForChange = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      changeId: params.changeId,
      channel: params.channel,
      status: "SENT",
    },
    select: { id: true },
  });

  if (alreadyForChange) {
    return { skip: true, reason: "already_sent_for_change" };
  }

  const since = new Date(Date.now() - (params.cooldownMs ?? DEFAULT_COOLDOWN_MS));
  const identicalRecent = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      channel: params.channel,
      status: "SENT",
      createdAt: { gte: since },
      change: {
        monitorId: params.monitorId,
        summary: params.summary,
      },
    },
    select: { id: true },
  });

  if (identicalRecent) {
    return { skip: true, reason: "identical_cooldown" };
  }

  if (params.clientId) {
    const groupedSince = new Date(Date.now() - CLIENT_GROUP_MS);
    const recent = await prisma.notification.findMany({
      where: {
        userId: params.userId,
        channel: params.channel,
        status: "SENT",
        createdAt: { gte: groupedSince },
        change: { monitor: { clientId: params.clientId } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { change: { select: { summary: true, category: true, importance: true } } },
    });
    const folded = recent.some((row) =>
      shouldFoldRepeat({
        related: alertsLookRelated(
          { summary: params.summary, category: params.category },
          { summary: row.change.summary, category: row.change.category }
        ),
        previousImportance: row.change.importance,
        nextImportance: params.importance,
      })
    );
    if (folded) return { skip: true, reason: "client_group" };
  }

  return { skip: false };
}
