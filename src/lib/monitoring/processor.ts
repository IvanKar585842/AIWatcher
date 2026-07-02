import {
  ChangeImportance,
  MonitorStatus,
  NotificationChannel,
  NotificationMethod,
  Plan,
  type Monitor,
  type Prisma,
} from "@prisma/client";
import { getAIProvider, toPrismaCategory, toPrismaImportance } from "@/lib/ai";
import { INTERVAL_MINUTES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendChangeEmail } from "@/lib/notifications/email";
import { sendTelegramChangeNotification } from "@/lib/notifications/telegram";
import { hasMeaningfulChange } from "./content-cleaner";
import { generateTextDiff } from "./diff";
import { fetchPageContent } from "./fetcher";

const MAX_RETRIES = 3;

export async function processMonitor(monitorId: string): Promise<void> {
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

  try {
    const result = await fetchPageContent({
      url: monitor.url,
      mode: monitor.mode,
      selector: monitor.selector,
      keywords: monitor.keywords,
      respectRobots: monitor.respectRobots,
    });

    const previousSnapshot = monitor.snapshots[0];
    const now = new Date();
    const nextCheckAt = new Date(
      now.getTime() + INTERVAL_MINUTES[monitor.interval] * 60 * 1000
    );

    if (!previousSnapshot) {
      await prisma.snapshot.create({
        data: {
          monitorId: monitor.id,
          rawHtml: result.rawHtml,
          cleanedHtml: result.cleanedHtml,
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

    let analysis;
    const oldContent = previousSnapshot.extractedText ?? previousSnapshot.cleanedHtml;
    const newContent = result.extractedText;

    if (plan === Plan.FREE) {
      analysis = {
        summary: "Content changed on the monitored page.",
        importance: "MEDIUM" as const,
        category: "CONTENT" as const,
        old_value: null,
        new_value: null,
        bullet_points: ["Page content has been updated"],
        emoji: "🔔",
      };
    } else {
      const ai = getAIProvider();
      analysis = await ai.analyzeChange({
        url: monitor.url,
        monitorName: monitor.name,
        mode: monitor.mode,
        oldContent,
        newContent,
      });
    }

    const diffHtml = generateTextDiff(oldContent.slice(0, 5000), newContent.slice(0, 5000));

    const change = await prisma.change.create({
      data: {
        monitorId: monitor.id,
        summary: analysis.summary,
        importance: toPrismaImportance(analysis.importance),
        category: toPrismaCategory(analysis.category),
        oldValue: analysis.old_value ?? null,
        newValue: analysis.new_value ?? null,
        bulletPoints: analysis.bullet_points,
        emoji: analysis.emoji,
        oldHtml: previousSnapshot.cleanedHtml.slice(0, 50000),
        newHtml: result.cleanedHtml.slice(0, 50000),
        diffHtml,
        aiRawResponse: analysis as Prisma.InputJsonValue,
      },
    });

    await prisma.snapshot.create({
      data: {
        monitorId: monitor.id,
        rawHtml: result.rawHtml,
        cleanedHtml: result.cleanedHtml,
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

    await sendNotifications(monitor, change.id, analysis);
    await cleanupOldHistory(monitor.id, plan);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorCount = monitor.errorCount + 1;

    await prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        errorCount,
        errorMessage,
        status: errorCount >= MAX_RETRIES ? MonitorStatus.ERROR : monitor.status,
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
    bullet_points: string[];
    importance: string;
  }
) {
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
            bulletPoints: analysis.bullet_points,
            importance: analysis.importance,
            changeId,
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
            bulletPoints: analysis.bullet_points,
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
    take: batchSize,
    orderBy: { nextCheckAt: "asc" },
  });

  const results = await Promise.allSettled(
    dueMonitors.map((m) => processMonitor(m.id))
  );

  return results.filter((r) => r.status === "fulfilled").length;
}
