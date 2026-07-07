import { Plan, type NotificationMethod } from "@prisma/client";
import { getUserPlanLimits, isAdminUser, type AdminUserLike } from "@/lib/admin";
import { ApiError } from "@/lib/errors";

export function assertNotificationAllowed(
  user: AdminUserLike,
  notificationMethod: NotificationMethod
): void {
  if (isAdminUser(user)) return;

  const limits = getUserPlanLimits(user);
  if (
    (notificationMethod === "TELEGRAM" || notificationMethod === "BOTH") &&
    !limits.telegram
  ) {
    throw new ApiError("Telegram notifications require Pro plan or higher.", 403);
  }
}
