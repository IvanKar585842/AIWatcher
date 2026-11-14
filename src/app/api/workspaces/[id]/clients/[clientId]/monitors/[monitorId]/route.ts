import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { unassignMonitorFromClient } from "@/lib/workspace-access";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; clientId: string; monitorId: string }> }
) {
  const { id, clientId, monitorId } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-client-unassign-${monitorId}`, async () => {
      await unassignMonitorFromClient(user.id, id, clientId, monitorId);
      return NextResponse.json({ success: true });
    }, user.id, "sensitive");
  } catch (error) {
    return apiFailureFromError(error);
  }
}
