import { MonitorAlertKind, NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { MonitoringErrorInfo } from "@/lib/monitoring/error-messages";
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

/**
 * Record a monitor-health alert exclusively for the in-app notification center.
 * This never enters outbound delivery, email, Telegram, quota, or dedupe paths.
 */
export async function createMonitorErrorAlert(input: {
  userId: string;
  monitorId: string;
  error: MonitoringErrorInfo;
  errorCount: number;
  becameErrored: boolean;
}): Promise<void> {
  const kind = input.becameErrored
    ? MonitorAlertKind.MONITOR_ERROR
    : MonitorAlertKind.CHECK_FAILED;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.monitorAlert.findFirst({
    where: {
      monitorId: input.monitorId,
      kind,
      createdAt: { gte: since },
      resolvedAt: null,
    },
    select: { id: true, errorKind: true },
  });

  // One live health alert of each kind per monitor/day. A changed failure mode
  // is meaningful enough to surface without creating a noisy repeat stream.
  if (recent?.errorKind === input.error.kind) return;

  await prisma.monitorAlert.create({
    data: {
      userId: input.userId,
      monitorId: input.monitorId,
      kind,
      title: input.becameErrored
        ? `Monitoring paused: ${input.error.statusLabel}`
        : input.error.title,
      explanation: input.becameErrored
        ? `${input.error.description} WatchFlowing paused this monitor after ${input.errorCount} unsuccessful checks.`
        : input.error.description,
      possibleCause: input.error.technical
        ? input.error.technical.slice(0, 500)
        : "The website did not complete a monitor check as expected.",
      suggestedAction: input.error.suggestions[0] ?? "Retry the monitor check.",
      errorKind: input.error.kind,
    },
  });

  monitorLog({
    step: "database_updated",
    monitorId: input.monitorId,
    message: "In-app monitor error alert created",
    data: { kind, errorKind: input.error.kind },
  });
}

/** Resolve current health alerts after the next successful monitor check. */
export async function resolveMonitorErrorAlerts(monitorId: string): Promise<void> {
  await prisma.monitorAlert.updateMany({
    where: { monitorId, resolvedAt: null },
    data: { resolvedAt: new Date() },
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
