import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram/bot";

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }

  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await request.json();
    await handleTelegramUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
