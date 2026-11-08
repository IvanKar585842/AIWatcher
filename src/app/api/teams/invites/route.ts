import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { assertFeature } from "@/lib/plan-guards";
import { withRateLimit } from "@/lib/rate-limit";
import { createTeamInvite } from "@/lib/access/secrets";

export async function POST() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "team-invite",
      async () => {
        assertFeature(user, "TEAM_MEMBERS");
        const team = await prisma.team.findUnique({ where: { ownerId: user.id } });
        if (!team) throw new ApiError("Create a team first", 404);
        const invite = createTeamInvite();
        await prisma.teamInvite.create({
          data: {
            teamId: team.id,
            codeHash: invite.hash,
            expiresAt: invite.expiresAt,
            createdById: user.id,
          },
        });
        return NextResponse.json({
          success: true,
          code: invite.code,
          expiresAt: invite.expiresAt.toISOString(),
        });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
