import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Edge liveness probe — no DB, minimal cold start / TTFB.
 * Use /api/health for full readiness (database + integrations).
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "watchflowing",
      runtime: "edge",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
