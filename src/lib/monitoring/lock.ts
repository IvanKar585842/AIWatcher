import { securityLog } from "@/lib/security/log";

const activeLocks = new Map<string, number>();
const LOCK_TTL_MS = 5 * 60 * 1000;

/** Cap concurrent Playwright/browser checks per process to prevent resource exhaustion */
const MAX_CONCURRENT_CHECKS = Math.max(
  1,
  Number(process.env.MAX_CONCURRENT_CHECKS || 5)
);

let activeCheckSlots = 0;

export function acquireMonitorLock(monitorId: string): boolean {
  const now = Date.now();
  const existing = activeLocks.get(monitorId);

  if (existing && now - existing < LOCK_TTL_MS) {
    return false;
  }

  activeLocks.set(monitorId, now);
  return true;
}

export function releaseMonitorLock(monitorId: string): void {
  activeLocks.delete(monitorId);
}

export function cleanupStaleLocks(): void {
  const now = Date.now();
  for (const [id, ts] of activeLocks) {
    if (now - ts >= LOCK_TTL_MS) activeLocks.delete(id);
  }
}

/**
 * Global slot for expensive browser/network checks.
 * Prevents launching too many browsers at once on one worker.
 */
export function acquireCheckSlot(monitorId?: string): boolean {
  if (activeCheckSlots >= MAX_CONCURRENT_CHECKS) {
    securityLog({
      type: "resource.throttled",
      message: "Concurrent check slot limit reached",
      resourceId: monitorId,
      metadata: { active: activeCheckSlots, max: MAX_CONCURRENT_CHECKS },
    });
    return false;
  }
  activeCheckSlots += 1;
  return true;
}

export function releaseCheckSlot(): void {
  activeCheckSlots = Math.max(0, activeCheckSlots - 1);
}

export function getCheckSlotStatus(): { active: number; max: number } {
  return { active: activeCheckSlots, max: MAX_CONCURRENT_CHECKS };
}
