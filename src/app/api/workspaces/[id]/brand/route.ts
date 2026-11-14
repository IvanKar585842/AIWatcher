import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { readWorkspaceBrandForUser, updateWorkspaceBrand } from "@/lib/workspace-access";

const bodySchema = z.object({
  name: z.string().trim().max(80),
  hidePoweredBy: z.boolean(),
}).strict();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-brand-${id}`, async () => {
      const brand = await readWorkspaceBrandForUser(user.id, id);
      return NextResponse.json({ brand });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-brand-save-${id}`, async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      const brand = await updateWorkspaceBrand(user.id, id, body);
      return NextResponse.json({ brand });
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Name the brand" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
