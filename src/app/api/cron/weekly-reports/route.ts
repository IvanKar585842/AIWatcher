import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { runWeeklyReportCycle } from "@/lib/reports/run-weekly";

export const maxDuration = 120;

async function handle(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const force = request.nextUrl.searchParams.get("force") === "1";
  const result = await runWeeklyReportCycle({ force, deliver: true });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
