import { type MonitoringInterval, type MonitoringMode, type NotificationMethod } from "@prisma/client";
import {
  getEffectivePlan,
  getUserPlanEntitlements,
  getUserPlanLimits,
  isAdminUser,
  isIntervalAllowedForUser,
  type AdminUserLike,
} from "@/lib/admin";
import { ApiError } from "@/lib/errors";
import { isFeatureEnabled, requiredFeatureForMode, type PlanFeatureName } from "@/lib/plan-features";
import { isModeSelectableForCreate } from "@/lib/monitor-config";
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

/** Block new uses of deprecated/unreliable modes while preserving legacy monitors. */
export function assertMonitorModeSelectable(mode: MonitoringMode): void {
  if (!isModeSelectableForCreate(mode)) {
    throw new ApiError(
      "This monitoring type is no longer available for new monitors. Choose a supported public-page monitoring type instead.",
      400
    );
  }
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

/** Agency workspaces and seats reuse the existing team-member allowance. */
export function agencySeatAllowance(user: AdminUserLike): number {
  if (isAdminUser(user)) return Number.POSITIVE_INFINITY;
  const seats = getUserPlanEntitlements(user).teamMembers;
  return Number.isFinite(seats) && seats > 0 ? seats : 1;
}

export function assertAgencyWorkspaceQuota(user: AdminUserLike, ownedCount: number): void {
  const allowance = agencySeatAllowance(user);
  if (ownedCount >= allowance) {
    throw new ApiError(
      `This plan includes ${allowance} agency workspace${allowance === 1 ? "" : "s"}. Business includes 25.`,
      403
    );
  }
}

export function assertAgencySeatQuota(user: AdminUserLike, memberCount: number): void {
  const allowance = agencySeatAllowance(user);
  if (memberCount >= allowance) {
    throw new ApiError(
      `This plan includes ${allowance} agency seat${allowance === 1 ? "" : "s"}. Business includes 25.`,
      403
    );
  }
}

export function assertVisualMonitorQuota(
  user: AdminUserLike,
  currentVisualCount: number
): void {
  if (isAdminUser(user)) return;
  const limit = getUserPlanEntitlements(user).maxVisualMonitors;
  if (currentVisualCount >= limit) {
    throw new UpgradeRequiredError("VISUAL_MONITORING");
  }
}

export function assertIntervalAllowed(user: AdminUserLike, interval: MonitoringInterval): void {
  if (isAdminUser(user)) return;
  if (!isIntervalAllowedForUser(user, interval)) {
    throw new UpgradeRequiredError("FASTER_INTERVALS");
  }
}
