import { NextRequest, NextResponse } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram/bot";
import { telegramLog } from "@/lib/telegram/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Health / reachability check for the webhook endpoint */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "telegram-webhook",
    configured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
  });
}

export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) {
    telegramLog("webhook_not_configured", {
      reason: "TELEGRAM_WEBHOOK_SECRET missing",
    });
    return NextResponse.json(
      { error: "Telegram webhook is not configured" },
      { status: 503 }
    );
  }

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    telegramLog("webhook_missing_token", { reason: "TELEGRAM_BOT_TOKEN missing" });
    return NextResponse.json(
      { error: "Telegram bot is not configured" },
      { status: 503 }
    );
  }

  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!headerSecret || headerSecret !== secret) {
    telegramLog("webhook_unauthorized", {
      hasHeader: Boolean(headerSecret),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await request.json();
    await handleTelegramUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    telegramLog("webhook_handler_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Acknowledge so Telegram does not retry-spam; error is logged for operators
    return NextResponse.json({ ok: true });
  }
}
