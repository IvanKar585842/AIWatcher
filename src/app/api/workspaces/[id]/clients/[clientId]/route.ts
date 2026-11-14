import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { deleteClient, getClientDetail, renameClient } from "@/lib/workspace-access";

const bodySchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; clientId: string }> }
) {
  const { id, clientId } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-client-${clientId}`, async () => {
      const client = await getClientDetail(user.id, id, clientId);
      return NextResponse.json({ client });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clientId: string }> }
) {
  const { id, clientId } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-client-rename-${clientId}`, async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      const client = await renameClient(user.id, id, clientId, body.name);
      return NextResponse.json({ client });
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Name the client" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; clientId: string }> }
) {
  const { id, clientId } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-client-delete-${clientId}`, async () => {
      await deleteClient(user.id, id, clientId);
      return NextResponse.json({ success: true });
    }, user.id, "sensitive");
  } catch (error) {
    return apiFailureFromError(error);
  }
}
