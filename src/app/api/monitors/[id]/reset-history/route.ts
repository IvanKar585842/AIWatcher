import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    return withRateLimit(
      `monitor-reset-${id}`,
      async () => {
        const existing = await prisma.monitor.findFirst({
          where: { id, userId: user.id },
        });

        if (!existing) {
          return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
        }

        await prisma.$transaction([
          prisma.change.deleteMany({ where: { monitorId: id } }),
          prisma.snapshot.deleteMany({ where: { monitorId: id } }),
          prisma.monitor.update({
            where: { id },
            data: { lastChangedAt: null, errorCount: 0, errorMessage: null },
          }),
        ]);

        return NextResponse.json({ success: true });
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
