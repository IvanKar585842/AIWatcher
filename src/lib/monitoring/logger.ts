import { MonitoringMode } from "@prisma/client";

export type MonitorLogStep =
  | "scheduler_started"
  | "scheduler_batch"
  | "monitor_loaded"
  | "monitor_skipped"
  | "lock_acquired"
  | "lock_skipped"
  | "fetch_start"
  | "fetch_success"
  | "fetch_failed"
  | "page_cleaned"
  | "content_extracted"
  | "comparison_start"
  | "no_change"
  | "noise_filtered"
  | "difference_detected"
  | "snapshot_created"
  | "change_stored"
  | "database_updated"
  | "analysis_queued"
  | "ai_analysis_start"
  | "ai_analysis_complete"
  | "error";

export interface MonitorLogContext {
  monitorId?: string;
  url?: string;
  mode?: MonitoringMode | string;
  step: MonitorLogStep;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

function formatLog(ctx: MonitorLogContext): string {
  const parts = [
    `[monitoring]`,
    `[${ctx.step}]`,
    ctx.monitorId ? `monitor=${ctx.monitorId}` : null,
    ctx.url ? `url=${ctx.url}` : null,
    ctx.mode ? `mode=${ctx.mode}` : null,
    ctx.message,
  ].filter(Boolean);

  return parts.join(" ");
}

export function monitorLog(ctx: MonitorLogContext): void {
  const payload = {
    ...ctx,
    timestamp: new Date().toISOString(),
  };

  if (ctx.step === "error" || ctx.step === "fetch_failed") {
    console.error(formatLog(ctx), ctx.data ?? "", ctx.error ?? "");
  } else {
    console.log(formatLog(ctx), ctx.data ? JSON.stringify(ctx.data) : "");
  }

  if (process.env.MONITOR_DEBUG === "true") {
    console.debug("[monitoring:debug]", JSON.stringify(payload));
  }
}

export function monitorLogError(
  step: MonitorLogStep,
  message: string,
  error: unknown,
  extra?: Partial<MonitorLogContext>
): void {
  monitorLog({
    step: "error",
    message,
    error: error instanceof Error ? error.message : String(error),
    ...extra,
  });
}
