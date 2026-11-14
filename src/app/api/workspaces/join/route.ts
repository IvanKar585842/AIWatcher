import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { redeemWorkspaceInvite } from "@/lib/workspace-access";

const bodySchema = z.object({
  code: z.string().trim().min(8).max(120),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit("workspace-join", async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      const joined = await redeemWorkspaceInvite(user.id, body.code);
      return NextResponse.json(joined);
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Enter the invite code" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
