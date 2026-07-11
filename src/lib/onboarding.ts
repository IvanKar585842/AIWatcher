import { prisma } from "@/lib/db";

export type OnboardingState = {
  onboardingCompleted: boolean;
  hasMonitors: boolean;
  showOnboarding: boolean;
};

/**
 * Onboarding is shown only for users with zero monitors who have not completed it.
 * Users who already have monitors are healed so they are not stuck after refresh/login.
 */
export async function resolveOnboardingState(
  userId: string,
  onboardingCompleted: boolean
): Promise<OnboardingState> {
  const monitorCount = await prisma.monitor.count({ where: { userId } });
  const hasMonitors = monitorCount > 0;

  if (hasMonitors && !onboardingCompleted) {
    await prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    });
    return {
      onboardingCompleted: true,
      hasMonitors: true,
      showOnboarding: false,
    };
  }

  return {
    onboardingCompleted,
    hasMonitors,
    showOnboarding: !onboardingCompleted && !hasMonitors,
  };
}

/** Persist completion after first monitor or manual finish. */
export async function markOnboardingCompleted(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, onboardingCompleted: false },
    data: { onboardingCompleted: true },
  });
}
