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
      "v1-monitors",
      async () => {
        const monitors = await prisma.monitor.findMany({
          where: await monitorReadFilter(user.id),
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            name: true,
            url: true,
            status: true,
            interval: true,
            mode: true,
            lastCheckedAt: true,
            nextCheckAt: true,
            lastChangedAt: true,
          },
        });
        return NextResponse.json({ monitors });
      },
      user.id,
      "api"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
