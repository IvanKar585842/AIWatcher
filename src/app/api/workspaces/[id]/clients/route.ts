import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { createClient, listClients } from "@/lib/workspace-access";

const bodySchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-clients-${id}`, async () => {
      const clients = await listClients(user.id, id);
      return NextResponse.json({ clients });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-client-create-${id}`, async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      const client = await createClient(user.id, id, body.name);
      return NextResponse.json({ client }, { status: 201 });
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Name the client" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
