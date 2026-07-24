import { NextRequest, NextResponse } from "next/server";
import { safeEqualString } from "@/lib/security/timing-safe";

/** Shared Bearer CRON_SECRET check for /api/cron/* routes. */
export function authorizeCron(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron is not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${cronSecret}`;
  if (!safeEqualString(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
