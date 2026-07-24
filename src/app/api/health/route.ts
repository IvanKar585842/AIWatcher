import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public readiness probe for uptime monitors.
 * Does not disclose which integrations are configured (use admin tools for that).
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const ok = database === "ok";

  return NextResponse.json(
    {
      ok,
      service: "watchflowing",
      database,
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
