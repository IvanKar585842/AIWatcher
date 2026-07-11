import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runMonitoringCycle } from "@/trigger/monitoring";

export const maxDuration = 120;

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
