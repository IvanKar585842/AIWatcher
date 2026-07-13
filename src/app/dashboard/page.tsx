import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { requireUser } from "@/lib/auth";
import { resolveOnboardingState } from "@/lib/onboarding";

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

  return <DashboardHome initialShowOnboarding={showOnboarding} />;
}
