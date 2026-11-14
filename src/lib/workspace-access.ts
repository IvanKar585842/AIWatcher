import { Prisma, type WorkspaceRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { hashSecret, inviteIsOpen } from "@/lib/access/secrets";
import { randomBytes } from "node:crypto";
import { assertAgencySeatQuota, assertAgencyWorkspaceQuota, assertMonitorQuota } from "@/lib/plan-guards";
import {
  canGrantWorkspaceRole,
  canRemoveWorkspaceMember,
  roleAllows,
  type WorkspacePermission,
  type WorkspaceRoleName,
} from "@/lib/tenancy";
import { loadSiteSignalProblems } from "@/lib/site-sdk";
import { groupAgencyProblems } from "@/lib/notifications/alert-group";
import { readWorkspaceBrand } from "@/lib/reports/brand";

const NOT_FOUND = () => new ApiError("Not found", 404);
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const planUserSelect = {
  email: true,
  role: true,
  referralProUntil: true,
  referralBonusMonitors: true,
  subscription: { select: { plan: true, status: true } },
} as const;

async function lockUser(db: Db, userId: string) {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE
  `;
  return rows[0] ?? null;
}

type Db = Prisma.TransactionClient;

export type WorkspaceAccess = {
  workspaceId: string;
  name: string;
  ownerId: string;
  role: WorkspaceRoleName;
};

async function lockWorkspace(db: Db, workspaceId: string): Promise<{ id: string; ownerId: string; name: string } | null> {
  const rows = await db.$queryRaw<Array<{ id: string; ownerId: string; name: string }>>`
    SELECT "id", "ownerId", "name"
    FROM "Workspace"
    WHERE "id" = ${workspaceId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function requireWorkspacePermission(
  db: Db,
  userId: string,
  workspaceId: string,
  permission: WorkspacePermission
): Promise<WorkspaceAccess> {
  const workspace = await lockWorkspace(db, workspaceId);
  if (!workspace) throw NOT_FOUND();

  let role: WorkspaceRoleName;
  if (workspace.ownerId === userId) {
    role = "OWNER";
  } else {
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!member) throw NOT_FOUND();
    role = member.role;
  }

  if (!roleAllows(role, permission)) throw NOT_FOUND();
  return { workspaceId: workspace.id, name: workspace.name, ownerId: workspace.ownerId, role };
}

export async function createWorkspace(ownerId: string, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) throw new ApiError("Name the workspace", 400);
  return prisma.$transaction(async (tx) => {
    const locked = await lockUser(tx, ownerId);
    if (!locked) throw NOT_FOUND();
    const owner = await tx.user.findUnique({ where: { id: ownerId }, select: planUserSelect });
    if (!owner) throw NOT_FOUND();
    const owned = await tx.workspace.count({ where: { ownerId } });
    assertAgencyWorkspaceQuota(owner, owned);
    const workspace = await tx.workspace.create({
      data: { name: trimmed, ownerId },
      select: { id: true, name: true, ownerId: true },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: ownerId, role: "OWNER" },
    });
    return workspace;
  });
}

export async function listWorkspaces(userId: string) {
  const rows = await prisma.workspace.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      members: { where: { userId }, select: { role: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: (row.ownerId === userId ? "OWNER" : row.members[0]?.role ?? "VIEWER") as WorkspaceRoleName,
  }));
}

export async function readWorkspace(userId: string, workspaceId: string) {
  return prisma.$transaction((tx) => requireWorkspacePermission(tx, userId, workspaceId, "workspace.read"));
}

export async function renameWorkspace(userId: string, workspaceId: string, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) throw new ApiError("Name the workspace", 400);
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "workspace.update");
    await tx.workspace.update({ where: { id: access.workspaceId }, data: { name: trimmed } });
    return { id: access.workspaceId, name: trimmed, role: access.role };
  });
}

export async function readWorkspaceBrandForUser(userId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "workspace.read");
    const row = await tx.workspace.findUnique({
      where: { id: access.workspaceId },
      select: { name: true, settings: true },
    });
    if (!row) throw NOT_FOUND();
    return { workspaceName: row.name, ...readWorkspaceBrand(row.settings), role: access.role };
  });
}

export async function updateWorkspaceBrand(
  userId: string,
  workspaceId: string,
  input: { name: string; hidePoweredBy: boolean }
) {
  const name = input.name.trim().slice(0, 80);
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "workspace.update");
    const row = await tx.workspace.findUnique({
      where: { id: access.workspaceId },
      select: { settings: true },
    });
    const base =
      row?.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
        ? { ...(row.settings as Record<string, unknown>) }
        : {};
    base.brand = { name, hidePoweredBy: input.hidePoweredBy };
    await tx.workspace.update({
      where: { id: access.workspaceId },
      data: { settings: base as Prisma.InputJsonValue },
    });
    return { brandName: name || null, hidePoweredBy: input.hidePoweredBy };
  });
}

export async function deleteWorkspace(userId: string, workspaceId: string) {
  await prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "workspace.delete");
    await tx.workspace.delete({ where: { id: access.workspaceId } });
  });
}

export async function listMembers(userId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "members.read");
    const members = await tx.workspaceMember.findMany({
      where: { workspaceId: access.workspaceId },
      select: { userId: true, role: true, user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return members.map((member) => ({
      userId: member.userId,
      role: member.role,
      email: member.user.email,
      name: member.user.name,
    }));
  });
}

export async function setMemberRole(
  actorId: string,
  workspaceId: string,
  targetUserId: string,
  next: WorkspaceRoleName
) {
  if (next === "OWNER") throw NOT_FOUND();
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, actorId, workspaceId, "members.update");
    const target = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: access.workspaceId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw NOT_FOUND();
    if (!canGrantWorkspaceRole(access.role, target.role, next)) throw NOT_FOUND();
    await tx.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: access.workspaceId, userId: targetUserId } },
      data: { role: next },
    });
    return { userId: targetUserId, role: next };
  });
}

export async function removeMember(actorId: string, workspaceId: string, targetUserId: string) {
  await prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, actorId, workspaceId, "members.remove");
    const target = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: access.workspaceId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) throw NOT_FOUND();
    if (!canRemoveWorkspaceMember(access.role, target.role)) throw NOT_FOUND();
    await tx.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId: access.workspaceId, userId: targetUserId } },
    });
  });
}

export async function createWorkspaceInvite(actorId: string, workspaceId: string, role: WorkspaceRole) {
  if (role === "OWNER") throw NOT_FOUND();
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, actorId, workspaceId, "members.invite");
    if (!canGrantWorkspaceRole(access.role, null, role)) throw NOT_FOUND();
    const owner = await tx.user.findUnique({ where: { id: access.ownerId }, select: planUserSelect });
    if (!owner) throw NOT_FOUND();
    const members = await tx.workspaceMember.count({ where: { workspaceId: access.workspaceId } });
    assertAgencySeatQuota(owner, members);
    const code = `wfws_${randomBytes(24).toString("base64url")}`;
    await tx.workspaceInvite.create({
      data: {
        workspaceId: access.workspaceId,
        codeHash: hashSecret(code),
        role,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        createdById: actorId,
      },
    });
    return { code, role };
  });
}

export async function redeemWorkspaceInvite(userId: string, code: string) {
  const hash = hashSecret(code.trim());
  return prisma.$transaction(async (tx) => {
    const invite = await tx.workspaceInvite.findUnique({ where: { codeHash: hash } });
    if (!invite || !inviteIsOpen(invite) || invite.role === "OWNER") throw NOT_FOUND();
    await lockWorkspace(tx, invite.workspaceId);
    const existing = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
      select: { role: true },
    });
    if (!existing) {
      const workspace = await tx.workspace.findUnique({
        where: { id: invite.workspaceId },
        select: { owner: { select: planUserSelect } },
      });
      if (!workspace) throw NOT_FOUND();
      const members = await tx.workspaceMember.count({ where: { workspaceId: invite.workspaceId } });
      assertAgencySeatQuota(workspace.owner, members);
      await tx.workspaceMember.create({
        data: { workspaceId: invite.workspaceId, userId, role: invite.role },
      });
    }
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), acceptedById: userId },
    });
    return { workspaceId: invite.workspaceId, role: existing?.role ?? invite.role, alreadyMember: Boolean(existing) };
  });
}

export async function assertClientVisible(userId: string, clientId: string) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { id: true, workspaceId: true, name: true },
    });
    if (!client) throw NOT_FOUND();
    await requireWorkspacePermission(tx, userId, client.workspaceId, "clients.read");
    return client;
  });
}

export async function assertMonitorVisibleInWorkspace(userId: string, monitorId: string) {
  return prisma.$transaction(async (tx) => {
    const monitor = await tx.monitor.findUnique({
      where: { id: monitorId },
      select: { id: true, userId: true, workspaceId: true, clientId: true, name: true },
    });
    if (!monitor?.workspaceId) throw NOT_FOUND();
    await requireWorkspacePermission(tx, userId, monitor.workspaceId, "monitors.read");
    return monitor;
  });
}

function cleanClientName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) throw new ApiError("Name the client", 400);
  return trimmed;
}

export async function listClients(userId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "clients.read");
    const clients = await tx.client.findMany({
      where: { workspaceId: access.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { monitors: true } } },
    });
    return clients.map((client) => ({
      id: client.id,
      name: client.name,
      monitors: client._count.monitors,
    }));
  });
}

export async function createClient(userId: string, workspaceId: string, name: string) {
  const clean = cleanClientName(name);
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "clients.write");
    return tx.client.create({
      data: { workspaceId: access.workspaceId, name: clean },
      select: { id: true, name: true, workspaceId: true },
    });
  });
}

export async function getClientDetail(userId: string, workspaceId: string, clientId: string) {
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "clients.read");
    const client = await tx.client.findFirst({
      where: { id: clientId, workspaceId: access.workspaceId },
      select: { id: true, name: true, workspaceId: true },
    });
    if (!client) throw NOT_FOUND();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monitorWhere = { workspaceId: access.workspaceId, clientId: client.id };
    const [monitors, changesToday, recentChanges] = await Promise.all([
      tx.monitor.findMany({
        where: monitorWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true, url: true, status: true, lastCheckedAt: true, lastChangedAt: true },
      }),
      tx.change.count({ where: { monitor: monitorWhere, createdAt: { gte: today } } }),
      tx.change.findMany({
        where: { monitor: monitorWhere },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          summary: true,
          importance: true,
          createdAt: true,
          monitor: { select: { name: true } },
        },
      }),
    ]);
    return {
      id: client.id,
      name: client.name,
      monitors,
      activeMonitors: monitors.filter((monitor) => monitor.status === "ACTIVE").length,
      changesToday,
      recentChanges,
    };
  });
}

export async function renameClient(userId: string, workspaceId: string, clientId: string, name: string) {
  const clean = cleanClientName(name);
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "clients.write");
    const updated = await tx.client.updateMany({
      where: { id: clientId, workspaceId: access.workspaceId },
      data: { name: clean },
    });
    if (updated.count !== 1) throw NOT_FOUND();
    return { id: clientId, name: clean };
  });
}

export async function deleteClient(userId: string, workspaceId: string, clientId: string) {
  await prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "clients.write");
    const deleted = await tx.client.deleteMany({
      where: { id: clientId, workspaceId: access.workspaceId },
    });
    if (deleted.count !== 1) throw NOT_FOUND();
  });
}

export async function assignMonitorToClient(
  userId: string,
  workspaceId: string,
  clientId: string,
  monitorId: string
) {
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "monitors.write");
    await requireWorkspacePermission(tx, userId, workspaceId, "clients.write");
    const client = await tx.client.findFirst({
      where: { id: clientId, workspaceId: access.workspaceId },
      select: { id: true },
    });
    if (!client) throw NOT_FOUND();
    const alreadyHere = await tx.monitor.findFirst({
      where: { id: monitorId, userId, workspaceId: access.workspaceId },
      select: { id: true },
    });
    if (!alreadyHere) {
      const owner = await tx.user.findUnique({ where: { id: access.ownerId }, select: planUserSelect });
      if (!owner) throw NOT_FOUND();
      const sites = await tx.monitor.count({ where: { workspaceId: access.workspaceId } });
      assertMonitorQuota(owner, sites);
    }
    const updated = await tx.monitor.updateMany({
      where: {
        id: monitorId,
        userId,
        OR: [{ workspaceId: null }, { workspaceId: access.workspaceId }],
      },
      data: { workspaceId: access.workspaceId, clientId: client.id },
    });
    if (updated.count !== 1) throw NOT_FOUND();
    return { id: monitorId, clientId: client.id, workspaceId: access.workspaceId };
  });
}

export async function unassignMonitorFromClient(
  userId: string,
  workspaceId: string,
  clientId: string,
  monitorId: string
) {
  await prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "monitors.write");
    const updated = await tx.monitor.updateMany({
      where: { id: monitorId, userId, workspaceId: access.workspaceId, clientId },
      data: { clientId: null },
    });
    if (updated.count !== 1) throw NOT_FOUND();
  });
}

const PROBLEM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function resolveClientForNewMonitor(userId: string, clientId: string) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { id: true, workspaceId: true },
    });
    if (!client) throw NOT_FOUND();
    const access = await requireWorkspacePermission(tx, userId, client.workspaceId, "monitors.write");
    const owner = await tx.user.findUnique({ where: { id: access.ownerId }, select: planUserSelect });
    if (!owner) throw NOT_FOUND();
    const sites = await tx.monitor.count({ where: { workspaceId: access.workspaceId } });
    assertMonitorQuota(owner, sites);
    return { clientId: client.id, workspaceId: client.workspaceId };
  });
}

export async function listClientsForMonitorCreate(userId: string) {
  const workspaces = await listWorkspaces(userId);
  const workspaceIds = workspaces.filter((workspace) => roleAllows(workspace.role, "monitors.write")).map((workspace) => workspace.id);
  if (workspaceIds.length === 0) return [];
  const clients = await prisma.client.findMany({
    where: { workspaceId: { in: workspaceIds } },
    orderBy: [{ workspace: { name: "asc" } }, { name: "asc" }],
    take: 100,
    select: { id: true, name: true, workspace: { select: { name: true } } },
  });
  return clients.map((client) => ({
    id: client.id,
    name: client.name,
    workspaceName: client.workspace.name,
  }));
}

export async function listAttachableMonitors(userId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "monitors.write");
    return tx.monitor.findMany({
      where: {
        userId,
        clientId: null,
        OR: [{ workspaceId: null }, { workspaceId: access.workspaceId }],
      },
      orderBy: { name: "asc" },
      take: 100,
      select: { id: true, name: true, url: true },
    });
  });
}

export async function listWorkspaceProblems(userId: string, workspaceId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const access = await requireWorkspacePermission(tx, userId, workspaceId, "monitors.read");
    const since = new Date(Date.now() - PROBLEM_WINDOW_MS);
    const monitors = await tx.monitor.findMany({
      where: {
        workspaceId: access.workspaceId,
        OR: [
          { status: "ERROR" },
          { errorCount: { gt: 0 } },
          {
            changes: {
              some: { importance: { in: ["HIGH", "CRITICAL"] }, createdAt: { gte: since } },
            },
          },
        ],
      },
      orderBy: [{ status: "desc" }, { name: "asc" }],
      take: 40,
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
        errorCount: true,
        client: { select: { id: true, name: true } },
        changes: {
          where: { importance: { in: ["HIGH", "CRITICAL"] }, createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { summary: true, importance: true },
        },
      },
    });
    return {
      workspaceId: access.workspaceId,
      problems: monitors.map((monitor) => {
        const change = monitor.changes[0] ?? null;
        const checkFailing = monitor.status === "ERROR" || monitor.errorCount > 0;
        return {
          id: monitor.id,
          name: monitor.name,
          url: monitor.url,
          status: monitor.status,
          client: monitor.client,
          summary: change?.summary ?? null,
          importance: change?.importance ?? null,
          reason: checkFailing && change ? "both" : checkFailing ? "check" : "change",
        };
      }),
    };
  });
  const signals = await loadSiteSignalProblems(result.workspaceId);
  return groupAgencyProblems([...signals, ...result.problems]).slice(0, 40);
}

export async function workspaceHomeSummary(userId: string) {
  const workspaces = (await listWorkspaces(userId)).slice(0, 5);
  if (workspaces.length === 0) return [];
  const ids = workspaces.map((workspace) => workspace.id);
  const since = new Date(Date.now() - PROBLEM_WINDOW_MS);
  const [clientGroups, siteGroups, problemRows, signalRows] = await Promise.all([
    prisma.client.groupBy({
      by: ["workspaceId"],
      where: { workspaceId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.monitor.groupBy({
      by: ["workspaceId"],
      where: { workspaceId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.monitor.findMany({
      where: {
        workspaceId: { in: ids },
        OR: [
          { status: "ERROR" },
          { errorCount: { gt: 0 } },
          {
            changes: {
              some: { importance: { in: ["HIGH", "CRITICAL"] }, createdAt: { gte: since } },
            },
          },
        ],
      },
      take: 200,
      select: {
        id: true,
        workspaceId: true,
        status: true,
        errorCount: true,
        clientId: true,
        changes: {
          where: { importance: { in: ["HIGH", "CRITICAL"] }, createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { summary: true, importance: true },
        },
      },
    }),
    prisma.siteSignal
      .findMany({
        where: {
          createdAt: { gte: since },
          kind: { in: ["js_error", "element_missing"] },
          monitor: { workspaceId: { in: ids } },
        },
        take: 100,
        select: {
          id: true,
          kind: true,
          message: true,
          selector: true,
          monitor: { select: { workspaceId: true, clientId: true } },
        },
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022")) {
          return [];
        }
        throw error;
      }),
  ]);
  const clientsByWorkspace = new Map(clientGroups.map((row) => [row.workspaceId, row._count._all]));
  const sitesByWorkspace = new Map(siteGroups.map((row) => [row.workspaceId, row._count._all]));

  return workspaces.map((workspace) => {
    const monitorProblems = problemRows
      .filter((row) => row.workspaceId === workspace.id)
      .map((row) => {
        const change = row.changes[0] ?? null;
        const checkFailing = row.status === "ERROR" || row.errorCount > 0;
        return {
          id: row.id,
          summary: change?.summary ?? null,
          importance: change?.importance ?? null,
          client: row.clientId ? { id: row.clientId } : null,
          reason: checkFailing ? "check" : "change",
        };
      });
    const signalProblems = signalRows
      .filter((row) => row.monitor.workspaceId === workspace.id)
      .map((row) => ({
        id: row.id,
        summary: row.kind === "js_error" ? row.message : `${row.selector} is missing`,
        importance: "HIGH",
        client: row.monitor.clientId ? { id: row.monitor.clientId } : null,
        reason: "signal",
      }));
    return {
      id: workspace.id,
      name: workspace.name,
      role: workspace.role,
      clients: clientsByWorkspace.get(workspace.id) ?? 0,
      sites: sitesByWorkspace.get(workspace.id) ?? 0,
      problems: groupAgencyProblems([...signalProblems, ...monitorProblems]).length,
    };
  });
}
