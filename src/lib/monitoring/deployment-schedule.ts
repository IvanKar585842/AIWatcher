import { resolveWorkerRunUrl } from "./worker-dispatch";

export interface DeploymentSchedule {
  minutes: number;
  label: string;
  detail: string;
}

/**
 * The cadence this deployment can actually trigger.
 * Plan intervals can be faster, but nothing runs until a tick reaches the queue.
 */
export function describeDeploymentSchedule(
  env: { MONITOR_WORKER_URL?: string; MONITOR_TICK_SOURCE?: string } = {
    MONITOR_WORKER_URL: process.env.MONITOR_WORKER_URL,
    MONITOR_TICK_SOURCE: process.env.MONITOR_TICK_SOURCE,
  }
): DeploymentSchedule {
  if (resolveWorkerRunUrl(env.MONITOR_WORKER_URL)) {
    return {
      minutes: 1,
      label: "Every minute",
      detail: "An always-on worker is configured. Due monitors are checked about once a minute.",
    };
  }

  if (env.MONITOR_TICK_SOURCE?.trim().toLowerCase() === "github") {
    return {
      minutes: 5,
      label: "Every 5 minutes",
      detail:
        "GitHub Actions is set as the tick source. Scheduled workflows can still start late, and a 1-minute interval needs the always-on worker.",
    };
  }

  return {
    minutes: 24 * 60,
    label: "Once a day",
    detail:
      "The platform schedule runs once a day. Save CRON_SECRET in GitHub Actions and set MONITOR_TICK_SOURCE=github for a 5-minute tick, or point MONITOR_WORKER_URL at the always-on worker for a 1-minute tick.",
  };
}
