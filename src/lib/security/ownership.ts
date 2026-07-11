import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { securityLog } from "@/lib/security/log";

/**
 * Ensure the authenticated user owns the monitor before any mutation/read by id.
 */
export async function assertMonitorOwnedBy(userId: string, monitorId: string) {
  const monitor = await prisma.monitor.findFirst({
    where: { id: monitorId, userId },
  });

  if (!monitor) {
    securityLog({
      type: "ownership.denied",
      message: "Monitor access denied or not found",
      userId,
      resourceId: monitorId,
      route: "assertMonitorOwnedBy",
    });
    throw new ApiError("Monitor not found", 404);
  }

  return monitor;
}

/**
 * Ensure the authenticated user owns the change (via its monitor).
 */
export async function assertChangeOwnedBy(userId: string, changeId: string) {
  const change = await prisma.change.findFirst({
    where: {
      id: changeId,
      monitor: { userId },
    },
    include: {
      monitor: { select: { id: true, userId: true, name: true, url: true } },
    },
  });

  if (!change) {
    securityLog({
      type: "ownership.denied",
      message: "Change access denied or not found",
      userId,
      resourceId: changeId,
      route: "assertChangeOwnedBy",
    });
    throw new ApiError("Change not found", 404);
  }

  return change;
}
