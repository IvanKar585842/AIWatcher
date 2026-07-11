import { type MonitoringInterval, type MonitoringMode, type NotificationMethod } from "@prisma/client";
import {
  getEffectivePlan,
  getUserPlanLimits,
  isAdminUser,
  isIntervalAllowedForUser,
  type AdminUserLike,
} from "@/lib/admin";
import { ApiError } from "@/lib/errors";
import { isFeatureEnabled, requiredFeatureForMode, type PlanFeatureName } from "@/lib/plan-features";
import { UpgradeRequiredError } from "@/lib/upgrade-error";

export { UpgradeRequiredError } from "@/lib/upgrade-error";

export function assertFeature(user: AdminUserLike, feature: PlanFeatureName): void {
  if (isAdminUser(user)) return;
  const plan = getEffectivePlan(user);
  if (!isFeatureEnabled(plan, feature)) {
    throw new UpgradeRequiredError(feature);
  }
}

export function assertNotificationAllowed(
  user: AdminUserLike,
  notificationMethod: NotificationMethod
): void {
  if (isAdminUser(user)) return;

  if (
    (notificationMethod === "TELEGRAM" || notificationMethod === "BOTH") &&
    !getUserPlanLimits(user).telegram
  ) {
    throw new UpgradeRequiredError("TELEGRAM_NOTIFICATIONS");
  }
}

export function assertMonitorModeAllowed(user: AdminUserLike, mode: MonitoringMode): void {
  if (isAdminUser(user)) return;
  const feature = requiredFeatureForMode(mode);
  if (feature) assertFeature(user, feature);
}

export function assertMonitorQuota(user: AdminUserLike, currentCount: number): void {
  if (isAdminUser(user)) return;
  const limits = getUserPlanLimits(user);
  if (currentCount >= limits.maxMonitors) {
    throw new ApiError(
      `You're using all ${limits.maxMonitors} monitors on your plan. Upgrade to watch more websites without juggling limits.`,
      403
    );
  }
}

export function assertIntervalAllowed(user: AdminUserLike, interval: MonitoringInterval): void {
  if (isAdminUser(user)) return;
  if (!isIntervalAllowedForUser(user, interval)) {
    throw new UpgradeRequiredError("FASTER_INTERVALS");
  }
}
