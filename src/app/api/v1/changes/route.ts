import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { requireApiUser } from "@/lib/access/api-auth";
import { withRateLimit } from "@/lib/rate-limit";
import { monitorReadFilter } from "@/lib/security/ownership";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser(request);
    return withRateLimit(
      "v1-changes",
      async () => {
        const changes = await prisma.change.findMany({
          where: { monitor: await monitorReadFilter(user.id) },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            monitorId: true,
            summary: true,
            importance: true,
            category: true,
            bulletPoints: true,
            createdAt: true,
          },
        });
        return NextResponse.json({ changes });
      },
      user.id,
      "api"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
