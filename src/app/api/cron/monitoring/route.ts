import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { authorizeCron } from "@/lib/cron-auth";
import { runMonitoringCycle } from "@/trigger/monitoring";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const started = Date.now();
  try {
    const result = await runMonitoringCycle();
    void trackEvent({
      type: "cron.monitoring",
      metadata: {
        ...("processed" in result ? { processed: (result as { processed?: number }).processed } : {}),
      },
      durationMs: Date.now() - started,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    console.error("[cron/monitoring]", message);
    void trackEvent({
      type: "cron.failed",
      metadata: { route: "monitoring", error: message.slice(0, 200) },
      durationMs: Date.now() - started,
    });
    return NextResponse.json({ error: "Monitoring cron failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
