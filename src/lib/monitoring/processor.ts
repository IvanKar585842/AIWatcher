import {
  AnalysisStatus,
  MonitorStatus,
  Plan,
  type Prisma,
} from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import { INTERVAL_MINUTES } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { parseMonitorConfig } from "@/lib/monitor-config";
import { processPendingAnalyses } from "./ai-processor";
import { hasMeaningfulChange } from "./content-cleaner";
import { generateTextDiff } from "./diff";
import { closeBrowser, fetchPageContent } from "./fetcher";
import { acquireMonitorLock, cleanupStaleLocks, releaseMonitorLock } from "./lock";
import {
  claimDueMonitors,
  releaseMonitorQueue,
  syncAllDueMonitorsToQueue,
  syncMonitorQueue,
} from "./queue";
import { prepareHtmlForStorage, readSnapshotHtml } from "./snapshot-store";

const DEFAULT_MAX_RETRIES = 3;

function buildCleanOptions(config: ReturnType<typeof parseMonitorConfig>) {
  return {
    ignoreTimestamps: config.ignoreTimestamps,
    ignoreRandomIds: config.ignoreRandomIds,
    ignoreDynamicContent: config.ignoreDynamicContent,
    ignoreCookies: config.ignoreCookies,
    ignoreAds: config.ignoreAds,
  };
}

function computeNextCheckAt(interval: keyof typeof INTERVAL_MINUTES, from = new Date()): Date {
  return new Date(from.getTime() + INTERVAL_MINUTES[interval] * 60 * 1000);
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
): Promise<void> {
  const [compressedRaw, compressedCleaned] = await Promise.all([
    prepareHtmlForStorage(data.rawHtml),
    prepareHtmlForStorage(data.cleanedHtml),
  ]);

  await prisma.snapshot.create({
    data: {
      monitorId,
      rawHtml: compressedRaw,
      cleanedHtml: compressedCleaned,
      contentHash: data.contentHash,
      extractedText: data.extractedText,
      metadata: data.metadata as Prisma.InputJsonValue,
    },
  });
}

export async function processMonitor(monitorId: string): Promise<void> {
  cleanupStaleLocks();

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
      user: { include: { subscription: true } },
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
  const now = new Date();
  const nextCheckAt = computeNextCheckAt(monitor.interval, now);

  try {
    const result = await fetchPageContent({
      url: monitor.url,
      mode: monitor.mode,
      selector: monitor.selector,
      keywords: monitor.keywords,
      respectRobots: monitor.respectRobots,
      timeout: config.timeout,
      ignoreAds: config.ignoreAds,
      cleanOptions: buildCleanOptions(config),
      maxRetries,
    });

    const previousSnapshot = monitor.snapshots[0];

    // First check — store baseline snapshot
    if (!previousSnapshot) {
      await saveSnapshot(monitor.id, result);
      await updateMonitorChecked(monitor.id, nextCheckAt);
      await trackEvent({
        type: "monitor.check",
        userId: monitor.userId,
        metadata: { monitorId, baseline: true },
      });
      return;
    }

    // Fast path: content hash unchanged
    if (previousSnapshot.contentHash === result.contentHash) {
      await updateMonitorChecked(monitor.id, nextCheckAt);
      return;
    }

    const previous = await readSnapshotHtml(previousSnapshot);

    // Filter noise: ignore insignificant text deltas
    if (!hasMeaningfulChange(previous.extractedText, result.extractedText)) {
      await updateMonitorChecked(monitor.id, nextCheckAt);
      return;
    }

    const diffHtml = generateTextDiff(
      previous.extractedText.slice(0, 5000),
      result.extractedText.slice(0, 5000)
    );

    const [storedOldHtml, storedNewHtml] = await Promise.all([
      prepareHtmlForStorage(previous.cleanedHtml),
      prepareHtmlForStorage(result.cleanedHtml),
    ]);

    // Store change immediately; AI analysis runs in a separate pass
    const change = await prisma.change.create({
      data: {
        monitorId: monitor.id,
        summary: "Change detected — analysis pending",
        importance: "MEDIUM",
        category: "CONTENT",
        oldHtml: storedOldHtml.slice(0, 50000),
        newHtml: storedNewHtml.slice(0, 50000),
        diffHtml,
        bulletPoints: [],
        emoji: "🔔",
        analysisStatus: AnalysisStatus.PENDING,
      },
    });

    await saveSnapshot(monitor.id, result);

    await updateMonitorChecked(monitor.id, nextCheckAt, {
      lastChangedAt: now,
    });

    await trackEvent({
      type: "change.detected",
      userId: monitor.userId,
      metadata: { monitorId, changeId: change.id, pendingAnalysis: true },
    });

    await cleanupOldHistory(monitor.id, plan);
    await releaseMonitorQueue(monitor.id, nextCheckAt);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorCount = monitor.errorCount + 1;
    const retryAt = computeNextCheckAt(monitor.interval);

    await prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        errorCount,
        errorMessage,
        status: errorCount >= maxRetries ? MonitorStatus.ERROR : monitor.status,
        lastCheckedAt: now,
        nextCheckAt: retryAt,
      },
    });

    await releaseMonitorQueue(monitor.id, retryAt, true);
    throw error;
  }
}

async function cleanupOldHistory(monitorId: string, plan: Plan) {
  if (plan !== Plan.FREE) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

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
    if (seenUrls.has(monitor.url)) continue;
    seenUrls.add(monitor.url);
    toProcess.push(monitor.id);
  }

  const results = await Promise.allSettled(toProcess.map((id) => processMonitor(id)));
  return results.filter((r) => r.status === "fulfilled").length;
}

export async function runMonitoringEngine(): Promise<{
  monitorsProcessed: number;
  analysesProcessed: number;
}> {
  let monitorsProcessed = 0;
  let analysesProcessed = 0;

  monitorsProcessed += await processDueMonitors(10);
  analysesProcessed += await processPendingAnalyses(5);

  return { monitorsProcessed, analysesProcessed };
}
