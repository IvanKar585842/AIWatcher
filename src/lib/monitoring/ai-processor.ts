import {
  AnalysisStatus,
  MonitoringMode,
  NotificationChannel,
  NotificationMethod,
  type Monitor,
  type Prisma,
} from "@prisma/client";
import { getAIProvider, getAIProviderType, isAIConfigured, toPrismaCategory, toPrismaImportance, defaultRecommendedAction } from "@/lib/ai";
import type { ChangeAnalysis } from "@/lib/ai/types";
import { getEffectivePlan, getUserPlanEntitlements, isAdminUser } from "@/lib/admin";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { getUpgradeCopy } from "@/lib/plan-features";
import { parseMonitorConfig } from "@/lib/monitor-config";
import { sendChangeEmail, classifyEmailSendError } from "@/lib/notifications/email";
import { sendTelegramChangeNotification } from "@/lib/notifications/telegram";
import {
  createInAppNotification,
  recordAlertDelivery,
} from "@/lib/notifications/deliver";
import { shouldSkipDuplicateOutboundAlert } from "@/lib/notifications/alert-dedupe";
import { canSendOutboundNotification } from "@/lib/security/notification-quota";
import { assertEmailRateLimit } from "@/lib/rate-limit";
import { securityLog } from "@/lib/security/log";
import { extractTextChangeBullets } from "./content-cleaner";
import { buildFallbackAnalysis, isLikelyTechnicalNoise } from "./fallback-analysis";
import { monitorLog, monitorLogError } from "./logger";
import { readStoredHtml } from "./snapshot-store";
import { buildChangePackageForAI, comparePageStructures } from "./structural-diff";

/** Prevent concurrent / duplicate AI analysis of the same change in one process */
const analyzingChangeIds = new Set<string>();
const MAX_AI_BATCH = 5;

const IMPORTANCE_RANK: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function applyImportancePolicy(
  analysis: ChangeAnalysis,
  minImportance: string = "MEDIUM"
): ChangeAnalysis {
  // LOW/MEDIUM → history only; HIGH/CRITICAL → notify (subject to threshold)
  let shouldNotify =
    analysis.importance === "HIGH" || analysis.importance === "CRITICAL";

  const minRank = IMPORTANCE_RANK[minImportance] ?? 1;
  const rank = IMPORTANCE_RANK[analysis.importance] ?? 1;
  if (rank < minRank || analysis.importance === "LOW") {
    shouldNotify = false;
  }

  return { ...analysis, shouldNotify };
}

function isVisualPayload(content: string): boolean {
  return content.includes("visual-screenshot") || content.trim().startsWith("{") && content.includes('"type":"visual"');
}

function parseVisualMeta(content: string): { hash?: string; preview?: string; mime?: string } | null {
  try {
    if (!content.trim().startsWith("{")) return null;
    const parsed = JSON.parse(content) as { type?: string; hash?: string; preview?: string; mime?: string };
    if (parsed.type === "visual") return parsed;
  } catch {
    return null;
  }
  return null;
}

type ChangeWithMonitor = {
  id: string;
  monitorId: string;
  oldHtml: string | null;
  newHtml: string | null;
  analysisStatus: AnalysisStatus;
  aiRawResponse: Prisma.JsonValue | null;
  monitor: Monitor & {
    user: {
      id: string;
      email: string;
      role?: string | null;
      telegramChatId: string | null;
      telegramConnected: boolean;
      telegramNotificationsEnabled: boolean;
      emailNotificationsEnabled: boolean;
      subscription?: { plan: import("@prisma/client").Plan } | null;
    };
  };
};

export async function analyzeChangeById(changeId: string): Promise<void> {
  if (analyzingChangeIds.has(changeId)) {
    securityLog({
      type: "resource.throttled",
      message: "Skipped duplicate AI analysis (already in progress)",
      resourceId: changeId,
    });
    return;
  }

  // Cluster-safe lease: only one worker may move PENDING → PROCESSING
  const claimed = await prisma.change.updateMany({
    where: { id: changeId, analysisStatus: AnalysisStatus.PENDING },
    data: { analysisStatus: AnalysisStatus.PROCESSING },
  });

  if (claimed.count === 0) {
    return;
  }

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

  analyzingChangeIds.add(changeId);
  try {
    await analyzeChangeRecord(change);
  } catch (error) {
    await prisma.change
      .updateMany({
        where: { id: changeId, analysisStatus: AnalysisStatus.PROCESSING },
        data: { analysisStatus: AnalysisStatus.PENDING },
      })
      .catch(() => undefined);
    throw error;
  } finally {
    analyzingChangeIds.delete(changeId);
  }
}

export async function processPendingAnalyses(batchSize = MAX_AI_BATCH): Promise<number> {
  const safeBatch = Math.min(Math.max(1, batchSize), MAX_AI_BATCH);
  const pending = await prisma.change.findMany({
    where: { analysisStatus: AnalysisStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: safeBatch,
    select: { id: true },
  });

  let processed = 0;

  for (const item of pending) {
    if (analyzingChangeIds.has(item.id)) {
      continue;
    }

    const claimed = await prisma.change.updateMany({
      where: { id: item.id, analysisStatus: AnalysisStatus.PENDING },
      data: { analysisStatus: AnalysisStatus.PROCESSING },
    });
    if (claimed.count === 0) continue;

    const change = await prisma.change.findUnique({
      where: { id: item.id },
      include: {
        monitor: {
          include: {
            user: { include: { subscription: true } },
          },
        },
      },
    });
    if (!change) continue;

    analyzingChangeIds.add(change.id);
    try {
      await analyzeChangeRecord(change);
      processed++;
    } catch (error) {
      await prisma.change
        .updateMany({
          where: { id: change.id, analysisStatus: AnalysisStatus.PROCESSING },
          data: { analysisStatus: AnalysisStatus.PENDING },
        })
        .catch(() => undefined);
      monitorLogError("error", "AI analysis batch item failed (continuing)", error, {
        monitorId: change.monitorId,
        data: { changeId: change.id },
      });
      securityLog({
        type: "failsafe.activated",
        message: "AI analysis failed — continued without crashing batch",
        resourceId: change.id,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      analyzingChangeIds.delete(change.id);
    }
  }

  return processed;
}

async function resolveAnalysis(
  change: ChangeWithMonitor,
  oldContent: string,
  newContent: string
): Promise<{
  analysis: ChangeAnalysis;
  provider: string;
  upgradePreview?: boolean;
  upgradeCopy?: ReturnType<typeof getUpgradeCopy>;
}> {
  const monitor = change.monitor;
  const userPrompt =
    monitor.aiPrompt?.trim() ||
    (monitor.keywords.length > 0 ? monitor.keywords.join(", ") : undefined);

  const priorMeta =
    change.aiRawResponse &&
    typeof change.aiRawResponse === "object" &&
    !Array.isArray(change.aiRawResponse)
      ? (change.aiRawResponse as Record<string, unknown>)
      : {};

  const visualDiffPercent =
    typeof priorMeta.visualDiffPercent === "number" ? priorMeta.visualDiffPercent : null;
  const structureSummary = Array.isArray(priorMeta.structureSummary)
    ? (priorMeta.structureSummary as string[])
    : [];

  const visual =
    monitor.mode === MonitoringMode.VISUAL_CHANGES ||
    monitor.mode === MonitoringMode.SCREENSHOT_DIFF ||
    isVisualPayload(oldContent) ||
    isVisualPayload(newContent);

  let changePackage: string;
  let contextPackage: string;

  if (visual) {
    const oldVisual = parseVisualMeta(oldContent);
    const newVisual = parseVisualMeta(newContent);
    changePackage = buildChangePackageForAI({
      mode: monitor.mode,
      url: monitor.url,
      monitorName: monitor.name,
      userPrompt,
      visualDiffPercent,
      textDiffLines: [
        "A visual/layout difference was detected between screenshots.",
        oldVisual?.hash ? `Previous screenshot hash: ${oldVisual.hash.slice(0, 16)}…` : "",
        newVisual?.hash ? `Current screenshot hash: ${newVisual.hash.slice(0, 16)}…` : "",
      ].filter(Boolean),
    });
    contextPackage = "Screenshots are compared visually. Focus on whether the change is meaningful for the user.";
  } else {
    const structureDiff =
      structureSummary.length > 0
        ? {
            changed: true,
            score: 50,
            addedHeadings: [],
            removedHeadings: [],
            addedButtons: [],
            removedButtons: [],
            addedImages: [],
            removedImages: [],
            addedSections: [],
            removedSections: [],
            textChanged: true,
            summaryLines: structureSummary,
          }
        : comparePageStructures(oldContent.slice(0, 80000), newContent.slice(0, 80000));

    const textBullets = extractTextChangeBullets(oldContent, newContent, 10);
    changePackage = buildChangePackageForAI({
      mode: monitor.mode,
      url: monitor.url,
      monitorName: monitor.name,
      userPrompt,
      structureDiff,
      textDiffLines: textBullets,
    });
    // Keep a tiny text excerpt only — avoid full HTML to AI
    contextPackage = [
      "Key excerpt old:",
      oldContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200),
      "Key excerpt new:",
      newContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200),
    ].join("\n");
  }

  const fallbackParams = {
    monitorName: monitor.name,
    url: monitor.url,
    mode: monitor.mode,
    oldContent: changePackage,
    newContent: contextPackage,
    visualDiffPercent,
  };

  const config = parseMonitorConfig(monitor.config);
  const minImportance = config.minImportance ?? "MEDIUM";

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
      analysis: applyImportancePolicy(buildFallbackAnalysis(fallbackParams), minImportance),
      provider: "fallback",
      upgradePreview: false,
    };
  }

  // Cost control: skip paid AI for obvious technical noise packages
  if (isLikelyTechnicalNoise(`${changePackage}\n${contextPackage}`)) {
    monitorLog({
      step: "ai_analysis_start",
      monitorId: monitor.id,
      message: "Skipped paid AI — package looks like technical noise",
      data: { changeId: change.id },
    });
    return {
      analysis: applyImportancePolicy(buildFallbackAnalysis(fallbackParams), minImportance),
      provider: "noise_skip",
      upgradePreview: false,
    };
  }

  const userLike = monitor.user;
  const entitlements = getUserPlanEntitlements(userLike);
  const aiLimit = entitlements.aiAnalysesPerMonth;
  let allowAiCall = entitlements.aiSummaries || (aiLimit != null && aiLimit > 0);

  if (!isAdminUser(userLike) && aiLimit != null) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const used = await prisma.analyticsEvent.count({
      where: {
        userId: monitor.userId,
        type: "ai.analysis",
        createdAt: { gte: since },
      },
    });
    if (used >= aiLimit) {
      allowAiCall = false;
    }
  }

  if (!allowAiCall) {
    const copy = getUpgradeCopy("AI_ANALYSIS");
    monitorLog({
      step: "ai_analysis_start",
      monitorId: monitor.id,
      message: "AI analysis gated by plan — using preview fallback",
      data: { changeId: change.id, plan: getEffectivePlan(userLike) },
    });
    const analysis = applyImportancePolicy(buildFallbackAnalysis(fallbackParams), minImportance);
    return {
      analysis: {
        ...analysis,
        summary: `${analysis.summary} (Basic summary — AI analysis available on Pro.)`,
      },
      provider: "plan_preview",
      upgradePreview: true,
      upgradeCopy: copy,
    };
  }

  monitorLog({
    step: "ai_analysis_start",
    monitorId: monitor.id,
    url: monitor.url,
    mode: monitor.mode,
    message: "Sending compact change package to AI",
    data: {
      changeId: change.id,
      hasUserPrompt: Boolean(userPrompt),
      packageChars: changePackage.length,
    },
  });

  try {
    const ai = getAIProvider();
    const started = Date.now();
    const analysis = await ai.analyzeChange({
      url: monitor.url,
      monitorName: monitor.name,
      mode: monitor.mode,
      oldHtml: changePackage,
      newHtml: contextPackage,
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

    return {
      analysis: applyImportancePolicy(analysis, minImportance),
      provider,
      upgradePreview: false,
    };
  } catch (error) {
    monitorLogError("error", "AI analysis failed — using built-in summary", error, {
      monitorId: monitor.id,
      data: { changeId: change.id },
    });
    void trackEvent({
      type: "ai.failed",
      userId: monitor.userId,
      metadata: {
        changeId: change.id,
        monitorId: monitor.id,
        error: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      },
    });
    return {
      analysis: applyImportancePolicy(buildFallbackAnalysis(fallbackParams), minImportance),
      provider: "fallback",
      upgradePreview: false,
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

  const { analysis, provider, upgradePreview, upgradeCopy } = await resolveAnalysis(
    change,
    oldContent,
    newContent
  );
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
    categoryLabel: analysis.categoryLabel,
    shouldNotify: analysis.shouldNotify,
    changes,
    potentialImpact: analysis.potentialImpact,
    recommendedAction:
      analysis.recommendedAction ||
      defaultRecommendedAction(analysis.importance, analysis.category),
    old_value: analysis.old_value ?? null,
    new_value: analysis.new_value ?? null,
    emoji: analysis.emoji,
    ...(upgradePreview
      ? {
          upgradePreview: true,
          upgradeFeature: "AI_ANALYSIS",
          upgradeTitle: upgradeCopy?.title ?? getUpgradeCopy("AI_ANALYSIS").title,
          upgradeDescription:
            upgradeCopy?.description ?? getUpgradeCopy("AI_ANALYSIS").description,
        }
      : {}),
  };

  if (!analysis.shouldNotify) {
    const status =
      analysis.importance === "LOW" ? AnalysisStatus.SKIPPED : AnalysisStatus.COMPLETED;

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
        analysisStatus: status,
      },
    });

    monitorLog({
      step: "ai_analysis_complete",
      monitorId: monitor.id,
      message:
        analysis.importance === "LOW"
          ? "Analysis complete — low importance ignored for alerts"
          : "Analysis complete — stored in history without alert",
      data: { changeId: change.id, provider, shouldNotify: false, importance: analysis.importance },
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
    category: analysis.category,
    recommendedAction:
      analysis.recommendedAction ||
      defaultRecommendedAction(analysis.importance, analysis.category),
    shouldNotify: analysis.shouldNotify,
  });
}

async function sendNotifications(
  monitor: Monitor & {
    user: {
      email: string;
      telegramChatId: string | null;
      telegramConnected: boolean;
      telegramNotificationsEnabled: boolean;
      emailNotificationsEnabled: boolean;
    };
  },
  changeId: string,
  analysis: {
    summary: string;
    emoji: string;
    changes: string[];
    importance: string;
    category: string;
    recommendedAction: string;
    shouldNotify: boolean;
  }
) {
  if (!analysis.shouldNotify) return;

  await createInAppNotification(monitor.userId, changeId);

  const quota = await canSendOutboundNotification(monitor.userId);
  if (!quota.allowed) {
    securityLog({
      type: "quota.exceeded",
      message: "Skipped outbound notifications due to monthly quota",
      userId: monitor.userId,
      resourceId: changeId,
      metadata: { used: quota.used, limit: quota.limit },
    });
    monitorLog({
      step: "database_updated",
      monitorId: monitor.id,
      message: "Outbound notifications skipped — monthly quota reached",
      data: { changeId, used: quota.used, limit: quota.limit },
    });
    return;
  }

  const emailAllowed = await assertEmailRateLimit(monitor.userId);

  const tasks: Promise<void>[] = [];
  const wantsEmail =
    emailAllowed &&
    monitor.user.emailNotificationsEnabled !== false &&
    Boolean(monitor.user.email?.trim()) &&
    (monitor.notificationMethod === NotificationMethod.EMAIL ||
      monitor.notificationMethod === NotificationMethod.BOTH);
  // If Telegram is connected + enabled, always send alerts (even when monitor defaults to EMAIL).
  const wantsTelegram =
    Boolean(monitor.user.telegramChatId) &&
    monitor.user.telegramConnected === true &&
    monitor.user.telegramNotificationsEnabled !== false;

  if (
    (monitor.notificationMethod === NotificationMethod.EMAIL ||
      monitor.notificationMethod === NotificationMethod.BOTH) &&
    !monitor.user.email?.trim()
  ) {
    await recordAlertDelivery(
      monitor.userId,
      changeId,
      NotificationChannel.EMAIL,
      "FAILED",
      "Missing configuration: recipient email address"
    );
    monitorLogError(
      "error",
      "Email notification skipped — user has no email",
      new Error("Missing recipient email"),
      { monitorId: monitor.id, data: { changeId } }
    );
  }

  if (!emailAllowed && (monitor.notificationMethod === NotificationMethod.EMAIL ||
      monitor.notificationMethod === NotificationMethod.BOTH)) {
    securityLog({
      type: "rate_limit.exceeded",
      message: "Email skipped due to send rate limit",
      userId: monitor.userId,
      resourceId: changeId,
    });
    await recordAlertDelivery(
      monitor.userId,
      changeId,
      NotificationChannel.EMAIL,
      "FAILED",
      "Rate limit"
    );
  }

  if (wantsEmail) {
    tasks.push(
      (async () => {
        const dedupe = await shouldSkipDuplicateOutboundAlert({
          userId: monitor.userId,
          changeId,
          monitorId: monitor.id,
          channel: NotificationChannel.EMAIL,
          summary: analysis.summary,
        });
        if (dedupe.skip) {
          monitorLog({
            step: "database_updated",
            monitorId: monitor.id,
            message: "Email skipped — duplicate/cooldown",
            data: { changeId, reason: dedupe.reason },
          });
          return;
        }

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
            category: analysis.category,
            recommendedAction: analysis.recommendedAction,
            monitorMode: monitor.mode,
            changeId,
            detectedAt: new Date(),
            faviconUrl: monitor.faviconUrl,
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
          const reason = classifyEmailSendError(err);
          await recordAlertDelivery(
            monitor.userId,
            changeId,
            NotificationChannel.EMAIL,
            "FAILED",
            reason
          );
          securityLog({
            type: "failsafe.activated",
            message: "Email send failed — logged and continued",
            userId: monitor.userId,
            resourceId: changeId,
            metadata: { error: reason },
          });
          monitorLogError("error", `Email notification failed: ${reason}`, err, {
            monitorId: monitor.id,
            data: { changeId, reason },
          });
        }
      })()
    );
  }

  if (wantsTelegram) {
    tasks.push(
      (async () => {
        const dedupe = await shouldSkipDuplicateOutboundAlert({
          userId: monitor.userId,
          changeId,
          monitorId: monitor.id,
          channel: NotificationChannel.TELEGRAM,
          summary: analysis.summary,
        });
        if (dedupe.skip) {
          monitorLog({
            step: "database_updated",
            monitorId: monitor.id,
            message: "Telegram skipped — duplicate/cooldown",
            data: { changeId, reason: dedupe.reason },
          });
          return;
        }

        await recordAlertDelivery(monitor.userId, changeId, NotificationChannel.TELEGRAM, "PENDING");

        try {
          const result = await sendTelegramChangeNotification({
            chatId: monitor.user.telegramChatId!,
            monitorName: monitor.name,
            url: monitor.url,
            summary: analysis.summary,
            emoji: analysis.emoji,
            bulletPoints: analysis.changes,
            importance: analysis.importance,
            category: analysis.category,
            recommendedAction: analysis.recommendedAction,
            changeId,
          });

          if (!result.ok) {
            throw new Error(result.error || "Unable to send Telegram notification");
          }

          await recordAlertDelivery(monitor.userId, changeId, NotificationChannel.TELEGRAM, "SENT");
          await trackEvent({
            type: "telegram.sent",
            userId: monitor.userId,
            metadata: { changeId },
          });
        } catch (err) {
          const errMsg =
            err instanceof Error ? err.message : "Unable to send Telegram notification";
          await recordAlertDelivery(
            monitor.userId,
            changeId,
            NotificationChannel.TELEGRAM,
            "FAILED",
            errMsg
          );
          securityLog({
            type: "failsafe.activated",
            message: "Telegram send failed — logged and continued",
            userId: monitor.userId,
            resourceId: changeId,
            metadata: { error: errMsg },
          });
        }
      })()
    );
  }

  await Promise.allSettled(tasks);
}
