/**
 * In-process limits and counters for the Scrapling engine.
 * One shared browser worker is the default. Per-domain turns keep a single
 * host from being fetched concurrently.
 */

export interface FetchEngineMetrics {
  checks: number;
  successes: number;
  blocked: number;
  partial: number;
  failures: number;
  httpFetches: number;
  browserLaunches: number;
  totalDurationMs: number;
  marketplaceApiCalls: number;
}

const metrics: FetchEngineMetrics = {
  checks: 0,
  successes: 0,
  blocked: 0,
  partial: 0,
  failures: 0,
  httpFetches: 0,
  browserLaunches: 0,
  totalDurationMs: 0,
  marketplaceApiCalls: 0,
};

const domainQueues = new Map<string, Promise<void>>();

export function recordFetchSample(sample: {
  outcome: "success" | "blocked" | "partial" | "failure";
  strategy: string;
  browserLaunches: number;
  durationMs: number;
  marketplaceApiCalls?: number;
}): void {
  metrics.checks += 1;
  metrics.totalDurationMs += Math.max(0, sample.durationMs);
  metrics.browserLaunches += Math.max(0, sample.browserLaunches);
  metrics.marketplaceApiCalls += Math.max(0, sample.marketplaceApiCalls ?? 0);
  metrics.httpFetches += sample.browserLaunches > 0 ? 0 : 1;
  if (sample.outcome === "success") metrics.successes += 1;
  else if (sample.outcome === "blocked") metrics.blocked += 1;
  else if (sample.outcome === "partial") metrics.partial += 1;
  else metrics.failures += 1;
}

export function getFetchEngineMetrics(): FetchEngineMetrics {
  return { ...metrics };
}

export function resetFetchEngineMetrics(): void {
  for (const key of Object.keys(metrics) as (keyof FetchEngineMetrics)[]) {
    metrics[key] = 0;
  }
}

/** Local compute only. The default engine does not call a paid fetch API. */
export function estimateCostPerThousand(): {
  externalApiUsd: number;
  browserLaunchesPerCheck: number;
  averageDurationMs: number;
} {
  const checks = Math.max(metrics.checks, 1);
  return {
    externalApiUsd: 0,
    browserLaunchesPerCheck: metrics.browserLaunches / checks,
    averageDurationMs: metrics.totalDurationMs / checks,
  };
}

export async function withDomainTurn<T>(domain: string, fn: () => Promise<T>): Promise<T> {
  const previous = domainQueues.get(domain) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  domainQueues.set(domain, tail);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (domainQueues.get(domain) === tail) {
      domainQueues.delete(domain);
    }
  }
}
