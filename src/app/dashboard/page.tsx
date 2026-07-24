import { Suspense } from "react";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { requireUser } from "@/lib/auth";
import { getEffectivePlan, isAdminUser } from "@/lib/admin";
import {
  buildDashboardStats,
  buildUserContextPayload,
} from "@/lib/dashboard/stats-payload";
import type { DashboardBootstrap } from "@/hooks/use-dashboard-bootstrap";
import { resolveOnboardingState } from "@/lib/onboarding";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Server-seed bootstrap so Command Center paints stats without waiting on
 * a client round-trip (major dashboard FCP/LCP win).
 */
export default async function DashboardPage() {
  let showOnboarding = false;
  let initialBootstrap: DashboardBootstrap | null = null;

  try {
    const user = await requireUser();
    const [state, stats] = await Promise.all([
      resolveOnboardingState(user.id, user.onboardingCompleted),
      buildDashboardStats(user.id, { lean: true }),
    ]);
    showOnboarding = state.showOnboarding;
    // JSON round-trip matches /api/dashboard/bootstrap serialization (Dates → strings)
    initialBootstrap = JSON.parse(
      JSON.stringify({
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
      })
    ) as DashboardBootstrap;
  } catch {
    // Auth middleware should have redirected; fall through to client home.
  }

  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-1">
          <Skeleton className="h-28 w-full rounded-2xl bg-white/[0.04]" />
          <Skeleton className="min-h-[320px] w-full rounded-2xl bg-white/[0.04]" />
        </div>
      }
    >
      <DashboardHome
        initialShowOnboarding={showOnboarding}
        initialBootstrap={initialBootstrap}
      />
    </Suspense>
  );
}
