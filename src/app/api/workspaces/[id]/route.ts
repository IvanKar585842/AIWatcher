import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { deleteWorkspace, readWorkspace, renameWorkspace } from "@/lib/workspace-access";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
}).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-read-${id}`, async () => {
      const workspace = await readWorkspace(user.id, id);
      return NextResponse.json({ workspace });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-rename-${id}`, async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      const workspace = await renameWorkspace(user.id, id, body.name);
      return NextResponse.json({ workspace });
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Name the workspace" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-delete-${id}`, async () => {
      await deleteWorkspace(user.id, id);
      return NextResponse.json({ success: true });
    }, user.id, "sensitive");
  } catch (error) {
    return apiFailureFromError(error);
  }
}
