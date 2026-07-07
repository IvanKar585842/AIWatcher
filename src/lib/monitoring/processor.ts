import {
  MonitorStatus,
  NotificationChannel,
  NotificationMethod,
  Plan,
  type Monitor,
  type Prisma,
} from "@prisma/client";
import { getAIProvider, toPrismaCategory, toPrismaImportance } from "@/lib/ai";
import { trackEvent } from "@/lib/analytics";
import { INTERVAL_MINUTES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { parseMonitorConfig } from "@/lib/monitor-config";
import { sendChangeEmail } from "@/lib/notifications/email";
import { sendTelegramChangeNotification } from "@/lib/notifications/telegram";
import { compressHtml } from "./compress";
import { hasMeaningfulChange } from "./content-cleaner";
import { generateTextDiff } from "./diff";
import { closeBrowser, fetchPageContent } from "./fetcher";
import { acquireMonitorLock, releaseMonitorLock } from "./lock";

const DEFAULT_MAX_RETRIES = 3;

export async function processMonitor(monitorId: string): Promise<void> {
  if (!acquireMonitorLock(monitorId)) {
    return;
  }

  try {
    await processMonitorInternal(monitorId);
  } finally {
    releaseMonitorLock(monitorId);
    await closeBrowser();
  }
}

async function processMonitorInternal(monitorId: string): Promise<void> {
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    include: {
      user: {
        include: { subscription: true },
      },
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!monitor || monitor.status !== MonitorStatus.ACTIVE) {
    return;
  }

  const plan = monitor.user.subscription?.plan ?? Plan.FREE;
  const config = parseMonitorConfig(monitor.config);
  const maxRetries = config.retryAttempts ?? DEFAULT_MAX_RETRIES;

  try {
    const result = await fetchPageContent({
      url: monitor.url,
      mode: monitor.mode,
      selector: monitor.selector,
      keywords: monitor.keywords,
      respectRobots: monitor.respectRobots,
      timeout: config.timeout,
      ignoreAds: config.ignoreAds,
      cleanOptions: {
        ignoreTimestamps: config.ignoreTimestamps,
        ignoreRandomIds: config.ignoreRandomIds,
        ignoreDynamicContent: config.ignoreDynamicContent,
      },
    });

    const previousSnapshot = monitor.snapshots[0];
    const now = new Date();
    const nextCheckAt = new Date(
      now.getTime() + INTERVAL_MINUTES[monitor.interval] * 60 * 1000
    );

    const compressedCleaned = await compressHtml(result.cleanedHtml);

    if (!previousSnapshot) {
      await prisma.snapshot.create({
        data: {
          monitorId: monitor.id,
          rawHtml: "",
          cleanedHtml: compressedCleaned,
          contentHash: result.contentHash,
          extractedText: result.extractedText,
          metadata: result.metadata as Prisma.InputJsonValue,
        },
      });

      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          lastCheckedAt: now,
          nextCheckAt,
          errorCount: 0,
          errorMessage: null,
        },
      });

      await trackEvent({ type: "monitor.check", userId: monitor.userId, metadata: { monitorId } });
      return;
    }

    if (previousSnapshot.contentHash === result.contentHash) {
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          lastCheckedAt: now,
          nextCheckAt,
          errorCount: 0,
          errorMessage: null,
        },
      });
      return;
    }

    if (!hasMeaningfulChange(previousSnapshot.extractedText ?? "", result.extractedText)) {
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          lastCheckedAt: now,
          nextCheckAt,
          errorCount: 0,
          errorMessage: null,
        },
      });
      return;
    }

    const oldHtml = previousSnapshot.cleanedHtml;
    const newHtml = result.cleanedHtml;
    const oldContent = previousSnapshot.extractedText ?? oldHtml;
    const newContent = result.extractedText;

    let analysis;
    const userPrompt =
      monitor.aiPrompt?.trim() ||
      (monitor.keywords.length > 0 ? monitor.keywords.join(", ") : undefined);

    if (plan === Plan.FREE) {
      analysis = {
        summary: "Content changed on the monitored page.",
        importance: "MEDIUM" as const,
        category: "CONTENT" as const,
        old_value: null,
        new_value: null,
        changes: ["Page content has been updated"],
        bullet_points: ["Page content has been updated"],
        shouldNotify: true,
        emoji: "🔔",
      };
    } else {
      const ai = getAIProvider();
      const started = Date.now();
      analysis = await ai.analyzeChange({
        url: monitor.url,
        monitorName: monitor.name,
        mode: monitor.mode,
        oldHtml: oldContent.slice(0, 12000),
        newHtml: newContent.slice(0, 12000),
        userPrompt,
      });
      await trackEvent({
        type: "ai.analysis",
        userId: monitor.userId,
        durationMs: Date.now() - started,
        metadata: { monitorId, importance: analysis.importance },
      });
    }

    if (!analysis.shouldNotify) {
      await prisma.snapshot.create({
        data: {
          monitorId: monitor.id,
          rawHtml: "",
          cleanedHtml: compressedCleaned,
          contentHash: result.contentHash,
          extractedText: result.extractedText,
          metadata: result.metadata as Prisma.InputJsonValue,
        },
      });

      await prisma.monitor.update({
        where: { id: monitor.id },
        data: { lastCheckedAt: now, nextCheckAt, errorCount: 0, errorMessage: null },
      });
      return;
    }

    const diffHtml = generateTextDiff(oldContent.slice(0, 5000), newContent.slice(0, 5000));
    const changes = analysis.changes ?? analysis.bullet_points ?? [];

    const change = await prisma.change.create({
      data: {
        monitorId: monitor.id,
        summary: analysis.summary,
        importance: toPrismaImportance(analysis.importance),
        category: toPrismaCategory(analysis.category),
        oldValue: analysis.old_value ?? null,
        newValue: analysis.new_value ?? null,
        bulletPoints: changes,
        emoji: analysis.emoji,
        oldHtml: oldHtml.slice(0, 50000),
        newHtml: newHtml.slice(0, 50000),
        diffHtml,
        aiRawResponse: analysis as Prisma.InputJsonValue,
      },
    });

    await prisma.snapshot.create({
      data: {
        monitorId: monitor.id,
        rawHtml: "",
        cleanedHtml: compressedCleaned,
        contentHash: result.contentHash,
        extractedText: result.extractedText,
        metadata: result.metadata as Prisma.InputJsonValue,
      },
    });

    await prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        lastCheckedAt: now,
        lastChangedAt: now,
        nextCheckAt,
        errorCount: 0,
        errorMessage: null,
      },
    });

    await trackEvent({
      type: "change.detected",
      userId: monitor.userId,
      metadata: { monitorId, changeId: change.id, importance: analysis.importance },
    });

    await sendNotifications(monitor, change.id, {
      summary: analysis.summary,
      emoji: analysis.emoji,
      changes,
      importance: analysis.importance,
      shouldNotify: analysis.shouldNotify,
    });
    await cleanupOldHistory(monitor.id, plan);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorCount = monitor.errorCount + 1;

    await prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        errorCount,
        errorMessage,
        status: errorCount >= maxRetries ? MonitorStatus.ERROR : monitor.status,
        lastCheckedAt: new Date(),
        nextCheckAt: new Date(Date.now() + INTERVAL_MINUTES[monitor.interval] * 60 * 1000),
      },
    });

    throw error;
  }
}

async function sendNotifications(
  monitor: Monitor & { user: { email: string; telegramChatId: string | null } },
  changeId: string,
  analysis: {
    summary: string;
    emoji: string;
    changes: string[];
    importance: string;
    shouldNotify: boolean;
  }
) {
  if (!analysis.shouldNotify) return;

  const tasks: Promise<void>[] = [];

  if (
    monitor.notificationMethod === NotificationMethod.EMAIL ||
    monitor.notificationMethod === NotificationMethod.BOTH
  ) {
    tasks.push(
      (async () => {
        const notification = await prisma.notification.create({
          data: {
            userId: monitor.userId,
            changeId,
            channel: NotificationChannel.EMAIL,
            status: "PENDING",
          },
        });

        try {
          await sendChangeEmail({
            to: monitor.user.email,
            monitorName: monitor.name,
            url: monitor.url,
            summary: analysis.summary,
            emoji: analysis.emoji,
            changes: analysis.changes,
            importance: analysis.importance,
            changeId,
          });

          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: "SENT", sentAt: new Date() },
          });

          await trackEvent({ type: "email.sent", userId: monitor.userId, metadata: { changeId } });
        } catch (err) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: "FAILED",
              error: err instanceof Error ? err.message : "Send failed",
            },
          });
        }
      })()
    );
  }

  if (
    (monitor.notificationMethod === NotificationMethod.TELEGRAM ||
      monitor.notificationMethod === NotificationMethod.BOTH) &&
    monitor.user.telegramChatId
  ) {
    tasks.push(
      (async () => {
        const notification = await prisma.notification.create({
          data: {
            userId: monitor.userId,
            changeId,
            channel: NotificationChannel.TELEGRAM,
            status: "PENDING",
          },
        });

        try {
          await sendTelegramChangeNotification({
            chatId: monitor.user.telegramChatId!,
            monitorName: monitor.name,
            url: monitor.url,
            summary: analysis.summary,
            emoji: analysis.emoji,
            bulletPoints: analysis.changes,
            importance: analysis.importance,
          });

          await prisma.notification.update({
            where: { id: notification.id },
            data: { status: "SENT", sentAt: new Date() },
          });
        } catch (err) {
          await prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: "FAILED",
              error: err instanceof Error ? err.message : "Send failed",
            },
          });
        }
      })()
    );
  }

  await Promise.allSettled(tasks);
}

async function cleanupOldHistory(monitorId: string, plan: Plan) {
  if (plan !== Plan.FREE) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  await prisma.change.deleteMany({
    where: {
      monitorId,
      createdAt: { lt: cutoff },
    },
  });

  const snapshots = await prisma.snapshot.findMany({
    where: { monitorId },
    orderBy: { createdAt: "desc" },
    skip: 10,
    select: { id: true },
  });

  if (snapshots.length > 0) {
    await prisma.snapshot.deleteMany({
      where: { id: { in: snapshots.map((s) => s.id) } },
    });
  }
}

export async function processDueMonitors(batchSize = 10): Promise<number> {
  const now = new Date();

  const dueMonitors = await prisma.monitor.findMany({
    where: {
      status: MonitorStatus.ACTIVE,
      OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
    },
    include: {
      user: { include: { subscription: true } },
    },
    take: batchSize * 2,
    orderBy: [{ nextCheckAt: "asc" }],
  });

  const sorted = dueMonitors.sort((a, b) => {
    const aPriority = a.user.subscription?.plan === Plan.BUSINESS ? 0 : 1;
    const bPriority = b.user.subscription?.plan === Plan.BUSINESS ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aTime = a.nextCheckAt?.getTime() ?? 0;
    const bTime = b.nextCheckAt?.getTime() ?? 0;
    return aTime - bTime;
  });

  const batch = sorted.slice(0, batchSize);

  const results = await Promise.allSettled(batch.map((m) => processMonitor(m.id)));

  return results.filter((r) => r.status === "fulfilled").length;
}
