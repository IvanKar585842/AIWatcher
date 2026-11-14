/**
 * Workspace authorization against the local database.
 * Calls the real access functions. Does not mock permissions.
 *
 * Usage: npx tsx scripts/test-workspace-auth.ts
 */
import { PrismaClient } from "@prisma/client";
import { ApiError } from "../src/lib/errors";
import {
  assertClientVisible,
  assertMonitorVisibleInWorkspace,
  createWorkspace,
  createWorkspaceInvite,
  deleteWorkspace,
  listWorkspaces,
  readWorkspace,
  redeemWorkspaceInvite,
  removeMember,
  renameWorkspace,
  setMemberRole,
} from "../src/lib/workspace-access";

const prisma = new PrismaClient();

function assert(name: string, condition: boolean, detail = "") {
  if (!condition) {
    console.error("FAIL", name, detail);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

async function denied(name: string, run: () => Promise<unknown>) {
  try {
    await run();
    assert(name, false, "expected denial");
  } catch (error) {
    assert(name, error instanceof ApiError && error.status === 404, error instanceof Error ? error.message : "");
  }
}

async function main() {
  const stamp = Date.now().toString();
  const owner = await prisma.user.create({
    data: { clerkId: `ws-owner-${stamp}`, email: `ws-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  await prisma.subscription.create({ data: { userId: owner.id, plan: "BUSINESS", status: "active" } });
  const stranger = await prisma.user.create({
    data: { clerkId: `ws-stranger-${stamp}`, email: `ws-stranger-${stamp}@watchflowing.localhost`, name: "Stranger" },
  });
  const outsider = await prisma.user.create({
    data: { clerkId: `ws-outsider-${stamp}`, email: `ws-outsider-${stamp}@watchflowing.localhost`, name: "Outsider" },
  });
  const admin = await prisma.user.create({
    data: { clerkId: `ws-admin-${stamp}`, email: `ws-admin-${stamp}@watchflowing.localhost`, name: "Admin" },
  });

  const workspace = await createWorkspace(owner.id, "Agency North");
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: owner.id } },
  });
  assert("creating a workspace also records the owner", membership?.role === "OWNER");

  const visible = await listWorkspaces(owner.id);
  assert("the owner sees the workspace", visible.some((item) => item.id === workspace.id && item.role === "OWNER"));
  assert("a stranger sees none of that workspace", (await listWorkspaces(stranger.id)).every((item) => item.id !== workspace.id));

  await denied("a stranger cannot read the workspace", () => readWorkspace(stranger.id, workspace.id));
  await denied("a stranger cannot delete the workspace", () => deleteWorkspace(stranger.id, workspace.id));
  await denied("a stranger cannot rename the workspace", () => renameWorkspace(stranger.id, workspace.id, "Stolen"));
  await denied("an unknown workspace id is not found", () => readWorkspace(owner.id, "missing-workspace"));

  let ownerChangeRejected = false;
  try {
    await prisma.workspace.update({ where: { id: workspace.id }, data: { ownerId: stranger.id } });
  } catch (error) {
    ownerChangeRejected = error instanceof Error && error.message.includes("owner cannot be changed");
  }
  assert("the database rejects an owner change", ownerChangeRejected);

  const memberInvite = await createWorkspaceInvite(owner.id, workspace.id, "MEMBER");
  const joined = await redeemWorkspaceInvite(stranger.id, memberInvite.code);
  assert("an invite adds the redeemer", joined.workspaceId === workspace.id && joined.role === "MEMBER");
  await denied("the same invite cannot be reused", () => redeemWorkspaceInvite(admin.id, memberInvite.code));

  let duplicateRejected = false;
  try {
    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: stranger.id, role: "VIEWER" },
    });
  } catch {
    duplicateRejected = true;
  }
  assert("a duplicate membership is rejected", duplicateRejected);

  await denied("a member cannot delete the workspace", () => deleteWorkspace(stranger.id, workspace.id));
  await denied("a member cannot grant themselves owner", () => setMemberRole(stranger.id, workspace.id, stranger.id, "OWNER"));
  let selfOwnerRejected = false;
  try {
    await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: stranger.id } },
      data: { role: "OWNER" },
    });
  } catch (error) {
    selfOwnerRejected = error instanceof Error && error.message.includes("owner role");
  }
  assert("the database rejects a second owner", selfOwnerRejected);

  await setMemberRole(owner.id, workspace.id, stranger.id, "VIEWER");
  await denied("a viewer cannot rename the workspace", () => renameWorkspace(stranger.id, workspace.id, "Nope"));
  await setMemberRole(owner.id, workspace.id, stranger.id, "ADMIN");
  const renamed = await renameWorkspace(stranger.id, workspace.id, "Agency North Updated");
  assert("an admin can rename the workspace", renamed.name === "Agency North Updated");
  await denied("an admin cannot delete the workspace", () => deleteWorkspace(stranger.id, workspace.id));
  await denied("an admin cannot change the owner role", () => setMemberRole(stranger.id, workspace.id, owner.id, "ADMIN"));

  const adminInvite = await createWorkspaceInvite(owner.id, workspace.id, "ADMIN");
  await redeemWorkspaceInvite(admin.id, adminInvite.code);
  await denied("an admin cannot remove another admin", () => removeMember(stranger.id, workspace.id, admin.id));
  await removeMember(owner.id, workspace.id, admin.id);
  await denied("a removed admin can no longer read the workspace", () => readWorkspace(admin.id, workspace.id));

  const client = await prisma.client.create({ data: { workspaceId: workspace.id, name: "Acme" } });
  const seen = await assertClientVisible(owner.id, client.id);
  assert("the owner can read the workspace client", seen.id === client.id);
  await denied("a removed user cannot read the client", () => assertClientVisible(admin.id, client.id));

  const monitor = await prisma.monitor.create({
    data: {
      userId: owner.id,
      name: "Acme home",
      url: `https://example.com/acme-${stamp}`,
      workspaceId: workspace.id,
      clientId: client.id,
      snapshots: { create: { rawHtml: "<p>keep</p>", cleanedHtml: "<p>keep</p>", contentHash: `h-${stamp}`, extractedText: "keep" } },
      changes: { create: { summary: "keep" } },
    },
  });
  await denied("an outsider cannot read the workspace monitor", () => assertMonitorVisibleInWorkspace(outsider.id, monitor.id));
  await denied("a removed member cannot read the workspace monitor", () => assertMonitorVisibleInWorkspace(admin.id, monitor.id));
  const ownedMonitor = await prisma.monitor.findFirst({ where: { id: monitor.id, userId: owner.id } });
  assert("the old userId ownership check still finds the monitor", ownedMonitor?.id === monitor.id);

  const lockStarted = Date.now();
  const hold = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspace.id} FOR UPDATE`;
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
  const removal = removeMember(owner.id, workspace.id, stranger.id).then(
    () => "removed",
    () => "denied"
  );
  await hold;
  const removalResult = await removal;
  assert(
    "removing a member waits until the workspace lock is released",
    Date.now() - lockStarted >= 650 && removalResult === "removed"
  );
  await denied("the removed member can no longer read the workspace", () => readWorkspace(stranger.id, workspace.id));

  await deleteWorkspace(owner.id, workspace.id);
  const kept = await prisma.monitor.findUnique({
    where: { id: monitor.id },
    include: { snapshots: true, changes: true },
  });
  assert(
    "deleting the workspace keeps the monitor history and clears tenancy",
    kept?.workspaceId === null && kept.clientId === null && kept.snapshots.length === 1 && kept.changes.length === 1
  );
  await denied("the deleted workspace id no longer resolves", () => readWorkspace(owner.id, workspace.id));

  const legacy = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { workspaceId: true, clientId: true, userId: true },
  });
  if (legacy) {
    assert("the pre-existing monitor was not moved", legacy.workspaceId === null && legacy.clientId === null && legacy.userId.length > 0);
  } else {
    console.log("SKIP pre-existing example monitor — not in this database");
  }

  await prisma.user.deleteMany({ where: { id: { in: [owner.id, stranger.id, admin.id, outsider.id] } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
