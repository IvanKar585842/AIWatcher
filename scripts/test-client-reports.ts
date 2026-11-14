/**
 * Client reports stay inside one workspace and do not include page HTML.
 *
 * Usage: npx tsx scripts/test-client-reports.ts
 */
import { PrismaClient, ReportFrequency } from "@prisma/client";
import { ApiError } from "../src/lib/errors";
import { readWorkspaceBrand } from "../src/lib/reports/brand";
import { buildClientReport } from "../src/lib/reports/client-report";
import {
  createWorkspace,
  createWorkspaceInvite,
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
  assert("empty settings have no brand", readWorkspaceBrand(null).brandName === null && readWorkspaceBrand({ other: true }).hidePoweredBy === false);
  assert(
    "a saved brand is read without the rest of settings",
    readWorkspaceBrand({ brand: { name: "North", hidePoweredBy: true }, other: 1 }).brandName === "North"
  );

  const stamp = Date.now().toString();
  const owner = await prisma.user.create({
    data: { clerkId: `rep-owner-${stamp}`, email: `rep-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  await prisma.subscription.create({ data: { userId: owner.id, plan: "BUSINESS", status: "active" } });
  const viewer = await prisma.user.create({
    data: { clerkId: `rep-viewer-${stamp}`, email: `rep-viewer-${stamp}@watchflowing.localhost`, name: "Viewer" },
  });
  const member = await prisma.user.create({
    data: { clerkId: `rep-member-${stamp}`, email: `rep-member-${stamp}@watchflowing.localhost`, name: "Member" },
  });
  const outsider = await prisma.user.create({
    data: { clerkId: `rep-out-${stamp}`, email: `rep-out-${stamp}@watchflowing.localhost`, name: "Outsider" },
  });
  const workspace = await createWorkspace(owner.id, "Report Agency");
  const other = await createWorkspace(outsider.id, "Other Reports");
  await redeemWorkspaceInvite(viewer.id, (await createWorkspaceInvite(owner.id, workspace.id, "VIEWER")).code);
  await redeemWorkspaceInvite(member.id, (await createWorkspaceInvite(owner.id, workspace.id, "MEMBER")).code);
  const client = await prisma.client.create({ data: { workspaceId: workspace.id, name: "Report Client" } });
  const sibling = await prisma.client.create({ data: { workspaceId: workspace.id, name: "Sibling" } });
  const foreignClient = await prisma.client.create({ data: { workspaceId: other.id, name: "Foreign" } });
  const home = await prisma.monitor.create({
    data: { userId: owner.id, workspaceId: workspace.id, clientId: client.id, name: "Home", url: `https://example.com/report-home-${stamp}`, status: "ACTIVE" },
  });
  const shop = await prisma.monitor.create({
    data: { userId: owner.id, workspaceId: workspace.id, clientId: client.id, name: "Shop", url: `https://example.com/report-shop-${stamp}`, status: "ERROR" },
  });
  await prisma.monitor.create({
    data: { userId: owner.id, workspaceId: workspace.id, clientId: sibling.id, name: "Sibling site", url: `https://example.com/report-sibling-${stamp}` },
  });
  await prisma.change.create({
    data: { monitorId: home.id, summary: "Price changed on the homepage", importance: "HIGH", category: "PRICE" },
  });
  await prisma.change.create({
    data: { monitorId: shop.id, summary: "Price changed on the product page", importance: "CRITICAL", category: "PRICE" },
  });
  await prisma.change.create({
    data: {
      monitorId: home.id,
      summary: "Old price",
      importance: "HIGH",
      category: "PRICE",
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    },
  });
  const siblingMonitor = await prisma.monitor.findFirst({ where: { clientId: sibling.id } });
  await prisma.change.create({
    data: { monitorId: siblingMonitor!.id, summary: "Sibling changed", importance: "CRITICAL", category: "CONTENT" },
  });

  await denied("an outsider cannot read the client report", () =>
    buildClientReport(outsider.id, workspace.id, client.id, ReportFrequency.WEEKLY)
  );
  await denied("a client from another workspace is not found", () =>
    buildClientReport(owner.id, workspace.id, foreignClient.id, ReportFrequency.WEEKLY)
  );

  const week = await buildClientReport(viewer.id, workspace.id, client.id, ReportFrequency.WEEKLY);
  assert(
    "the week report keeps this client's sites and folds similar prices",
    week.totalMonitors === 2 &&
      week.monitorsActive === 1 &&
      week.monitorsError === 1 &&
      week.changes.length === 1 &&
      week.changes[0]?.importance === "CRITICAL" &&
      week.changes[0]?.similar === 2 &&
      week.changes.every((item) => !item.summary.includes("Sibling")) &&
      week.brandName === "Report Agency" &&
      week.poweredBy === "Watchflowing" &&
      !JSON.stringify(week).includes("rawHtml")
  );

  const month = await buildClientReport(owner.id, workspace.id, client.id, ReportFrequency.MONTHLY);
  assert(
    "the month report includes the older change and the week report does not",
    month.frequency === "MONTHLY" &&
      month.changes.some((item) => item.summary === "Old price") &&
      week.changes.every((item) => item.summary !== "Old price")
  );

  await denied("a member cannot change the brand", () =>
    updateWorkspaceBrand(member.id, workspace.id, { name: "Stolen", hidePoweredBy: true })
  );
  await updateWorkspaceBrand(owner.id, workspace.id, { name: "North Reports", hidePoweredBy: true });
  const branded = await buildClientReport(viewer.id, workspace.id, client.id, ReportFrequency.WEEKLY);
  assert("the report uses the brand and can hide the credit", branded.brandName === "North Reports" && branded.poweredBy === null);
  const stored = await prisma.workspace.findUnique({ where: { id: workspace.id }, select: { name: true, settings: true } });
  assert("the brand does not rename the workspace", stored?.name === "Report Agency");

  const example = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { workspaceId: true, clientId: true },
  });
  if (example) {
    assert("the pre-existing example monitor was not assigned", example.workspaceId === null && example.clientId === null);
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
