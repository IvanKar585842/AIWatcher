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
    console.error("[cron/chat-cleanup] failed", error);
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
