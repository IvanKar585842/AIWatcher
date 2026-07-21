import { NextResponse } from "next/server";
import { getEffectivePlan, isAdminUser } from "@/lib/admin";
import { trackUserActiveThrottled } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import {
  buildDashboardStats,
  buildUserContextPayload,
} from "@/lib/dashboard/stats-payload";
import { withRateLimit } from "@/lib/rate-limit";

/**
 * Single round-trip for dashboard shell:
 * user context (sidebar admin/plan) + lean command-center stats.
 */
export async function GET() {
  try {
    const user = await requireUser();

    return withRateLimit(
      "dashboard-bootstrap",
      async () => {
        trackUserActiveThrottled(user.id);

        const [stats] = await Promise.all([
          buildDashboardStats(user.id, { lean: true }),
        ]);

        return NextResponse.json(
          {
            user: buildUserContextPayload({
              id: user.id,
              email: user.email,
              name: user.name,
              role: (user as { role?: string }).role,
              onboardingCompleted: user.onboardingCompleted,
              isAdmin: isAdminUser(user),
              plan: getEffectivePlan(user),
            }),
            stats,
          },
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
    console.error("Dashboard bootstrap error:", error);
    return NextResponse.json({ error: "Failed to load dashboard bootstrap" }, { status: 500 });
  }
}
