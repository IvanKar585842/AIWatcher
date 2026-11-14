import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { listClientsForMonitorCreate } from "@/lib/workspace-access";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit("workspace-monitor-clients", async () => {
      const clients = await listClientsForMonitorCreate(user.id);
      return NextResponse.json({ clients });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}
