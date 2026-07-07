/**
 * Verifies monitor CRUD against the database.
 * Usage: npx tsx scripts/verify-monitor-crud.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ include: { subscription: true } });
  if (!user) {
    console.log("No users in database — create an account via the app first.");
    return;
  }

  console.log(`Testing with user ${user.email} (${user.id})`);

  const testUrl = `https://example.com/verify-${Date.now()}`;

  const created = await prisma.monitor.create({
    data: {
      userId: user.id,
      name: "CRUD Verify Monitor",
      url: testUrl,
      description: "Temporary verification record",
      category: "Other",
      tags: ["verify"],
      aiPrompt: null,
      config: { monitorTypeId: "entire-website" },
      mode: "ENTIRE_PAGE",
      keywords: [],
      interval: "TWELVE_HOURS",
      notificationMethod: "EMAIL",
      nextCheckAt: new Date(),
    },
  });
  console.log("✓ CREATE", created.id);

  const loaded = await prisma.monitor.findUnique({
    where: { id: created.id },
    include: { _count: { select: { changes: true } } },
  });
  if (!loaded) throw new Error("Monitor not found after create");
  console.log("✓ READ", loaded.name);

  const listed = await prisma.monitor.findMany({ where: { userId: user.id } });
  console.log(`✓ LIST (${listed.length} monitor(s))`);

  await prisma.monitor.delete({ where: { id: created.id } });
  console.log("✓ DELETE");

  const afterDelete = await prisma.monitor.findUnique({ where: { id: created.id } });
  if (afterDelete) throw new Error("Monitor still exists after delete");
  console.log("\nAll database operations passed.");
}

main()
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
