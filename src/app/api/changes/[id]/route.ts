import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/errors";
import { readStoredHtml } from "@/lib/monitoring/snapshot-store";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    return withRateLimit(
      `change-get-${id}`,
      async () => {
        const change = await prisma.change.findFirst({
          where: {
            id,
            monitor: { userId: user.id },
          },
          include: {
            monitor: true,
            notifications: true,
          },
        });

        if (!change) {
          return NextResponse.json({ error: "Change not found" }, { status: 404 });
        }

        const [oldHtml, newHtml] = await Promise.all([
          readStoredHtml(change.oldHtml),
          readStoredHtml(change.newHtml),
        ]);

        return NextResponse.json({
          change: {
            ...change,
            oldHtml,
            newHtml,
          },
        });
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
