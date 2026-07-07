import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { processMonitor } from "@/lib/monitoring/processor";
import { withRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    return withRateLimit(
      `monitor-check-${id}`,
      async () => {
        const monitor = await prisma.monitor.findFirst({
          where: { id, userId: user.id },
        });

        if (!monitor) {
          return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
        }

        await processMonitor(id);
        return NextResponse.json({ success: true, message: "Check completed" });
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
