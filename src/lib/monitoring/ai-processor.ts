import {
  AnalysisStatus,
  NotificationChannel,
  NotificationMethod,
  type Monitor,
  type Prisma,
} from "@prisma/client";
import { getAIProvider, getAIProviderType, isAIConfigured, toPrismaCategory, toPrismaImportance } from "@/lib/ai";
import type { ChangeAnalysis } from "@/lib/ai/types";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { sendChangeEmail } from "@/lib/notifications/email";
import { sendTelegramChangeNotification } from "@/lib/notifications/telegram";
import {
  createInAppNotification,
  recordAlertDelivery,
} from "@/lib/notifications/deliver";
import { buildFallbackAnalysis } from "./fallback-analysis";
import { monitorLog, monitorLogError } from "./logger";
import { readStoredHtml } from "./snapshot-store";

type ChangeWithMonitor = {
  id: string;
  monitorId: string;
  oldHtml: string | null;
  newHtml: string | null;
  analysisStatus: AnalysisStatus;
  aiRawResponse: Prisma.JsonValue | null;
  monitor: Monitor & {
    user: {
      email: string;
      telegramChatId: string | null;
    };
  };
};

export async function analyzeChangeById(changeId: string): Promise<void> {
  const change = await prisma.change.findUnique({
    where: { id: changeId },
    include: {
      monitor: {
        include: {
          user: { include: { subscription: true } },
        },
      },
    },
  });

  if (!change) {
    throw new Error(`Change ${changeId} not found`);
  }

  if (change.analysisStatus !== AnalysisStatus.PENDING) {
    return;
  }

  await analyzeChangeRecord(change);
}

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
      monitorLogError("error", "Change analysis failed", error, {
        monitorId: change.monitorId,
        data: { changeId: change.id },
      });
    }
  }

  return processed;
}

async function resolveAnalysis(
  change: ChangeWithMonitor,
  oldContent: string,
  newContent: string
): Promise<{ analysis: ChangeAnalysis; provider: string }> {
  const monitor = change.monitor;
  const userPrompt =
    monitor.aiPrompt?.trim() ||
    (monitor.keywords.length > 0 ? monitor.keywords.join(", ") : undefined);

  const fallbackParams = {
    monitorName: monitor.name,
    url: monitor.url,
    mode: monitor.mode,
    oldContent,
    newContent,
  };

  if (!isAIConfigured()) {
    monitorLog({
      step: "ai_analysis_start",
      monitorId: monitor.id,
      url: monitor.url,
      mode: monitor.mode,
      message: "AI not configured — using built-in change summary",
      data: { changeId: change.id },
    });
    return {
      analysis: buildFallbackAnalysis(fallbackParams),
      provider: "fallback",
    };
  }

  monitorLog({
    step: "ai_analysis_start",
    monitorId: monitor.id,
    url: monitor.url,
    mode: monitor.mode,
    message: "Sending snapshots to AI for analysis",
    data: {
      changeId: change.id,
      hasUserPrompt: Boolean(userPrompt),
    },
  });

  try {
    const ai = getAIProvider();
    const started = Date.now();
    const analysis = await ai.analyzeChange({
      url: monitor.url,
      monitorName: monitor.name,
      mode: monitor.mode,
      oldHtml: oldContent,
      newHtml: newContent,
      userPrompt,
    });

    const provider = getAIProviderType();

    await trackEvent({
      type: "ai.analysis",
      userId: monitor.userId,
      durationMs: Date.now() - started,
      metadata: {
        monitorId: monitor.id,
        changeId: change.id,
        importance: analysis.importance,
        shouldNotify: analysis.shouldNotify,
        provider,
      },
    });

    return { analysis, provider };
  } catch (error) {
    monitorLogError("error", "AI analysis failed — using built-in summary", error, {
      monitorId: monitor.id,
      data: { changeId: change.id },
    });
    return {
      analysis: buildFallbackAnalysis(fallbackParams),
      provider: "fallback",
    };
  }
}

async function analyzeChangeRecord(change: ChangeWithMonitor): Promise<void> {
  const monitor = change.monitor;

  if (!change.oldHtml || !change.newHtml) {
    throw new Error("Missing snapshot content for analysis");
  }

  const oldContent = await readStoredHtml(change.oldHtml);
  const newContent = await readStoredHtml(change.newHtml);

  if (!oldContent.trim() || !newContent.trim()) {
    throw new Error("Empty snapshot content for analysis");
  }

  if (oldContent === newContent) {
    await prisma.change.update({
      where: { id: change.id },
      data: {
        summary: "No meaningful content difference",
        analysisStatus: AnalysisStatus.SKIPPED,
      },
    });
    return;
  }

  const { analysis, provider } = await resolveAnalysis(change, oldContent, newContent);
  const changes = analysis.changes ?? analysis.bullet_points ?? [];

  const priorMeta =
    change.aiRawResponse &&
    typeof change.aiRawResponse === "object" &&
    !Array.isArray(change.aiRawResponse)
      ? (change.aiRawResponse as Record<string, unknown>)
      : {};

  const storedResponse: Prisma.InputJsonValue = {
    ...priorMeta,
    provider,
    analyzedAt: new Date().toISOString(),
    summary: analysis.summary,
    importance: analysis.importance,
    category: analysis.category,
    shouldNotify: analysis.shouldNotify,
    changes,
    old_value: analysis.old_value ?? null,
    new_value: analysis.new_value ?? null,
    emoji: analysis.emoji,
  };

  if (!analysis.shouldNotify) {
    await prisma.change.update({
      where: { id: change.id },
      data: {
        summary: analysis.summary,
        importance: toPrismaImportance(analysis.importance),
        category: toPrismaCategory(analysis.category),
        bulletPoints: changes,
        emoji: analysis.emoji,
        aiRawResponse: storedResponse,
        analysisStatus: AnalysisStatus.SKIPPED,
      },
    });

    monitorLog({
      step: "ai_analysis_complete",
      monitorId: monitor.id,
      message: "Analysis complete — notification suppressed",
      data: { changeId: change.id, provider, shouldNotify: false },
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
      aiRawResponse: storedResponse,
      analysisStatus: AnalysisStatus.COMPLETED,
    },
  });

  monitorLog({
    step: "ai_analysis_complete",
    monitorId: monitor.id,
    message: "Analysis stored and alerts dispatched",
    data: {
      changeId: change.id,
      provider,
      importance: analysis.importance,
      shouldNotify: true,
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

  await createInAppNotification(monitor.userId, changeId);

  const tasks: Promise<void>[] = [];
  const wantsEmail =
    monitor.notificationMethod === NotificationMethod.EMAIL ||
    monitor.notificationMethod === NotificationMethod.BOTH;
  const wantsTelegram =
    (monitor.notificationMethod === NotificationMethod.TELEGRAM ||
      monitor.notificationMethod === NotificationMethod.BOTH) &&
    monitor.user.telegramChatId;

  if (wantsEmail) {
    tasks.push(
      (async () => {
        await recordAlertDelivery(monitor.userId, changeId, NotificationChannel.EMAIL, "PENDING");

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

          await recordAlertDelivery(monitor.userId, changeId, NotificationChannel.EMAIL, "SENT");
          await trackEvent({ type: "email.sent", userId: monitor.userId, metadata: { changeId } });

          monitorLog({
            step: "database_updated",
            monitorId: monitor.id,
            message: "Email notification sent",
            data: { changeId },
          });
        } catch (err) {
          await recordAlertDelivery(
            monitor.userId,
            changeId,
            NotificationChannel.EMAIL,
            "FAILED",
            err instanceof Error ? err.message : "Send failed"
          );
          monitorLogError("error", "Email notification failed", err, {
            monitorId: monitor.id,
            data: { changeId },
          });
        }
      })()
    );
  }

  if (wantsTelegram) {
    tasks.push(
      (async () => {
        await recordAlertDelivery(monitor.userId, changeId, NotificationChannel.TELEGRAM, "PENDING");

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

          await recordAlertDelivery(monitor.userId, changeId, NotificationChannel.TELEGRAM, "SENT");
        } catch (err) {
          await recordAlertDelivery(
            monitor.userId,
            changeId,
            NotificationChannel.TELEGRAM,
            "FAILED",
            err instanceof Error ? err.message : "Send failed"
          );
        }
      })()
    );
  }

  await Promise.allSettled(tasks);
}
