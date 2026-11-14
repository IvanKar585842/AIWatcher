/**
 * Home summary counts only the caller's agencies.
 *
 * Usage: npx tsx scripts/test-workspace-summary.ts
 */
import { PrismaClient } from "@prisma/client";
import { workspaceHomeSummary } from "../src/lib/workspace-access";
import { createWorkspace } from "../src/lib/workspace-access";

const prisma = new PrismaClient();

function assert(name: string, condition: boolean, detail = "") {
  if (!condition) {
    console.error("FAIL", name, detail);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

async function main() {
  const stamp = Date.now().toString();
  const owner = await prisma.user.create({
    data: { clerkId: `sum-owner-${stamp}`, email: `sum-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  const outsider = await prisma.user.create({
    data: { clerkId: `sum-out-${stamp}`, email: `sum-out-${stamp}@watchflowing.localhost`, name: "Outsider" },
  });
  await prisma.subscription.create({ data: { userId: owner.id, plan: "BUSINESS", status: "active" } });
  const workspace = await createWorkspace(owner.id, "Summary Agency");
  const client = await prisma.client.create({ data: { workspaceId: workspace.id, name: "Summary Client" } });
  const monitor = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      clientId: client.id,
      name: "Summary site",
      url: `https://example.com/summary-${stamp}`,
      status: "ERROR",
      errorCount: 2,
    },
  });
  const quiet = await prisma.monitor.create({
    data: {
      userId: owner.id,
      name: "Not in agency",
      url: `https://example.com/summary-quiet-${stamp}`,
    },
  });

  const cards = await workspaceHomeSummary(owner.id);
  const card = cards.find((item) => item.id === workspace.id);
  assert(
    "the home summary counts this agency's client, site, and problem",
    card?.clients === 1 && card.sites === 1 && card.problems === 1 && card.role === "OWNER"
  );
  const outsiderCards = await workspaceHomeSummary(outsider.id);
  assert("another user does not see this agency", outsiderCards.every((item) => item.id !== workspace.id));
  assert("a monitor outside the agency is not counted as a site", card?.sites === 1 && quiet.workspaceId === null);

  const example = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { workspaceId: true, clientId: true },
  });
  if (example) {
    assert("the pre-existing example monitor was not assigned", example.workspaceId === null && example.clientId === null);
  } else {
    console.log("SKIP pre-existing example monitor — not in this database");
  }

  await prisma.user.deleteMany({ where: { id: { in: [owner.id, outsider.id] } } });
  void monitor;
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
