/** Remember a browser strategy only when the monitor has not chosen one explicitly. */
export function rememberBrowserStrategy(
  current: string | undefined,
  used: unknown
): "dynamic" | "advanced" | null {
  if (used !== "dynamic" && used !== "advanced") return null;
  if (current === "http" || current === "dynamic" || current === "advanced") return null;
  return used;
}

/** Stop starting new batches before the 120s Vercel limit kills an in-flight check. */
export const CRON_BATCH_BUDGET_MS = 70_000;
export const CRON_MAX_SUCCESSES = 40;

export function shouldContinueCron(input: {
  startedAt: number;
  now: number;
  processed: number;
  lastBatchSucceeded: number;
}): boolean {
  if (input.lastBatchSucceeded <= 0) return false;
  if (input.processed >= CRON_MAX_SUCCESSES) return false;
  if (input.now - input.startedAt >= CRON_BATCH_BUDGET_MS) return false;
  return true;
}

/** One URL per batch. Extra monitors stay queued instead of being fetched twice at once. */
export function partitionMonitorsByUrl<T extends { id: string; url: string }>(monitors: T[]) {
  const seen = new Set<string>();
  const process: T[] = [];
  const defer: T[] = [];
  for (const monitor of monitors) {
    if (seen.has(monitor.url)) {
      defer.push(monitor);
      continue;
    }
    seen.add(monitor.url);
    process.push(monitor);
  }
  return { process, defer };
}
