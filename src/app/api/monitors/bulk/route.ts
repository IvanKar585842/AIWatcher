import { NextRequest, NextResponse } from "next/server";
import { MonitorStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bulkSchema = z.object({
  action: z.enum(["pause_all", "resume_all", "export"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "monitors-bulk",
      async () => {
        const body = await parseJsonBody(request);
        const parsed = bulkSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const { action } = parsed.data;

        if (action === "pause_all") {
          const result = await prisma.monitor.updateMany({
            where: { userId: user.id, status: MonitorStatus.ACTIVE },
            data: { status: MonitorStatus.PAUSED },
          });
          return NextResponse.json({ success: true, count: result.count });
        }

        if (action === "resume_all") {
          const result = await prisma.monitor.updateMany({
            where: {
              userId: user.id,
              status: { in: [MonitorStatus.PAUSED, MonitorStatus.ERROR] },
            },
            data: { status: MonitorStatus.ACTIVE, errorCount: 0, errorMessage: null },
          });
          return NextResponse.json({ success: true, count: result.count });
        }

        const monitors = await prisma.monitor.findMany({
          where: { userId: user.id },
          include: {
            _count: { select: { changes: true, snapshots: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
          exportedAt: new Date().toISOString(),
          count: monitors.length,
          monitors,
        });
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
