/**
 * Agency limits reuse the current plans. They do not add Stripe prices.
 *
 * Usage: npx tsx scripts/test-agency-plan-limits.ts
 */
import { PrismaClient } from "@prisma/client";
import { ApiError } from "../src/lib/errors";
import { agencySeatAllowance } from "../src/lib/plan-guards";
import { createWorkspace, createWorkspaceInvite, redeemWorkspaceInvite, assignMonitorToClient } from "../src/lib/workspace-access";

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
    assert(name, error instanceof ApiError && error.status === 403, error instanceof Error ? error.message : "");
  }
}

async function main() {
  const free = { email: "free@watchflowing.localhost", subscription: { plan: "FREE" as const, status: "active" } };
  const business = {
    email: "biz@watchflowing.localhost",
    subscription: { plan: "BUSINESS" as const, status: "active" },
  };
  assert("Free includes one agency seat", agencySeatAllowance(free) === 1);
  assert("Business includes the existing 25 seats", agencySeatAllowance(business) === 25);

  const stamp = Date.now().toString();
  const owner = await prisma.user.create({
    data: { clerkId: `lim-owner-${stamp}`, email: `lim-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  const guest = await prisma.user.create({
    data: { clerkId: `lim-guest-${stamp}`, email: `lim-guest-${stamp}@watchflowing.localhost`, name: "Guest" },
  });
  const workspace = await createWorkspace(owner.id, "Only Agency");
  await denied("a free plan cannot open a second agency", () => createWorkspace(owner.id, "Second Agency"));
  await denied("a free plan cannot add a second seat", () => createWorkspaceInvite(owner.id, workspace.id, "VIEWER"));
  const stillOne = await prisma.workspaceMember.count({ where: { workspaceId: workspace.id } });
  assert("the refused seat was not added", stillOne === 1);

  await prisma.subscription.create({ data: { userId: owner.id, plan: "BUSINESS", status: "active" } });
  const invite = await createWorkspaceInvite(owner.id, workspace.id, "VIEWER");
  await redeemWorkspaceInvite(guest.id, invite.code);
  const seated = await prisma.workspaceMember.count({ where: { workspaceId: workspace.id } });
  assert("Business can add a seat", seated === 2);

  const client = await prisma.client.create({ data: { workspaceId: workspace.id, name: "Cap Client" } });
  await prisma.subscription.update({ where: { userId: owner.id }, data: { plan: "FREE" } });
  for (let index = 0; index < 3; index += 1) {
    const monitor = await prisma.monitor.create({
      data: { userId: owner.id, name: `Site ${index}`, url: `https://example.com/limit-${stamp}-${index}` },
    });
    await assignMonitorToClient(owner.id, workspace.id, client.id, monitor.id);
  }
  const extra = await prisma.monitor.create({
    data: { userId: owner.id, name: "Extra", url: `https://example.com/limit-${stamp}-extra` },
  });
  await denied("a free agency cannot hold a fourth site", () =>
    assignMonitorToClient(owner.id, workspace.id, client.id, extra.id)
  );
  const kept = await prisma.monitor.count({ where: { workspaceId: workspace.id } });
  const extraRow = await prisma.monitor.findUnique({ where: { id: extra.id }, select: { workspaceId: true, clientId: true } });
  assert("the fourth site stayed outside the agency", kept === 3 && extraRow?.workspaceId === null && extraRow.clientId === null);

  const example = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { workspaceId: true, clientId: true },
  });
  if (example) {
    assert("the pre-existing example monitor was not assigned", example.workspaceId === null && example.clientId === null);
  } else {
    console.log("SKIP pre-existing example monitor — not in this database");
  }

  await prisma.user.deleteMany({ where: { id: { in: [owner.id, guest.id] } } });
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
