/**
 * Sites filed under a workspace client, and the shared problem list.
 *
 * Usage: npx tsx scripts/test-workspace-sites.ts
 */
import { PrismaClient } from "@prisma/client";
import { ApiError } from "../src/lib/errors";
import { createWorkspace, createWorkspaceInvite, redeemWorkspaceInvite } from "../src/lib/workspace-access";
import {
  listAttachableMonitors,
  listClientsForMonitorCreate,
  listWorkspaceProblems,
  resolveClientForNewMonitor,
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
    data: { clerkId: `site-owner-${stamp}`, email: `site-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  await prisma.subscription.create({ data: { userId: owner.id, plan: "BUSINESS", status: "active" } });
  const viewer = await prisma.user.create({
    data: { clerkId: `site-viewer-${stamp}`, email: `site-viewer-${stamp}@watchflowing.localhost`, name: "Viewer" },
  });
  const member = await prisma.user.create({
    data: { clerkId: `site-member-${stamp}`, email: `site-member-${stamp}@watchflowing.localhost`, name: "Member" },
  });
  const outsider = await prisma.user.create({
    data: { clerkId: `site-out-${stamp}`, email: `site-out-${stamp}@watchflowing.localhost`, name: "Outsider" },
  });
  const workspace = await createWorkspace(owner.id, "Site Agency");
  const other = await createWorkspace(outsider.id, "Other Sites");
  await redeemWorkspaceInvite(viewer.id, (await createWorkspaceInvite(owner.id, workspace.id, "VIEWER")).code);
  await redeemWorkspaceInvite(member.id, (await createWorkspaceInvite(owner.id, workspace.id, "MEMBER")).code);
  const client = await prisma.client.create({ data: { workspaceId: workspace.id, name: "North Client" } });
  const otherClient = await prisma.client.create({ data: { workspaceId: other.id, name: "Other Client" } });

  const link = await resolveClientForNewMonitor(owner.id, client.id);
  assert("a new monitor can be filed under its client", link.workspaceId === workspace.id && link.clientId === client.id);
  const filed = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: link.workspaceId,
      clientId: link.clientId,
      name: "Filed site",
      url: `https://example.com/filed-${stamp}`,
      status: "ACTIVE",
    },
  });
  const plain = await prisma.monitor.create({
    data: { userId: owner.id, name: "Plain site", url: `https://example.com/plain-${stamp}` },
  });
  assert("a monitor without a client stays outside the workspace", plain.workspaceId === null && plain.clientId === null);

  await denied("a viewer cannot file a new monitor under the client", () => resolveClientForNewMonitor(viewer.id, client.id));
  await denied("an outsider cannot file a monitor under this client", () => resolveClientForNewMonitor(outsider.id, client.id));
  const viewerChoices = await listClientsForMonitorCreate(viewer.id);
  const ownerChoices = await listClientsForMonitorCreate(owner.id);
  assert("a viewer is not offered clients when creating a monitor", viewerChoices.every((item) => item.id !== client.id));
  assert("the owner is offered the client", ownerChoices.some((item) => item.id === client.id && item.workspaceName === "Site Agency"));

  const broken = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      clientId: client.id,
      name: "Broken site",
      url: `https://example.com/broken-${stamp}`,
      status: "ERROR",
      errorCount: 3,
    },
  });
  const important = await prisma.monitor.create({
    data: {
      userId: member.id,
      workspaceId: workspace.id,
      clientId: client.id,
      name: "Important site",
      url: `https://example.com/important-${stamp}`,
      status: "ACTIVE",
      changes: { create: { summary: "Checkout disappeared", importance: "CRITICAL" } },
    },
  });
  await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      clientId: client.id,
      name: "Quiet site",
      url: `https://example.com/quiet-${stamp}`,
      status: "ACTIVE",
      changes: { create: { summary: "A comma moved", importance: "LOW" } },
    },
  });
  const old = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      name: "Old alert",
      url: `https://example.com/old-${stamp}`,
      status: "ACTIVE",
      changes: {
        create: {
          summary: "Old price",
          importance: "HIGH",
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });
  await prisma.monitor.create({
    data: {
      userId: outsider.id,
      workspaceId: other.id,
      clientId: otherClient.id,
      name: "Foreign broken",
      url: `https://example.com/foreign-${stamp}`,
      status: "ERROR",
      errorCount: 2,
    },
  });

  const problems = await listWorkspaceProblems(viewer.id, workspace.id);
  const problemIds = problems.map((item) => item.id);
  assert(
    "problems include a failing check and a recent critical change",
    problemIds.includes(broken.id) &&
      problemIds.includes(important.id) &&
      problems.find((item) => item.id === broken.id)?.reason === "check" &&
      problems.find((item) => item.id === important.id)?.summary === "Checkout disappeared"
  );
  assert(
    "healthy, old, and foreign sites stay out of this problem list",
    !problemIds.includes(filed.id) && !problemIds.includes(plain.id) && !problemIds.includes(old.id) && problems.length === 2
  );
  await denied("an outsider cannot read the problem list", () => listWorkspaceProblems(outsider.id, workspace.id));

  const attachable = await listAttachableMonitors(owner.id, workspace.id);
  const attachableIds = attachable.map((item) => item.id);
  assert(
    "only the owner's unassigned sites can be attached",
    attachableIds.includes(plain.id) && attachableIds.includes(old.id) && !attachableIds.includes(broken.id) && !attachableIds.includes(important.id)
  );
  await denied("a viewer cannot list sites to attach", () => listAttachableMonitors(viewer.id, workspace.id));
  const memberAttachable = await listAttachableMonitors(member.id, workspace.id);
  assert("a member does not see the owner's unassigned site", memberAttachable.every((item) => item.id !== plain.id));

  const existing = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { workspaceId: true, clientId: true },
  });
  if (existing) {
    assert("the pre-existing example monitor was not assigned", existing.workspaceId === null && existing.clientId === null);
  } else {
    console.log("SKIP pre-existing example monitor — not in this database");
  }

  await prisma.user.deleteMany({ where: { id: { in: [owner.id, viewer.id, member.id, outsider.id] } } });
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
