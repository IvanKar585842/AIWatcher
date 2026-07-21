import {
  AnalysisStatus,
  MonitorStatus,
  MonitoringMode,
  Plan,
  type Prisma,
} from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import { INTERVAL_MINUTES, intervalToMs, resolveEffectiveInterval } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { parseMonitorConfig } from "@/lib/monitor-config";
import { processPendingAnalyses, analyzeChangeById } from "./ai-processor";
import { isAdminUser } from "@/lib/admin";
import { getPlanEntitlements } from "@/lib/plan-features";
import { compareSnapshots } from "./compare";
import { generateTextDiff } from "./diff";
import { closeBrowser, fetchPageContent } from "./fetcher";
import {
  acquireCheckSlot,
  acquireMonitorLock,
  cleanupStaleLocks,
  getCheckSlotStatus,
  releaseCheckSlot,
  releaseMonitorLock,
} from "./lock";
import { classifyMonitoringError, serializeMonitorError } from "./error-messages";
import { monitorLog, monitorLogError } from "./logger";
import {
  claimDueMonitors,
  releaseMonitorQueue,
  syncAllDueMonitorsToQueue,
  syncMonitorQueue,
} from "./queue";
import { prepareHtmlForStorage, readSnapshotHtml } from "./snapshot-store";

const DEFAULT_MAX_RETRIES = 3;

export type ProcessMonitorStatus =
  | "baseline"
  | "no_change"
  | "change_detected"
  | "skipped"
  | "error";

export interface ProcessMonitorResult {
  status: ProcessMonitorStatus;
  reason?: string;
  changeId?: string;
}

function buildCleanOptions(config: ReturnType<typeof parseMonitorConfig>) {
  return {
    ignoreTimestamps: config.ignoreTimestamps,
    ignoreRandomIds: config.ignoreRandomIds,
    ignoreDynamicContent: config.ignoreDynamicContent,
    ignoreCookies: config.ignoreCookies,
    ignoreAds: config.ignoreAds,
    ignoreSelectors: config.ignoreSelectors,
  };
}

function computeNextCheckAt(interval: keyof typeof INTERVAL_MINUTES, from = new Date()): Date {
  return new Date(from.getTime() + INTERVAL_MINUTES[interval] * 60 * 1000);
}

function isVisualMode(mode: MonitoringMode): boolean {
  return mode === MonitoringMode.VISUAL_CHANGES || mode === MonitoringMode.SCREENSHOT_DIFF;
}

async function updateMonitorChecked(
  monitorId: string,
  nextCheckAt: Date,
  extra: Prisma.MonitorUpdateInput = {}
): Promise<void> {
  await prisma.monitor.update({
    where: { id: monitorId },
    data: {
      lastCheckedAt: new Date(),
      nextCheckAt,
      errorCount: 0,
      errorMessage: null,
      ...extra,
    },
  });
  await syncMonitorQueue(monitorId, nextCheckAt);
}

async function saveSnapshot(
  monitorId: string,
  data: {
    rawHtml: string;
    cleanedHtml: string;
    contentHash: string;
    extractedText: string;
    metadata: Record<string, unknown>;
  }
): Promise<string> {
  const [compressedRaw, compressedCleaned] = await Promise.all([
    prepareHtmlForStorage(data.rawHtml),
    prepareHtmlForStorage(data.cleanedHtml),
  ]);

  const snapshot = await prisma.snapshot.create({
    data: {
      monitorId,
      rawHtml: compressedRaw,
      cleanedHtml: compressedCleaned,
      contentHash: data.contentHash,
      extractedText: data.extractedText,
      metadata: data.metadata as Prisma.InputJsonValue,
    },
  });

  return snapshot.id;
}

export async function processMonitor(monitorId: string): Promise<ProcessMonitorResult> {
  cleanupStaleLocks();

  if (!acquireMonitorLock(monitorId)) {
    monitorLog({
      step: "lock_skipped",
      monitorId,
      message: "Skipped — another check is already in progress for this monitor",
    });
    return { status: "skipped", reason: "lock_held" };
  }

  if (!acquireCheckSlot(monitorId)) {
    releaseMonitorLock(monitorId);
    monitorLog({
      step: "lock_skipped",
      monitorId,
      message: "Skipped — concurrent check capacity reached (fail-safe)",
    });
    return { status: "skipped", reason: "capacity" };
  }

  try {
    monitorLog({
      step: "lock_acquired",
      monitorId,
      message: "Processing lock acquired",
    });
    return await processMonitorInternal(monitorId);
  } catch (error) {
    monitorLogError("error", "Monitor processing failed", error, { monitorId });
    // Fail safe: do not crash the batch — surface as error result when callers catch
    throw error;
  } finally {
    releaseCheckSlot();
    releaseMonitorLock(monitorId);
  }
}

async function processMonitorInternal(monitorId: string): Promise<ProcessMonitorResult> {
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    include: {
      user: { include: { subscription: true } },
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!monitor) {
    monitorLog({
      step: "monitor_skipped",
      monitorId,
      message: "Monitor not found in database",
    });
    return { status: "skipped", reason: "not_found" };
  }

  if (monitor.status !== MonitorStatus.ACTIVE) {
    monitorLog({
      step: "monitor_skipped",
      monitorId,
      url: monitor.url,
      mode: monitor.mode,
      message: `Monitor is not active (status=${monitor.status})`,
    });
    return { status: "skipped", reason: `status_${monitor.status.toLowerCase()}` };
  }

  monitorLog({
    step: "monitor_loaded",
    monitorId,
    url: monitor.url,
    mode: monitor.mode,
    message: "Monitor loaded from database",
    data: {
      interval: monitor.interval,
      hasPreviousSnapshot: monitor.snapshots.length > 0,
      previousHash: monitor.snapshots[0]?.contentHash?.slice(0, 16) ?? null,
    },
  });

  const plan = monitor.user.subscription?.plan ?? Plan.FREE;
  const effectiveInterval = resolveEffectiveInterval(plan, monitor.interval);
  const config = parseMonitorConfig(monitor.config);
  const maxRetries = config.retryAttempts ?? DEFAULT_MAX_RETRIES;
  const now = new Date();

  // Honor last successful check — never re-check earlier than the plan/interval allows
  if (monitor.lastCheckedAt) {
    const earliestNext = new Date(
      monitor.lastCheckedAt.getTime() + intervalToMs(effectiveInterval)
    );
    if (now.getTime() + 2_000 < earliestNext.getTime()) {
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: { nextCheckAt: earliestNext },
      });
      await releaseMonitorQueue(monitor.id, earliestNext);
      monitorLog({
        step: "scheduler_batch",
        monitorId,
        message: "Skipped — interval not elapsed since last check",
        data: {
          plan,
          storedInterval: monitor.interval,
          effectiveInterval,
          lastCheckedAt: monitor.lastCheckedAt.toISOString(),
          nextCheckAt: earliestNext.toISOString(),
        },
      });
      return { status: "skipped", reason: "interval_not_elapsed" };
    }
  }

  const nextCheckAt = computeNextCheckAt(effectiveInterval, now);

  try {
    const result = await fetchPageContent({
      url: monitor.url,
      mode: monitor.mode,
      monitorId: monitor.id,
      userId: monitor.userId,
      selector: monitor.selector,
      keywords: monitor.keywords,
      respectRobots: monitor.respectRobots,
      timeout: config.timeout,
      ignoreAds: config.ignoreAds,
      cleanOptions: buildCleanOptions(config),
      maxRetries,
      waitStrategy: config.waitStrategy,
      stabilizeMs: config.stabilizeMs,
      scrollForLazyLoad: config.scrollForLazyLoad,
      scrollDepthPx: config.scrollDepthPx,
      waitForSelector: config.waitForSelector,
      expandSelectors: config.expandSelectors,
      encryptedSession: config.encryptedSession,
      sessionExpiresAt: config.sessionExpiresAt,
    });

    if (result.refreshedEncryptedSession && result.refreshedEncryptedSession !== config.encryptedSession) {
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: {
          config: {
            ...config,
            encryptedSession: result.refreshedEncryptedSession,
            sessionStatus: "active",
          } as Prisma.InputJsonValue,
        },
      });
    }

    monitorLog({
      step: "fetch_success",
      monitorId,
      url: monitor.url,
      mode: monitor.mode,
      message: "Website fetched successfully",
      data: {
        hash: result.contentHash.slice(0, 16),
        captureType: result.metadata.captureType,
      },
    });

    const previousSnapshot = monitor.snapshots[0];

    if (!previousSnapshot) {
      const snapshotId = await saveSnapshot(monitor.id, result);

      monitorLog({
        step: "snapshot_created",
        monitorId,
        url: monitor.url,
        mode: monitor.mode,
        message: "Baseline snapshot stored",
        data: { snapshotId, hash: result.contentHash.slice(0, 16) },
      });

      await updateMonitorChecked(monitor.id, nextCheckAt);

      monitorLog({
        step: "database_updated",
        monitorId,
        message: "lastCheckedAt updated (baseline)",
        data: { nextCheckAt: nextCheckAt.toISOString() },
      });

      await trackEvent({
        type: "monitor.check",
        userId: monitor.userId,
        metadata: { monitorId, baseline: true, snapshotId },
      });

      return { status: "baseline" };
    }

    const previous = await readSnapshotHtml(previousSnapshot);
    const previousMeta =
      previousSnapshot.metadata &&
      typeof previousSnapshot.metadata === "object" &&
      !Array.isArray(previousSnapshot.metadata)
        ? (previousSnapshot.metadata as Record<string, unknown>)
        : null;

    const comparison = compareSnapshots({
      monitorId: monitor.id,
      mode: monitor.mode,
      previousHash: previousSnapshot.contentHash,
      previousText: previous.extractedText,
      previousCleanedHtml: previous.cleanedHtml,
      previousMetadata: previousMeta,
      current: result,
    });

    if (!comparison.changed) {
      const step = comparison.reason === "noise_filtered" ? "noise_filtered" : "no_change";

      monitorLog({
        step,
        monitorId,
        url: monitor.url,
        mode: monitor.mode,
        message:
          comparison.reason === "noise_filtered"
            ? "Hash changed but difference was below noise threshold"
            : "No meaningful change detected",
        data: { reason: comparison.reason },
      });

      await updateMonitorChecked(monitor.id, nextCheckAt);

      monitorLog({
        step: "database_updated",
        monitorId,
        message: "lastCheckedAt updated (no change)",
        data: { nextCheckAt: nextCheckAt.toISOString() },
      });

      await trackEvent({
        type: "monitor.check",
        userId: monitor.userId,
        metadata: { monitorId, changed: false, reason: comparison.reason },
      });

      return { status: "no_change", reason: comparison.reason };
    }

    monitorLog({
      step: "difference_detected",
      monitorId,
      url: monitor.url,
      mode: monitor.mode,
      message: "Change detected",
      data: {
        reason: comparison.reason,
        previousHash: previousSnapshot.contentHash.slice(0, 16),
        currentHash: comparison.currentHash.slice(0, 16),
      },
    });

    const visual = isVisualMode(monitor.mode);
    const structureLines = comparison.structureDiff?.summaryLines ?? [];
    const visualPct = comparison.visualDiffPercent;

    const diffHtml = visual
      ? `<div class="visual-diff"><p>Visual change detected${
          visualPct != null ? ` — ~${visualPct.toFixed(1)}% difference` : ""
        }.</p><p>Previous hash: <code>${previousSnapshot.contentHash.slice(0, 16)}…</code></p><p>Current hash: <code>${comparison.currentHash.slice(0, 16)}…</code></p></div>`
      : structureLines.length > 0
        ? `<ul>${structureLines.map((l) => `<li>${l.replace(/</g, "&lt;")}</li>`).join("")}</ul>${generateTextDiff(
            previous.extractedText.slice(0, 4000),
            result.extractedText.slice(0, 4000)
          )}`
        : generateTextDiff(
            previous.extractedText.slice(0, 5000),
            result.extractedText.slice(0, 5000)
          );

    const [storedOldHtml, storedNewHtml] = await Promise.all([
      prepareHtmlForStorage(
        visual
          ? JSON.stringify({
              type: "visual",
              hash: previousSnapshot.contentHash,
              preview: previousMeta?.screenshotPreview ?? null,
              mime: previousMeta?.screenshotMime ?? "image/jpeg",
            })
          : previous.cleanedHtml
      ),
      prepareHtmlForStorage(
        visual
          ? JSON.stringify({
              type: "visual",
              hash: comparison.currentHash,
              preview: result.metadata.screenshotPreview ?? null,
              mime: result.metadata.screenshotMime ?? "image/jpeg",
            })
          : result.cleanedHtml
      ),
    ]);

    const change = await prisma.change.create({
      data: {
        monitorId: monitor.id,
        summary: visual
          ? `Visual change detected${visualPct != null ? ` (~${visualPct.toFixed(1)}%)` : ""} — analysis pending`
          : structureLines[0]
            ? `${structureLines[0]} — analysis pending`
            : "Change detected — analysis pending",
        importance: "MEDIUM",
        category: "CONTENT",
        oldHtml: storedOldHtml.slice(0, 50000),
        newHtml: storedNewHtml.slice(0, 50000),
        diffHtml,
        bulletPoints: structureLines.slice(0, 5),
        emoji: visual ? "👁️" : "🔔",
        analysisStatus: AnalysisStatus.PENDING,
        aiRawResponse: {
          detectedAt: now.toISOString(),
          previousSnapshotId: previousSnapshot.id,
          comparisonReason: comparison.reason,
          previousHash: previousSnapshot.contentHash,
          currentHash: comparison.currentHash,
          captureType: result.metadata.captureType ?? null,
          visualDiffPercent: visualPct ?? null,
          structureSummary: structureLines,
          previousScreenshot: previousMeta?.screenshotPreview
            ? {
                mime: previousMeta.screenshotMime ?? "image/jpeg",
                data: previousMeta.screenshotPreview,
              }
            : null,
          currentScreenshot: result.metadata.screenshotPreview
            ? {
                mime: result.metadata.screenshotMime ?? "image/jpeg",
                data: result.metadata.screenshotPreview,
              }
            : null,
        },
      },
    });

    monitorLog({
      step: "change_stored",
      monitorId,
      url: monitor.url,
      mode: monitor.mode,
      message: "Change record stored",
      data: {
        changeId: change.id,
        detectedAt: now.toISOString(),
        previousSnapshotId: previousSnapshot.id,
      },
    });

    const snapshotId = await saveSnapshot(monitor.id, result);

    monitorLog({
      step: "snapshot_created",
      monitorId,
      message: "New snapshot stored after change",
      data: { snapshotId, hash: result.contentHash.slice(0, 16) },
    });

    await updateMonitorChecked(monitor.id, nextCheckAt, {
      lastChangedAt: now,
    });

    monitorLog({
      step: "database_updated",
      monitorId,
      message: "Monitor timestamps updated after change",
      data: {
        lastChangedAt: now.toISOString(),
        nextCheckAt: nextCheckAt.toISOString(),
      },
    });

    monitorLog({
      step: "analysis_queued",
      monitorId,
      message: "Starting Gemini analysis",
      data: { changeId: change.id },
    });

    try {
      await analyzeChangeById(change.id);
    } catch (error) {
      monitorLogError("error", "Change analysis failed", error, {
        monitorId,
        data: { changeId: change.id },
      });
    }

    await trackEvent({
      type: "monitor.check",
      userId: monitor.userId,
      metadata: { monitorId, changed: true, changeId: change.id },
    });

    await trackEvent({
      type: "change.detected",
      userId: monitor.userId,
      metadata: { monitorId, changeId: change.id, pendingAnalysis: true },
    });

    const priorChanges = await prisma.change.count({
      where: { monitor: { userId: monitor.userId } },
    });
    if (priorChanges <= 1) {
      void trackEvent({
        type: "alert.first",
        userId: monitor.userId,
        metadata: { monitorId, changeId: change.id },
      });
    }

    await cleanupOldHistory(monitor.id, plan, monitor.user);
    await releaseMonitorQueue(monitor.id, nextCheckAt);

    return { status: "change_detected", changeId: change.id };
  } catch (error) {
    const classified = classifyMonitoringError(error);
    const errorMessage = serializeMonitorError(classified);
    const technical =
      classified.technical ??
      (error instanceof Error ? error.message : "Unknown error");
    const errorCount = monitor.errorCount + 1;
    const isTemporary =
      classified.kind === "TEMPORARILY_UNAVAILABLE" ||
      classified.kind === "TIMEOUT" ||
      classified.kind === "SESSION_EXPIRED";
    // Soft failures retry sooner; permanent blocks follow the effective plan interval
    const retryAt = isTemporary
      ? new Date(Date.now() + 15 * 60 * 1000)
      : computeNextCheckAt(effectiveInterval);

    const sessionPatch =
      classified.kind === "SESSION_EXPIRED"
        ? ({
            config: {
              ...config,
              sessionStatus: "expired",
            } as Prisma.InputJsonValue,
          } as const)
        : {};

    monitorLogError("error", "Monitor check failed", error, {
      monitorId,
      url: monitor.url,
      mode: monitor.mode,
      data: {
        errorCount,
        maxRetries,
        willDisable: errorCount >= maxRetries,
        kind: classified.kind,
        title: classified.title,
        temporary: isTemporary,
        technical,
      },
    });

    await prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        errorCount,
        errorMessage,
        status: errorCount >= maxRetries ? MonitorStatus.ERROR : monitor.status,
        lastCheckedAt: now,
        nextCheckAt: retryAt,
        ...sessionPatch,
      },
    });

    await releaseMonitorQueue(monitor.id, retryAt, true);

    monitorLog({
      step: "database_updated",
      monitorId,
      message: "Error state persisted",
      data: {
        errorCount,
        kind: classified.kind,
        title: classified.title,
        nextCheckAt: retryAt.toISOString(),
      },
    });

    await trackEvent({
      type: "check.failed",
      userId: monitor.userId,
      metadata: {
        monitorId,
        errorCount,
        kind: classified.kind,
        message: classified.title.slice(0, 200),
      },
    });

    throw error;
  }
}

async function cleanupOldHistory(
  monitorId: string,
  plan: Plan,
  user: { email: string; role?: string | null }
) {
  if (isAdminUser(user)) return;

  const entitlements = getPlanEntitlements(plan);
  const historyDays = entitlements.historyDays;
  if (historyDays == null) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - historyDays);

  await prisma.change.deleteMany({
    where: { monitorId, createdAt: { lt: cutoff } },
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
  await syncAllDueMonitorsToQueue();

  const queuedIds = await claimDueMonitors(batchSize);

  const dueMonitors =
    queuedIds.length > 0
      ? await prisma.monitor.findMany({
          where: { id: { in: queuedIds }, status: MonitorStatus.ACTIVE },
          include: { user: { include: { subscription: true } } },
        })
      : await prisma.monitor.findMany({
          where: {
            status: MonitorStatus.ACTIVE,
            OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: new Date() } }],
          },
          include: { user: { include: { subscription: true } } },
          take: batchSize * 2,
          orderBy: [{ nextCheckAt: "asc" }],
        });

  monitorLog({
    step: "scheduler_batch",
    message: "Due monitors loaded",
    data: {
      queuedIds: queuedIds.length,
      dueCount: dueMonitors.length,
      batchSize,
    },
  });

  const sorted = dueMonitors.sort((a, b) => {
    const aPriority = a.user.subscription?.plan === Plan.BUSINESS ? 0 : 1;
    const bPriority = b.user.subscription?.plan === Plan.BUSINESS ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (a.nextCheckAt?.getTime() ?? 0) - (b.nextCheckAt?.getTime() ?? 0);
  });

  const batch = sorted.slice(0, batchSize);
  const seenUrls = new Set<string>();
  const toProcess: string[] = [];

  for (const monitor of batch) {
    // Prevent duplicate URL checks in the same batch (shared landing pages, etc.)
    if (seenUrls.has(monitor.url)) continue;
    seenUrls.add(monitor.url);
    toProcess.push(monitor.id);
  }

  // Process sequentially in small chunks to avoid launching too many browsers at once
  const chunkSize = Math.min(3, getCheckSlotStatus().max);
  const results: PromiseSettledResult<ProcessMonitorResult>[] = [];

  for (let i = 0; i < toProcess.length; i += chunkSize) {
    const chunk = toProcess.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(chunk.map((id) => processMonitor(id)));
    results.push(...chunkResults);
  }

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const monitorId = toProcess[i];

    if (result.status === "fulfilled") {
      if (result.value.status === "skipped") {
        skipped++;
      } else {
        succeeded++;
      }
    } else {
      failed++;
      monitorLogError("error", "Monitor in batch failed", result.reason, { monitorId });
    }
  }

  monitorLog({
    step: "scheduler_batch",
    message: "Batch processing complete",
    data: { total: toProcess.length, succeeded, skipped, failed },
  });

  try {
    await closeBrowser();
  } catch (closeError) {
    monitorLogError("error", "Browser close after batch failed (non-fatal)", closeError);
  }

  return succeeded;
}

export async function runMonitoringEngine(): Promise<{
  monitorsProcessed: number;
  analysesProcessed: number;
}> {
  monitorLog({
    step: "scheduler_started",
    message: "Monitoring engine cycle started",
  });

  const monitorsProcessed = await processDueMonitors(10);
  const analysesProcessed = await processPendingAnalyses(5);

  monitorLog({
    step: "scheduler_started",
    message: "Monitoring engine cycle finished",
    data: { monitorsProcessed, analysesProcessed },
  });

  return { monitorsProcessed, analysesProcessed };
}
