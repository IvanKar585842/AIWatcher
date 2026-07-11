import { NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Default cooldown for identical outbound alerts (same monitor + channel + summary). */
const DEFAULT_COOLDOWN_MS = 15 * 60 * 1000;

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

  return { skip: false };
}
