import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { apiErrorResponse } from "@/lib/api-response";
import {
  getTelegramConfigStatus,
  getTelegramWebhookUrl,
  telegramLog,
} from "@/lib/telegram/config";
import { ensureTelegramWebhook, probeTelegramBot } from "@/lib/telegram/setup";
import { getTelegramWebhookInfo } from "@/lib/notifications/telegram";

/**
 * Register or refresh the Telegram webhook.
 * Auth: Bearer CRON_SECRET, or signed-in admin.
 */
async function authorizeSetup(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return true;
  }
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await authorizeSetup(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = getTelegramConfigStatus();
    const probe = await probeTelegramBot();
    const webhookUrl = getTelegramWebhookUrl();
    let webhookInfo: unknown = null;
    if (config.botConfigured && probe.ok) {
      const info = await getTelegramWebhookInfo();
      webhookInfo = info.ok ? info.data : { error: info.error };
    }

    return NextResponse.json({
      config,
      bot: {
        ok: probe.ok,
        username: probe.username,
        error: probe.error,
      },
      expectedWebhookUrl: webhookUrl,
      webhookInfo,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await authorizeSetup(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const force =
      request.nextUrl.searchParams.get("force") === "1" ||
      ((await request.json().catch(() => ({}))) as { force?: boolean }).force === true;

    const result = await ensureTelegramWebhook(force);
    telegramLog("setup_endpoint", {
      ok: result.ok,
      error: result.error,
      url: result.url,
    });

    return NextResponse.json(
      {
        success: result.ok,
        ...result,
        message: result.ok
          ? "Telegram webhook configured"
          : result.error || "Webhook setup failed",
      },
      { status: result.ok ? 200 : 503 }
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
