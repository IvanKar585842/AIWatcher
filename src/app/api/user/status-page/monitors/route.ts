import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailure, apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  monitorId: z.string().min(1),
  statusPageVisible: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "status-monitor-visibility",
      async () => {
        const body = await parseJsonBody(request);
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return apiFailure("Invalid payload", 400);
        }

        const monitor = await prisma.monitor.findFirst({
          where: { id: parsed.data.monitorId, userId: user.id },
          select: { id: true },
        });

        if (!monitor) {
          return NextResponse.json({ success: false, error: "Monitor not found" }, { status: 404 });
        }

        const updated = await prisma.monitor.update({
          where: { id: monitor.id },
          data: { statusPageVisible: parsed.data.statusPageVisible },
          select: { id: true, statusPageVisible: true },
        });

        return apiSuccess({ monitor: updated });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
