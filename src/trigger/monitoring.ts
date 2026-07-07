import { processDueMonitors, runMonitoringEngine } from "@/lib/monitoring/processor";

export async function runMonitoringCycle() {
  let totalMonitors = 0;
  let analysesProcessed = 0;
  let batchMonitors = 0;

  do {
    const result = await runMonitoringEngine();
    batchMonitors = result.monitorsProcessed;
    totalMonitors += result.monitorsProcessed;
    analysesProcessed += result.analysesProcessed;
  } while (batchMonitors > 0 && totalMonitors < 100);

  return { processed: totalMonitors, analysesProcessed };
}

export { processDueMonitors, runMonitoringEngine };

export async function triggerMonitorCheck(monitorId: string) {
  const { tasks } = await import("@trigger.dev/sdk/v3");
  await tasks.trigger("check-monitor", { monitorId });
}
