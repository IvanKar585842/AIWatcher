const activeLocks = new Map<string, number>();
const LOCK_TTL_MS = 5 * 60 * 1000;

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
