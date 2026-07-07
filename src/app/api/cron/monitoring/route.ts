import { NextRequest, NextResponse } from "next/server";
import { runMonitoringCycle } from "@/trigger/monitoring";

export const maxDuration = 60;

function authorizeCron(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    const result = await runMonitoringCycle();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cron failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
