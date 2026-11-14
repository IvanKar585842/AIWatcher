import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { assignMonitorToClient } from "@/lib/workspace-access";

const bodySchema = z.object({ monitorId: z.string().trim().min(1).max(80) }).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clientId: string }> }
) {
  const { id, clientId } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-client-assign-${clientId}`, async () => {
      const body = bodySchema.parse(await parseJsonBody(request));
      const monitor = await assignMonitorToClient(user.id, id, clientId, body.monitorId);
      return NextResponse.json({ monitor });
    }, user.id, "sensitive");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Choose a monitor" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
