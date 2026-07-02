import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { processMonitor } from "@/lib/monitoring/processor";
import { withRateLimit } from "@/lib/rate-limit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withRateLimit(`monitor-check-${id}`, async () => {
    try {
      const user = await requireUser();
      const monitor = await prisma.monitor.findFirst({
        where: { id, userId: user.id },
      });

      if (!monitor) {
        return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
      }

      await processMonitor(id);
      return NextResponse.json({ success: true, message: "Check completed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
