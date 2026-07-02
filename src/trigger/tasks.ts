import { logger, schedules, task } from "@trigger.dev/sdk/v3";
import { processMonitor, processDueMonitors } from "@/lib/monitoring/processor";

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

export const scheduledMonitoringTask = schedules.task({
  id: "scheduled-monitoring",
  cron: "*/5 * * * *",
  run: async () => {
    logger.info("Running scheduled monitoring cycle");
    let processed = 0;
    let total = 0;

    do {
      processed = await processDueMonitors(10);
      total += processed;
    } while (processed > 0 && total < 50);

    logger.info("Monitoring cycle complete", { totalProcessed: total });
    return { processed: total };
  },
});
