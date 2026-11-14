import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { createWorkspaceInvite } from "@/lib/workspace-access";

const bodySchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-invite-${id}`, async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      const invite = await createWorkspaceInvite(user.id, id, body.role);
      return NextResponse.json(invite);
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Choose a role" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
