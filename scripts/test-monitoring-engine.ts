/**
 * Smoke test for the monitoring engine pipeline.
 * Usage: npx tsx scripts/test-monitoring-engine.ts [monitorId]
 */
import { PrismaClient } from "@prisma/client";
import { processMonitor } from "../src/lib/monitoring/processor";
import { processPendingAnalyses } from "../src/lib/monitoring/ai-processor";

const prisma = new PrismaClient();

async function main() {
  const monitorId = process.argv[2];

  if (monitorId) {
    console.log(`Processing monitor ${monitorId}...`);
    await processMonitor(monitorId);
  } else {
    const monitor = await prisma.monitor.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    if (!monitor) {
      console.log("No active monitors found.");
      return;
    }

    console.log(`Processing monitor ${monitor.name} (${monitor.id})...`);
    await processMonitor(monitor.id);
  }

  const analyses = await processPendingAnalyses(5);
  console.log(`AI analyses processed: ${analyses}`);

  const latest = await prisma.snapshot.findFirst({
    orderBy: { createdAt: "desc" },
    include: { monitor: { select: { name: true, lastCheckedAt: true } } },
  });

  if (latest) {
    console.log(`Latest snapshot for "${latest.monitor.name}"`);
    console.log(`  Hash: ${latest.contentHash.slice(0, 16)}...`);
    console.log(`  Last checked: ${latest.monitor.lastCheckedAt?.toISOString() ?? "—"}`);
  }
}

main()
  .catch((error) => {
    console.error("Monitoring engine test failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
