import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getUserPlanEntitlements } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { hashSecret, inviteIsOpen, teamHasRoom } from "@/lib/access/secrets";
import { z } from "zod";

const bodySchema = z.object({
  code: z.string().trim().min(8).max(120),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "team-join",
      async () => {
        const body = bodySchema.parse(await parseJsonBody(request));
        const invite = await prisma.teamInvite.findUnique({
          where: { codeHash: hashSecret(body.code) },
          include: {
            team: {
              include: {
                owner: { include: { subscription: true } },
                _count: { select: { members: true } },
              },
            },
          },
        });
        if (!invite || !inviteIsOpen(invite)) {
          throw new ApiError("This invite is invalid or expired", 400);
        }
        const existing = await prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
        });
        if (existing) return NextResponse.json({ success: true, alreadyJoined: true });

        const limit = getUserPlanEntitlements(invite.team.owner).teamMembers;
        if (!teamHasRoom(invite.team._count.members, limit)) {
          throw new ApiError("This team is full", 403);
        }
        await prisma.$transaction([
          prisma.teamMember.create({
            data: { teamId: invite.teamId, userId: user.id, role: "MEMBER" },
          }),
          prisma.teamInvite.update({
            where: { id: invite.id },
            data: { acceptedAt: new Date(), acceptedById: user.id },
          }),
        ]);
        return NextResponse.json({ success: true, teamId: invite.teamId });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Enter the invite code" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
