import {
  AnalysisStatus,
  MonitorStatus,
  NotificationChannel,
  NotificationMethod,
  Plan,
  type Monitor,
  type Prisma,
} from "@prisma/client";
import { getAIProvider, toPrismaCategory, toPrismaImportance } from "@/lib/ai";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { sendChangeEmail } from "@/lib/notifications/email";
import { sendTelegramChangeNotification } from "@/lib/notifications/telegram";
import { readStoredHtml } from "./snapshot-store";

export async function processPendingAnalyses(batchSize = 5): Promise<number> {
  const pending = await prisma.change.findMany({
    where: { analysisStatus: AnalysisStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    include: {
      monitor: {
        include: {
          user: { include: { subscription: true } },
        },
      },
    },
  });

  let processed = 0;

  for (const change of pending) {
    try {
      await analyzeChangeRecord(change);
      processed++;
    } catch (error) {
      console.error(`AI analysis failed for change ${change.id}:`, error);
      await prisma.change.update({
        where: { id: change.id },
        data: {
          analysisStatus: AnalysisStatus.FAILED,
          summary: "Analysis failed — change was detected but could not be summarized.",
        },
      });
    }
  }

  return processed;
}

async function analyzeChangeRecord(
  change: {
    id: string;
    monitorId: string;
    oldHtml: string | null;
    newHtml: string | null;
    monitor: Monitor & {
      user: {
        email: string;
        telegramChatId: string | null;
        subscription: { plan: Plan } | null;
      };
    };
  }
) {
  const monitor = change.monitor;
  const plan = monitor.user.subscription?.plan ?? Plan.FREE;

  const userPrompt =
    monitor.aiPrompt?.trim() ||
    (monitor.keywords.length > 0 ? monitor.keywords.join(", ") : undefined);

  const oldContent = await readStoredHtml(change.oldHtml);
  const newContent = await readStoredHtml(change.newHtml);

  let analysis;

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
      metadata: { monitorId: monitor.id, changeId: change.id, importance: analysis.importance },
    });
  }

  const changes = analysis.changes ?? analysis.bullet_points ?? [];

  if (!analysis.shouldNotify) {
    await prisma.change.update({
      where: { id: change.id },
      data: {
        summary: analysis.summary,
        importance: toPrismaImportance(analysis.importance),
        category: toPrismaCategory(analysis.category),
        bulletPoints: changes,
        emoji: analysis.emoji,
        aiRawResponse: analysis as Prisma.InputJsonValue,
        analysisStatus: AnalysisStatus.SKIPPED,
      },
    });
    return;
  }

  await prisma.change.update({
    where: { id: change.id },
    data: {
      summary: analysis.summary,
      importance: toPrismaImportance(analysis.importance),
      category: toPrismaCategory(analysis.category),
      oldValue: analysis.old_value ?? null,
      newValue: analysis.new_value ?? null,
      bulletPoints: changes,
      emoji: analysis.emoji,
      aiRawResponse: analysis as Prisma.InputJsonValue,
      analysisStatus: AnalysisStatus.COMPLETED,
    },
  });

  await sendNotifications(monitor, change.id, {
    summary: analysis.summary,
    emoji: analysis.emoji,
    changes,
    importance: analysis.importance,
    shouldNotify: analysis.shouldNotify,
  });
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
