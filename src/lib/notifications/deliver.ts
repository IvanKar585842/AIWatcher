import { NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { monitorLog } from "@/lib/monitoring/logger";

export async function createInAppNotification(
  userId: string,
  changeId: string
): Promise<void> {
  const existing = await prisma.notification.findFirst({
    where: { userId, changeId, channel: NotificationChannel.IN_APP },
  });

  if (existing) return;

  await prisma.notification.create({
    data: {
      userId,
      changeId,
      channel: NotificationChannel.IN_APP,
      status: "SENT",
      sentAt: new Date(),
    },
  });

  monitorLog({
    step: "database_updated",
    message: "In-app notification created",
    data: { changeId, channel: "IN_APP" },
  });
}

export async function createFallbackInAppNotification(
  userId: string,
  changeId: string,
  summary: string
): Promise<void> {
  await createInAppNotification(userId, changeId);

  await prisma.change.update({
    where: { id: changeId },
    data: { summary },
  });
}

export type AlertDelivery = {
  userId: string;
  changeId: string;
  summary: string;
  emoji: string;
  changes: string[];
  importance: string;
  shouldNotify: boolean;
};

export async function recordAlertDelivery(
  userId: string,
  changeId: string,
  channel: NotificationChannel,
  status: "SENT" | "FAILED" | "PENDING",
  error?: string
) {
  const existing = await prisma.notification.findFirst({
    where: { userId, changeId, channel },
  });

  if (existing) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        status,
        sentAt: status === "SENT" ? new Date() : undefined,
        error: error ?? null,
      },
    });
    return existing.id;
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      changeId,
      channel,
      status,
      sentAt: status === "SENT" ? new Date() : undefined,
      error,
    },
  });

  return notification.id;
}
