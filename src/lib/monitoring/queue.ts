import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";

const LOCK_STALE_MS = 5 * 60 * 1000;
const WORKER_ID = `worker-${randomUUID().slice(0, 8)}`;

/** Fields safe to write while another worker may hold the row. */
export function queueReconcileData(scheduledAt: Date): { scheduledAt: Date } {
  return { scheduledAt };
}

export async function syncMonitorQueue(monitorId: string, scheduledAt: Date): Promise<void> {
  try {
    await prisma.monitorQueue.upsert({
      where: { monitorId },
      create: { monitorId, scheduledAt },
      update: queueReconcileData(scheduledAt),
    });
  } catch {
    // MonitorQueue table may not exist yet — fall back to nextCheckAt polling
  }
}

/** Clear a lock without moving the schedule. Used for duplicates and paused rows. */
export async function unlockMonitorQueue(monitorId: string): Promise<void> {
  try {
    await prisma.monitorQueue.updateMany({
      where: { monitorId },
      data: { lockedAt: null, lockedBy: null },
    });
  } catch {
    // queue optional
  }
}

export async function dropMonitorQueue(monitorId: string): Promise<void> {
  try {
    await prisma.monitorQueue.deleteMany({ where: { monitorId } });
  } catch {
    // queue optional
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

export async function syncAllDueMonitorsToQueue(maxDue = 200): Promise<void> {
  const now = new Date();

  try {
    const dueMonitors = await prisma.monitor.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }],
      },
      select: { id: true, nextCheckAt: true },
      orderBy: { nextCheckAt: "asc" },
      take: maxDue,
    });

    // Upsert in chunks to avoid bursting the DB connection pool
    const chunkSize = 25;
    for (let i = 0; i < dueMonitors.length; i += chunkSize) {
      const chunk = dueMonitors.slice(i, i + chunkSize);
      await Promise.all(chunk.map((m) => syncMonitorQueue(m.id, m.nextCheckAt ?? now)));
    }
  } catch {
    // optional
  }
}
