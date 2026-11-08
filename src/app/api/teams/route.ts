import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getUserPlanEntitlements } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { assertFeature } from "@/lib/plan-guards";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "team-create",
      async () => {
        assertFeature(user, "TEAM_MEMBERS");
        const body = bodySchema.parse(await parseJsonBody(request));
        const existing = await prisma.team.findUnique({ where: { ownerId: user.id } });
        if (existing) {
          return NextResponse.json({ success: true, team: { id: existing.id, name: existing.name } });
        }
        const team = await prisma.team.create({
          data: {
            name: body.name,
            ownerId: user.id,
            members: { create: { userId: user.id, role: "OWNER" } },
          },
          select: { id: true, name: true },
        });
        return NextResponse.json({ success: true, team }, { status: 201 });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Name the team" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "team-get",
      async () => {
        const membership = await prisma.teamMember.findFirst({
          where: { userId: user.id },
          include: {
            team: {
              include: {
                members: {
                  include: { user: { select: { id: true, email: true, name: true } } },
                },
              },
            },
          },
        });
        if (!membership) return NextResponse.json({ team: null });
        return NextResponse.json({
          team: {
            id: membership.team.id,
            name: membership.team.name,
            role: membership.role,
            limit: getUserPlanEntitlements(user).teamMembers,
            members: membership.team.members.map((member) => ({
              userId: member.user.id,
              email: member.user.email,
              name: member.user.name,
              role: member.role,
            })),
          },
        });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
