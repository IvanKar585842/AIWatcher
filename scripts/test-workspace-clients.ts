/**
 * Client management inside a workspace. Uses the real access functions.
 *
 * Usage: npx tsx scripts/test-workspace-clients.ts
 */
import { PrismaClient } from "@prisma/client";
import { ApiError } from "../src/lib/errors";
import { createWorkspace, createWorkspaceInvite, redeemWorkspaceInvite } from "../src/lib/workspace-access";
import {
  assignMonitorToClient,
  createClient,
  deleteClient,
  getClientDetail,
  listClients,
  renameClient,
  unassignMonitorFromClient,
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
    data: { clerkId: `cl-owner-${stamp}`, email: `cl-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  await prisma.subscription.create({ data: { userId: owner.id, plan: "BUSINESS", status: "active" } });
  const viewer = await prisma.user.create({
    data: { clerkId: `cl-viewer-${stamp}`, email: `cl-viewer-${stamp}@watchflowing.localhost`, name: "Viewer" },
  });
  const outsider = await prisma.user.create({
    data: { clerkId: `cl-out-${stamp}`, email: `cl-out-${stamp}@watchflowing.localhost`, name: "Outsider" },
  });
  const workspace = await createWorkspace(owner.id, "Client Agency");
  const other = await createWorkspace(outsider.id, "Other Agency");
  const invite = await createWorkspaceInvite(owner.id, workspace.id, "VIEWER");
  await redeemWorkspaceInvite(viewer.id, invite.code);

  const client = await createClient(owner.id, workspace.id, "Acme");
  assert("a client is created inside the workspace", client.workspaceId === workspace.id);
  await denied("a viewer cannot create a client", () => createClient(viewer.id, workspace.id, "Nope"));
  await denied("an outsider cannot list clients", () => listClients(outsider.id, workspace.id));

  const listed = await listClients(viewer.id, workspace.id);
  assert("a viewer can list clients", listed.some((item) => item.id === client.id && item.monitors === 0));

  const otherClient = await createClient(outsider.id, other.id, "Other Co");
  await denied("a client id from another workspace is not found here", () =>
    getClientDetail(owner.id, workspace.id, otherClient.id)
  );

  const renamed = await renameClient(owner.id, workspace.id, client.id, "Acme Studio");
  assert("the owner can rename a client", renamed.name === "Acme Studio");
  await denied("a viewer cannot rename a client", () => renameClient(viewer.id, workspace.id, client.id, "Hijack"));

  const monitor = await prisma.monitor.create({
    data: {
      userId: owner.id,
      name: "Acme site",
      url: `https://example.com/client-${stamp}`,
      snapshots: {
        create: { rawHtml: "<p>stay</p>", cleanedHtml: "<p>stay</p>", contentHash: `c-${stamp}`, extractedText: "stay" },
      },
      changes: { create: { summary: "Price changed", importance: "HIGH" } },
    },
  });
  const legacy = await prisma.monitor.create({
    data: { userId: owner.id, name: "Untouched", url: `https://example.com/legacy-client-${stamp}` },
  });
  await denied("an outsider cannot attach the owner's monitor", () =>
    assignMonitorToClient(outsider.id, other.id, otherClient.id, monitor.id)
  );
  await assignMonitorToClient(owner.id, workspace.id, client.id, monitor.id);
  const second = await createWorkspace(owner.id, "Second Agency");
  const secondClient = await createClient(owner.id, second.id, "Second Co");
  await denied("a site already in another workspace cannot be moved here", () =>
    assignMonitorToClient(owner.id, second.id, secondClient.id, monitor.id)
  );
  await denied("a viewer cannot attach a site", () =>
    assignMonitorToClient(viewer.id, workspace.id, client.id, monitor.id)
  );
  const detail = await getClientDetail(viewer.id, workspace.id, client.id);
  assert(
    "client detail counts the site and its change",
    detail.monitors.length === 1 && detail.changesToday === 1 && detail.recentChanges[0]?.summary === "Price changed"
  );
  const stored = await prisma.monitor.findUnique({ where: { id: monitor.id } });
  assert(
    "the monitor points at this workspace and client",
    stored?.workspaceId === workspace.id && stored.clientId === client.id && stored.userId === owner.id
  );
  const untouched = await prisma.monitor.findUnique({ where: { id: legacy.id } });
  assert("a second monitor stayed unassigned", untouched?.workspaceId === null && untouched.clientId === null);

  await denied("a viewer cannot detach a site", () =>
    unassignMonitorFromClient(viewer.id, workspace.id, client.id, monitor.id)
  );
  await unassignMonitorFromClient(owner.id, workspace.id, client.id, monitor.id);
  const detached = await prisma.monitor.findUnique({ where: { id: monitor.id } });
  assert("unassign clears the client and keeps the workspace", detached?.clientId === null && detached.workspaceId === workspace.id);
  await assignMonitorToClient(owner.id, workspace.id, client.id, monitor.id);

  await deleteClient(owner.id, workspace.id, client.id);
  const afterDelete = await prisma.monitor.findUnique({
    where: { id: monitor.id },
    include: { snapshots: true, changes: true },
  });
  assert(
    "deleting a client keeps the monitor, snapshot, change, and workspace",
    afterDelete?.clientId === null &&
      afterDelete.workspaceId === workspace.id &&
      afterDelete.snapshots.length === 1 &&
      afterDelete.changes.length === 1
  );
  await denied("the deleted client id no longer opens", () => getClientDetail(owner.id, workspace.id, client.id));

  const existing = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { workspaceId: true, clientId: true },
  });
  if (existing) {
    assert("the pre-existing example monitor was not assigned", existing.workspaceId === null && existing.clientId === null);
  } else {
    console.log("SKIP pre-existing example monitor — not in this database");
  }

  await prisma.user.deleteMany({ where: { id: { in: [owner.id, viewer.id, outsider.id] } } });
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
