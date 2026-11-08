import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { securityLog } from "@/lib/security/log";

export async function monitorReadFilter(userId: string): Promise<Prisma.MonitorWhereInput> {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = memberships.map((membership) => membership.teamId);
    if (teamIds.length === 0) return { userId };
    return { OR: [{ userId }, { teamId: { in: teamIds } }] };
  } catch {
    return { userId };
  }
}

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

/** Owner, or a member of the team the monitor was shared with. */
export async function assertMonitorReadable(userId: string, monitorId: string) {
  const owned = await prisma.monitor.findFirst({
    where: { id: monitorId, userId },
  });
  if (owned) return owned;

  try {
    const shared = await prisma.monitor.findFirst({
      where: {
        id: monitorId,
        team: { members: { some: { userId } } },
      },
    });
    if (shared) return shared;
  } catch {
    // Team tables are absent until the product-access migration is applied.
  }

  securityLog({
    type: "ownership.denied",
    message: "Monitor access denied or not found",
    userId,
    resourceId: monitorId,
    route: "assertMonitorReadable",
  });
  throw new ApiError("Monitor not found", 404);
}

/**
 * Ensure the authenticated user owns the change (via its monitor).
 */
export async function assertChangeOwnedBy(userId: string, changeId: string) {
  const change = await prisma.change.findFirst({
    where: {
      id: changeId,
      monitor: await monitorReadFilter(userId),
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
