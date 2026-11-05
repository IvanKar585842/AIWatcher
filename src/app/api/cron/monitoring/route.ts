import { NextRequest, NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { authorizeCron } from "@/lib/cron-auth";
import { resolveWorkerRunUrl } from "@/lib/monitoring/worker-dispatch";
import { runMonitoringCycle } from "@/trigger/monitoring";

export const maxDuration = 120;

async function runHere() {
  return runMonitoringCycle();
}

async function runOnWorker(request: NextRequest, target: string) {
  const response = await fetch(target, {
    method: "POST",
    headers: {
      authorization: request.headers.get("authorization") ?? "",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(100_000),
  });
  if (response.status >= 300 && response.status < 400) {
    return NextResponse.json({ error: "Worker refused a redirect" }, { status: 502 });
  }
  const body = await response.json().catch(() => ({ error: "Worker returned an unreadable response" }));
  return NextResponse.json(body, { status: response.status });
}

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const started = Date.now();
  try {
    const target = resolveWorkerRunUrl(process.env.MONITOR_WORKER_URL);
    const result = target ? null : await runHere();
    const response = target ? await runOnWorker(request, target) : NextResponse.json({ success: true, ...result });
    if (!target) {
      void trackEvent({
        type: "cron.monitoring",
        metadata: {
          ...("processed" in (result ?? {}) ? { processed: (result as { processed?: number }).processed } : {}),
          executor: "local",
        },
        durationMs: Date.now() - started,
      });
    }
    return response;
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
