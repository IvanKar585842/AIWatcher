import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { assertFeature } from "@/lib/plan-guards";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  enabled: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "team-share",
      async () => {
        assertFeature(user, "TEAM_MEMBERS");
        const body = bodySchema.parse(await parseJsonBody(request));
        const team = await prisma.team.findUnique({ where: { ownerId: user.id } });
        if (!team) throw new ApiError("Create a team first", 404);
        const result = body.enabled
          ? await prisma.monitor.updateMany({
              where: { userId: user.id },
              data: { teamId: team.id },
            })
          : await prisma.monitor.updateMany({
              where: { userId: user.id, teamId: team.id },
              data: { teamId: null },
            });
        return NextResponse.json({ success: true, updated: result.count });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Choose whether sharing is on" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
