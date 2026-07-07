import { Plan, type NotificationMethod } from "@prisma/client";
import { getPlanLimits } from "@/lib/constants";
import { ApiError } from "@/lib/errors";

export function assertNotificationAllowed(
  plan: Plan,
  notificationMethod: NotificationMethod
): void {
  const limits = getPlanLimits(plan);
  if (
    (notificationMethod === "TELEGRAM" || notificationMethod === "BOTH") &&
    !limits.telegram
  ) {
    throw new ApiError("Telegram notifications require Pro plan or higher.", 403);
  }
}
