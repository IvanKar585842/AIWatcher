import { Suspense } from "react";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { requireUser } from "@/lib/auth";
import { resolveOnboardingState } from "@/lib/onboarding";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Resolve onboarding on the server so the dashboard shell paints without
 * waiting on a client /api/user/onboarding round-trip.
 */
export default async function DashboardPage() {
  let showOnboarding = false;

  try {
    const user = await requireUser();
    const state = await resolveOnboardingState(user.id, user.onboardingCompleted);
    showOnboarding = state.showOnboarding;
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
      <DashboardHome initialShowOnboarding={showOnboarding} />
    </Suspense>
  );
}
