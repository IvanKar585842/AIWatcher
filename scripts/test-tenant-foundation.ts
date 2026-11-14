/**
 * Workspace and Client foundation. Does not assign existing monitors.
 *
 * Usage: npx tsx scripts/test-tenant-foundation.ts
 */
import { PrismaClient } from "@prisma/client";
import { monitorTenancyError } from "../src/lib/tenancy";

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
    "a client from another workspace is rejected by the rule",
    monitorTenancyError({
      workspaceId: "ws-a",
      clientId: "client-b",
      clientWorkspaceId: "ws-b",
    }) === "monitor client belongs to another workspace"
  );
  assert(
    "a matching client is accepted",
    monitorTenancyError({
      workspaceId: "ws-a",
      clientId: "client-a",
      clientWorkspaceId: "ws-a",
    }) === null
  );
  assert(
    "a monitor without a client stays valid",
    monitorTenancyError({ workspaceId: null, clientId: null, clientWorkspaceId: null }) === null
  );

  const stamp = Date.now().toString();
  const user = await prisma.user.create({
    data: {
      clerkId: `tenant-test-${stamp}`,
      email: `tenant-test-${stamp}@watchflowing.localhost`,
      name: "Tenant test",
    },
  });

  const rawId = `raw-${stamp}`;
  await prisma.$executeRaw`
    INSERT INTO "Monitor" ("id", "userId", "name", "url", "updatedAt")
    VALUES (${rawId}, ${user.id}, 'Old writer', ${`https://example.com/raw-${stamp}`}, NOW())
  `;
  const raw = await prisma.monitor.findUnique({ where: { id: rawId } });
  assert(
    "an insert that omits tenancy columns succeeds",
    raw?.workspaceId === null && raw.clientId === null
  );

  const legacy = await prisma.monitor.create({
    data: {
      userId: user.id,
      name: "Legacy",
      url: `https://example.com/legacy-${stamp}`,
    },
  });
  assert("a new monitor can omit workspace and client", legacy.workspaceId === null && legacy.clientId === null);
  assert("userId is still the owner", legacy.userId === user.id);

  const workspace = await prisma.workspace.create({
    data: { name: "North Agency", ownerId: user.id },
  });
  const client = await prisma.client.create({
    data: { name: "Acme", workspaceId: workspace.id },
  });
  assert("a client belongs to its workspace", client.workspaceId === workspace.id);

  const linked = await prisma.monitor.update({
    where: { id: legacy.id },
    data: { workspaceId: workspace.id, clientId: client.id },
  });
  assert("a monitor can be linked to its own client", linked.workspaceId === workspace.id && linked.clientId === client.id);

  const other = await prisma.workspace.create({
    data: {
      name: "Other Agency",
      ownerId: user.id,
      clients: { create: { name: "Other Client" } },
    },
    include: { clients: true },
  });
  let crossTenantRejected = false;
  try {
    await prisma.monitor.update({
      where: { id: legacy.id },
      data: { clientId: other.clients[0].id },
    });
  } catch (error) {
    crossTenantRejected = error instanceof Error && error.message.includes("another workspace");
  }
  assert("a monitor cannot point at another workspace client", crossTenantRejected);

  let clientWithoutWorkspaceRejected = false;
  try {
    await prisma.monitor.update({
      where: { id: legacy.id },
      data: { workspaceId: null, clientId: client.id },
    });
  } catch (error) {
    clientWithoutWorkspaceRejected = error instanceof Error;
  }
  assert("a client link without a workspace is rejected", clientWithoutWorkspaceRejected);

  let movedWorkspaceRejected = false;
  try {
    await prisma.monitor.update({
      where: { id: legacy.id },
      data: { workspaceId: other.id },
    });
  } catch (error) {
    movedWorkspaceRejected =
      error instanceof Error && error.message.includes("another workspace");
  }
  assert("workspace cannot move away from the linked client", movedWorkspaceRejected);

  const unchanged = await prisma.monitor.findUniqueOrThrow({ where: { id: legacy.id } });
  assert("the rejected update did not change the link", unchanged.clientId === client.id);

  await prisma.client.delete({ where: { id: client.id } });
  const afterClientDelete = await prisma.monitor.findUniqueOrThrow({ where: { id: legacy.id } });
  assert(
    "deleting a client keeps the monitor and its workspace",
    afterClientDelete.clientId === null && afterClientDelete.workspaceId === workspace.id
  );

  const parked = await prisma.monitor.create({
    data: {
      userId: user.id,
      name: "Parked",
      url: `https://example.com/parked-${stamp}`,
      workspaceId: other.id,
      clientId: other.clients[0].id,
      snapshots: {
        create: {
          rawHtml: "<p>kept</p>",
          cleanedHtml: "<p>kept</p>",
          contentHash: `hash-${stamp}`,
          extractedText: "kept",
        },
      },
      changes: {
        create: {
          summary: "kept change",
        },
      },
    },
  });
  await prisma.workspace.delete({ where: { id: other.id } });
  const survived = await prisma.monitor.findUnique({
    where: { id: parked.id },
    include: { snapshots: true, changes: true },
  });
  assert(
    "deleting a workspace keeps the monitor and clears tenancy",
    survived?.id === parked.id && survived.workspaceId === null && survived.clientId === null
  );
  assert(
    "deleting a workspace keeps snapshots and change history",
    survived?.snapshots.length === 1 && survived.changes.length === 1
  );
  let secondDeleteRejected = false;
  try {
    await prisma.workspace.delete({ where: { id: other.id } });
  } catch {
    secondDeleteRejected = true;
  }
  const stillThere = await prisma.monitor.findUnique({ where: { id: parked.id } });
  assert("a second workspace delete does not remove the monitor", secondDeleteRejected && stillThere?.id === parked.id);
  const goneClient = await prisma.client.findUnique({ where: { id: other.clients[0].id } });
  assert("clients of a deleted workspace are removed", goneClient === null);

  const existing = await prisma.monitor.findFirst({
    where: { url: "https://example.com" },
    select: { id: true, userId: true, workspaceId: true, clientId: true },
  });
  if (existing) {
    assert(
      "the pre-existing example monitor was not assigned a workspace",
      existing.workspaceId === null && existing.clientId === null && existing.userId.length > 0
    );
  } else {
    console.log("SKIP pre-existing example monitor — not in this database");
  }

  const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE tablename IN ('Monitor', 'Client', 'Workspace')
      AND indexname IN (
        'Monitor_workspaceId_idx',
        'Monitor_clientId_idx',
        'Client_workspaceId_idx',
        'Workspace_ownerId_idx'
      )
  `;
  assert("tenancy indexes exist", indexes.length === 4, indexes.map((row) => row.indexname).join(","));

  const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
    SELECT conname FROM pg_constraint
    WHERE conname IN (
      'Monitor_client_requires_workspace',
      'Monitor_clientId_fkey',
      'Monitor_workspaceId_fkey',
      'Workspace_ownerId_fkey',
      'Client_workspaceId_fkey'
    )
  `;
  assert("tenancy foreign keys and check exist", constraints.length === 5, String(constraints.length));
  const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
    SELECT tgname FROM pg_trigger
    WHERE tgname IN ('monitor_tenant_guard', 'client_workspace_immutable', 'workspace_detach_monitors')
      AND NOT tgisinternal
  `;
  assert("tenancy triggers exist", triggers.length === 3, String(triggers.length));

  await prisma.user.delete({ where: { id: user.id } });
  const leftover = await prisma.monitor.findUnique({ where: { id: legacy.id } });
  assert("deleting the test user removes that user's monitor", leftover === null);
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
