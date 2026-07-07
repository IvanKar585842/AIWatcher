import { logger, schedules, task } from "@trigger.dev/sdk/v3";
import { processMonitor, runMonitoringEngine } from "@/lib/monitoring/processor";
import { processPendingAnalyses } from "@/lib/monitoring/ai-processor";

export const checkMonitorTask = task({
  id: "check-monitor",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
  },
  run: async (payload: { monitorId: string }) => {
    logger.info("Checking monitor", { monitorId: payload.monitorId });
    await processMonitor(payload.monitorId);
    return { success: true, monitorId: payload.monitorId };
  },
});

export const analyzePendingChangesTask = task({
  id: "analyze-pending-changes",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
  },
  run: async () => {
    const processed = await processPendingAnalyses(10);
    logger.info("Pending analyses processed", { processed });
    return { processed };
  },
});

export const scheduledMonitoringTask = schedules.task({
  id: "scheduled-monitoring",
  cron: "*/5 * * * *",
  run: async () => {
    logger.info("Running scheduled monitoring cycle");
    let totalMonitors = 0;
    let analysesProcessed = 0;
    let batchMonitors = 0;

    do {
      const result = await runMonitoringEngine();
      batchMonitors = result.monitorsProcessed;
      totalMonitors += result.monitorsProcessed;
      analysesProcessed += result.analysesProcessed;
    } while (batchMonitors > 0 && totalMonitors < 50);

    logger.info("Monitoring cycle complete", { totalMonitors, analysesProcessed });
    return { processed: totalMonitors, analysesProcessed };
  },
});
