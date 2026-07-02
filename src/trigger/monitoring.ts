import { tasks } from "@trigger.dev/sdk/v3";
import { processDueMonitors } from "@/lib/monitoring/processor";

export async function runMonitoringCycle() {
  let processed = 0;
  let totalProcessed = 0;

  do {
    processed = await processDueMonitors(10);
    totalProcessed += processed;
  } while (processed > 0 && totalProcessed < 100);

  return { processed: totalProcessed };
}

export async function triggerMonitorCheck(monitorId: string) {
  await tasks.trigger("check-monitor", { monitorId });
}
