import { processDueMonitors, runMonitoringEngine } from "@/lib/monitoring/processor";
import { monitorLog } from "@/lib/monitoring/logger";
import { shouldContinueCron } from "@/lib/monitoring/scheduler";

export async function runMonitoringCycle() {
  const startedAt = Date.now();
  monitorLog({
    step: "scheduler_started",
    message: "Cron monitoring cycle started",
  });

  let totalMonitors = 0;
  let analysesProcessed = 0;
  let batchMonitors = 0;

  do {
    const result = await runMonitoringEngine();
    batchMonitors = result.monitorsProcessed;
    totalMonitors += result.monitorsProcessed;
    analysesProcessed += result.analysesProcessed;
  } while (
    shouldContinueCron({
      startedAt,
      now: Date.now(),
      processed: totalMonitors,
      lastBatchSucceeded: batchMonitors,
    })
  );

  monitorLog({
    step: "scheduler_started",
    message: "Cron monitoring cycle finished",
    data: { processed: totalMonitors, analysesProcessed },
  });

  return { processed: totalMonitors, analysesProcessed };
}

export { processDueMonitors, runMonitoringEngine };
