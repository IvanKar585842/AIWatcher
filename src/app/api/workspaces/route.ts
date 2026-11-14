import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { createWorkspace, listWorkspaces } from "@/lib/workspace-access";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit("workspaces-list", async () => {
      const workspaces = await listWorkspaces(user.id);
      return NextResponse.json({ workspaces });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit("workspaces-create", async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      const workspace = await createWorkspace(user.id, body.name);
      return NextResponse.json({ workspace }, { status: 201 });
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Name the workspace" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
