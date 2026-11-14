/**
 * Agency alert grouping. Similar client alerts fold. A higher importance still sends.
 *
 * Usage: npx tsx scripts/test-alert-groups.ts
 */
import { NotificationChannel, PrismaClient } from "@prisma/client";
import { shouldSkipDuplicateOutboundAlert } from "../src/lib/notifications/alert-dedupe";
import { alertsLookRelated, groupAgencyProblems, shouldFoldRepeat } from "../src/lib/notifications/alert-group";
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
  assert(
    "the same price story is related",
    alertsLookRelated(
      { summary: "Price changed on the homepage", category: "PRICE" },
      { summary: "Price changed on the product page", category: "PRICE" }
    )
  );
  assert(
    "a different category is not the same story",
    !alertsLookRelated(
      { summary: "Price changed on the homepage", category: "PRICE" },
      { summary: "Price changed on the homepage", category: "CONTENT" }
    )
  );
  assert(
    "a higher importance is not folded",
    !shouldFoldRepeat({ related: true, previousImportance: "HIGH", nextImportance: "CRITICAL" })
  );
  assert(
    "the same importance is folded",
    shouldFoldRepeat({ related: true, previousImportance: "HIGH", nextImportance: "HIGH" })
  );

  const grouped = groupAgencyProblems([
    {
      id: "check",
      name: "Broken",
      summary: null,
      importance: null,
      client: { id: "c1" },
      reason: "check",
      status: "ERROR",
    },
    {
      id: "a",
      name: "Home",
      summary: "Price changed on the homepage",
      importance: "HIGH",
      client: { id: "c1" },
      reason: "change",
      status: "ACTIVE",
    },
    {
      id: "b",
      name: "Shop",
      summary: "Price changed on the product page",
      importance: "CRITICAL",
      client: { id: "c1" },
      reason: "change",
      status: "ACTIVE",
    },
    {
      id: "other",
      name: "Other",
      summary: "Price changed on the homepage",
      importance: "HIGH",
      client: { id: "c2" },
      reason: "change",
      status: "ACTIVE",
    },
  ]);
  assert(
    "similar client alerts become one row and a failing check stays separate",
    grouped.length === 3 &&
      grouped.find((item) => item.id === "b")?.groupCount === 2 &&
      grouped.some((item) => item.reason === "check" && item.groupCount === 1) &&
      grouped.some((item) => item.id === "other" && item.groupCount === 1)
  );

  const stamp = Date.now().toString();
  const owner = await prisma.user.create({
    data: { clerkId: `grp-owner-${stamp}`, email: `grp-owner-${stamp}@watchflowing.localhost`, name: "Owner" },
  });
  const workspace = await createWorkspace(owner.id, "Group Agency");
  const client = await prisma.client.create({ data: { workspaceId: workspace.id, name: "Grouped" } });
  const otherClient = await prisma.client.create({ data: { workspaceId: workspace.id, name: "Separate" } });
  const home = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      clientId: client.id,
      name: "Home",
      url: `https://example.com/group-home-${stamp}`,
    },
  });
  const shop = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      clientId: client.id,
      name: "Shop",
      url: `https://example.com/group-shop-${stamp}`,
    },
  });
  const separate = await prisma.monitor.create({
    data: {
      userId: owner.id,
      workspaceId: workspace.id,
      clientId: otherClient.id,
      name: "Separate",
      url: `https://example.com/group-separate-${stamp}`,
    },
  });
  const first = await prisma.change.create({
    data: { monitorId: home.id, summary: "Price changed on the homepage", importance: "HIGH", category: "PRICE" },
  });
  const second = await prisma.change.create({
    data: { monitorId: shop.id, summary: "Price changed on the product page", importance: "HIGH", category: "PRICE" },
  });
  const escalation = await prisma.change.create({
    data: { monitorId: shop.id, summary: "Price changed on the product page", importance: "CRITICAL", category: "PRICE" },
  });
  const other = await prisma.change.create({
    data: { monitorId: separate.id, summary: "Price changed on the homepage", importance: "HIGH", category: "PRICE" },
  });
  await prisma.notification.create({
    data: { userId: owner.id, changeId: first.id, channel: NotificationChannel.EMAIL, status: "SENT", sentAt: new Date() },
  });

  const folded = await shouldSkipDuplicateOutboundAlert({
    userId: owner.id,
    changeId: second.id,
    monitorId: shop.id,
    channel: NotificationChannel.EMAIL,
    summary: second.summary,
    clientId: client.id,
    category: "PRICE",
    importance: "HIGH",
  });
  assert("a repeat for the same client is not sent again", folded.skip && folded.reason === "client_group");

  const urgent = await shouldSkipDuplicateOutboundAlert({
    userId: owner.id,
    changeId: escalation.id,
    monitorId: shop.id,
    channel: NotificationChannel.EMAIL,
    summary: escalation.summary,
    clientId: client.id,
    category: "PRICE",
    importance: "CRITICAL",
  });
  assert("a more important repeat is still sent", urgent.skip === false);

  const elsewhere = await shouldSkipDuplicateOutboundAlert({
    userId: owner.id,
    changeId: other.id,
    monitorId: separate.id,
    channel: NotificationChannel.EMAIL,
    summary: other.summary,
    clientId: otherClient.id,
    category: "PRICE",
    importance: "HIGH",
  });
  assert("another client is not folded into the first", elsewhere.skip === false);

  const kept = await prisma.change.count({ where: { id: { in: [first.id, second.id, escalation.id] } } });
  assert("folded alerts stay in history", kept === 3);

  const example = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { workspaceId: true, clientId: true },
  });
  if (example) {
    assert("the pre-existing example monitor was not assigned", example.workspaceId === null && example.clientId === null);
  } else {
    console.log("SKIP pre-existing example monitor — not in this database");
  }

  await prisma.user.deleteMany({ where: { id: owner.id } });
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
