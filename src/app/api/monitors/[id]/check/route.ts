import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { processMonitor } from "@/lib/monitoring/processor";
import { processPendingAnalyses } from "@/lib/monitoring/ai-processor";
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

        try {
          const result = await processMonitor(id);
          if (result.status === "change_detected") {
            await processPendingAnalyses(1);
          }
          return NextResponse.json({
            success: true,
            message: "Check completed",
            result,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Check failed";
          return NextResponse.json({ success: false, error: message }, { status: 500 });
        }
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
