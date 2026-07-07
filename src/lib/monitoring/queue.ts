import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

const LOCK_STALE_MS = 5 * 60 * 1000;
const WORKER_ID = `worker-${randomUUID().slice(0, 8)}`;

export async function syncMonitorQueue(monitorId: string, scheduledAt: Date): Promise<void> {
  try {
    await prisma.monitorQueue.upsert({
      where: { monitorId },
      create: { monitorId, scheduledAt },
      update: {
        scheduledAt,
        attempts: 0,
        lockedAt: null,
        lockedBy: null,
      },
    });
  } catch {
    // MonitorQueue table may not exist yet — fall back to nextCheckAt polling
  }
}

export async function releaseMonitorQueue(
  monitorId: string,
  nextScheduledAt: Date,
  failed = false
): Promise<void> {
  try {
    await prisma.monitorQueue.upsert({
      where: { monitorId },
      create: { monitorId, scheduledAt: nextScheduledAt },
      update: {
        scheduledAt: nextScheduledAt,
        lockedAt: null,
        lockedBy: null,
        attempts: failed ? { increment: 1 } : 0,
      },
    });
  } catch {
    // queue optional
  }
}

export async function claimDueMonitors(batchSize: number): Promise<string[]> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_STALE_MS);

  try {
    const candidates = await prisma.monitorQueue.findMany({
      where: {
        scheduledAt: { lte: now },
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
      },
      orderBy: { scheduledAt: "asc" },
      take: batchSize * 2,
      select: { id: true, monitorId: true },
    });

    const claimed: string[] = [];

    for (const item of candidates) {
      if (claimed.length >= batchSize) break;

      const result = await prisma.monitorQueue.updateMany({
        where: {
          id: item.id,
          OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
        },
        data: {
          lockedAt: now,
          lockedBy: WORKER_ID,
        },
      });

      if (result.count > 0) {
        claimed.push(item.monitorId);
      }
    }

    return claimed;
  } catch {
    return [];
  }
}

export async function syncAllDueMonitorsToQueue(): Promise<void> {
  const now = new Date();

  try {
    const dueMonitors = await prisma.monitor.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
      },
      select: { id: true, nextCheckAt: true },
    });

    await Promise.all(
      dueMonitors.map((m) =>
        syncMonitorQueue(m.id, m.nextCheckAt ?? now)
      )
    );
  } catch {
    // optional
  }
}
