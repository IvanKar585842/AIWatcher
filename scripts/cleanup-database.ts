/**
 * Removes invalid monitor records before schema migrations.
 *
 * - Deletes monitors whose userId no longer exists
 * - Deletes duplicate monitors (same userId + url), keeping the oldest
 * - Deletes orphaned MonitorQueue rows
 *
 * Usage: npm run db:cleanup
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database cleanup...\n");

  const users = await prisma.user.findMany({ select: { id: true } });
  const validUserIds = new Set(users.map((u) => u.id));

  const allMonitors = await prisma.monitor.findMany({
    select: { id: true, userId: true, url: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const orphaned = allMonitors.filter((m) => !validUserIds.has(m.userId));
  if (orphaned.length > 0) {
    console.log(`Removing ${orphaned.length} orphaned monitor(s) (missing user)...`);
    await prisma.monitor.deleteMany({
      where: { id: { in: orphaned.map((m) => m.id) } },
    });
  } else {
    console.log("No orphaned monitors found.");
  }

  const remaining = allMonitors.filter((m) => validUserIds.has(m.userId));
  const seen = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const monitor of remaining) {
    const key = `${monitor.userId}::${monitor.url}`;
    if (seen.has(key)) {
      duplicateIds.push(monitor.id);
    } else {
      seen.set(key, monitor.id);
    }
  }

  if (duplicateIds.length > 0) {
    console.log(`Removing ${duplicateIds.length} duplicate monitor(s)...`);
    await prisma.monitor.deleteMany({
      where: { id: { in: duplicateIds } },
    });
  } else {
    console.log("No duplicate monitors found.");
  }

  const monitorIds = new Set(
    (await prisma.monitor.findMany({ select: { id: true } })).map((m) => m.id)
  );

  const queueRows = await prisma.monitorQueue.findMany({ select: { id: true, monitorId: true } });
  const orphanedQueue = queueRows.filter((q) => !monitorIds.has(q.monitorId));

  if (orphanedQueue.length > 0) {
    console.log(`Removing ${orphanedQueue.length} orphaned queue row(s)...`);
    await prisma.monitorQueue.deleteMany({
      where: { id: { in: orphanedQueue.map((q) => q.id) } },
    });
  } else {
    console.log("No orphaned queue rows found.");
  }

  const invalidMonitors = remaining.filter(
    (m) => !m.url?.trim() || !m.name?.trim()
  );
  if (invalidMonitors.length > 0) {
    console.log(`Removing ${invalidMonitors.length} monitor(s) with empty url or name...`);
    await prisma.monitor.deleteMany({
      where: { id: { in: invalidMonitors.map((m) => m.id) } },
    });
  }

  const finalCount = await prisma.monitor.count();
  console.log(`\nCleanup complete. ${finalCount} valid monitor(s) remain.`);
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
