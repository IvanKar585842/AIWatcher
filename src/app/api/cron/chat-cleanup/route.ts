import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { cleanupOldChatConversations } from "@/lib/chat/cleanup";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    const deleted = await cleanupOldChatConversations();
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
