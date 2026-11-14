/**
 * Cross-tenant checks for workspace routes and the older monitor routes.
 *
 * Usage: npx tsx scripts/test-tenant-isolation.ts
 */
import { PrismaClient } from "@prisma/client";
import { ApiError } from "../src/lib/errors";
import { buildDashboardStats } from "../src/lib/dashboard/stats-payload";
import { readDomainVerification } from "../src/lib/domain-verification";
import { issueSiteToken, readSiteInstallation } from "../src/lib/site-sdk";
import { monitorReadFilter } from "../src/lib/security/ownership";
import {
  assignMonitorToClient,
  createClient,
  createWorkspace,
  createWorkspaceInvite,
  getClientDetail,
  listWorkspaceProblems,
  readWorkspace,
  redeemWorkspaceInvite,
  updateWorkspaceBrand,
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
    data: { clerkId: `iso-owner-${stamp}`, email: `iso-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  const viewer = await prisma.user.create({
    data: { clerkId: `iso-viewer-${stamp}`, email: `iso-viewer-${stamp}@watchflowing.localhost`, name: "Viewer" },
  });
  const outsider = await prisma.user.create({
    data: { clerkId: `iso-out-${stamp}`, email: `iso-out-${stamp}@watchflowing.localhost`, name: "Outsider" },
  });
  await prisma.subscription.create({ data: { userId: owner.id, plan: "BUSINESS", status: "active" } });
  const workspace = await createWorkspace(owner.id, "Isolated Agency");
  const other = await createWorkspace(outsider.id, "Other Isolated");
  await redeemWorkspaceInvite(viewer.id, (await createWorkspaceInvite(owner.id, workspace.id, "VIEWER")).code);
  const client = await createClient(owner.id, workspace.id, "Hidden Client");
  const otherClient = await createClient(outsider.id, other.id, "Other Client");
  const monitor = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      clientId: client.id,
      name: "Hidden site",
      url: `https://example.com/isolated-${stamp}`,
      changes: { create: { summary: "Private change", importance: "HIGH" } },
    },
  });
  const change = await prisma.change.findFirst({ where: { monitorId: monitor.id } });

  await denied("an outsider cannot open the workspace", () => readWorkspace(outsider.id, workspace.id));
  await denied("an outsider cannot open the client", () => getClientDetail(outsider.id, workspace.id, client.id));
  await denied("a client id from another workspace is not found here", () =>
    getClientDetail(owner.id, workspace.id, otherClient.id)
  );
  await denied("an outsider cannot read the problem list", () => listWorkspaceProblems(outsider.id, workspace.id));
  const problems = await listWorkspaceProblems(viewer.id, workspace.id);
  assert("a viewer can see the client's site in the problem list", problems.some((item) => item.name === "Hidden site"));
  await denied("a viewer cannot create a client", () => createClient(viewer.id, workspace.id, "Nope"));
  await denied("a viewer cannot change the brand", () =>
    updateWorkspaceBrand(viewer.id, workspace.id, { name: "Stolen", hidePoweredBy: true })
  );
  await denied("a viewer cannot create a site key", () => issueSiteToken(viewer.id, monitor.id));
  await denied("a viewer cannot read the site key", () => readSiteInstallation(viewer.id, monitor.id));
  await denied("a viewer cannot read domain verification", () => readDomainVerification(viewer.id, monitor.id));
  await denied("an outsider cannot attach the site", () =>
    assignMonitorToClient(outsider.id, other.id, otherClient.id, monitor.id)
  );

  const outsiderChange = await prisma.change.findFirst({
    where: { id: change!.id, monitor: { userId: outsider.id } },
  });
  assert("the old change route does not return another user's change", outsiderChange === null);
  const outsiderMonitor = await prisma.monitor.findFirst({
    where: { AND: [{ id: monitor.id }, await monitorReadFilter(outsider.id)] },
  });
  assert("the old monitor list filter does not return another user's site", outsiderMonitor === null);
  const stats = await buildDashboardStats(outsider.id);
  assert(
    "dashboard stats for an outsider do not name the hidden site",
    stats.totalMonitors === 0 && stats.mostActiveWebsite?.url !== monitor.url
  );
  const removed = await prisma.monitor.deleteMany({ where: { id: monitor.id, userId: outsider.id } });
  const stillThere = await prisma.monitor.findUnique({ where: { id: monitor.id }, select: { id: true } });
  assert("a delete scoped to the wrong user removes nothing", removed.count === 0 && stillThere !== null);

  const example = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { workspaceId: true, clientId: true },
  });
  if (example) {
    assert("the pre-existing example monitor was not assigned", example.workspaceId === null && example.clientId === null);
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
