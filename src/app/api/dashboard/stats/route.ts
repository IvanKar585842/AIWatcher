import { NextRequest, NextResponse } from "next/server";
import { trackUserActiveThrottled } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { buildDashboardStats } from "@/lib/dashboard/stats-payload";
import { withRateLimit } from "@/lib/rate-limit";

/**
 * Dashboard stats.
 * ?lean=1 — skip recentNotifications (Feed loads them when Alerts tab opens).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const lean = request.nextUrl.searchParams.get("lean") === "1";

    return withRateLimit(
      "dashboard-stats",
      async () => {
        trackUserActiveThrottled(user.id);
        const stats = await buildDashboardStats(user.id, { lean });

        return NextResponse.json(
          { stats },
          {
            headers: {
              "Cache-Control": "private, max-age=20, stale-while-revalidate=40",
            },
          }
        );
      },
      user.id
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to load dashboard stats" }, { status: 500 });
  }
}
