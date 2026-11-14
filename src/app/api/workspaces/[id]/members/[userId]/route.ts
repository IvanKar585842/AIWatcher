import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { removeMember, setMemberRole } from "@/lib/workspace-access";

const bodySchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId: targetUserId } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-role-${id}-${targetUserId}`, async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      const member = await setMemberRole(user.id, id, targetUserId, body.role);
      return NextResponse.json({ member });
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Choose a role" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId: targetUserId } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-remove-${id}-${targetUserId}`, async () => {
      await removeMember(user.id, id, targetUserId);
      return NextResponse.json({ success: true });
    }, user.id, "sensitive");
  } catch (error) {
    return apiFailureFromError(error);
  }
}
