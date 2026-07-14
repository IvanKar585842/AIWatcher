import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";
import { getTelegramConfigStatus } from "@/lib/telegram/config";
import { getTelegramBotUsername } from "@/lib/telegram/env";
import { ensureTelegramWebhook, probeTelegramBot } from "@/lib/telegram/setup";

const DEFAULT_BOT_USERNAME = "WatchFlowAlertsBot";

function buildConnectUrl(userId: string, botUsername: string): string {
  return `https://t.me/${botUsername}?start=${userId}`;
}

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "telegram-link",
      async () => {
        const config = getTelegramConfigStatus();
        const probe = await probeTelegramBot();

        // Best-effort: keep Telegram pointing at our webhook when config is ready
        if (config.botConfigured && config.webhookConfigured && config.publicAppUrlConfigured && probe.ok) {
          void ensureTelegramWebhook(false).catch(() => {
            /* logged inside ensure */
          });
        }

        const fresh = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            telegramChatId: true,
            telegramUsername: true,
            telegramConnected: true,
            telegramConnectedAt: true,
            telegramNotificationsEnabled: true,
            emailNotificationsEnabled: true,
            email: true,
          },
        });

        const connected = Boolean(
          fresh?.telegramChatId && (fresh.telegramConnected || fresh.telegramChatId)
        );
        const botUsername =
          probe.username || getTelegramBotUsername() || DEFAULT_BOT_USERNAME;

        let userMessage: string | null = null;
        if (!config.botConfigured) {
          userMessage = "Telegram bot is not configured";
        } else if (!probe.ok) {
          userMessage = probe.error || "Invalid bot configuration";
        } else if (!config.webhookConfigured) {
          userMessage = "Telegram webhook is not configured";
        } else if (!config.publicAppUrlConfigured) {
          userMessage =
            "Webhook URL is not public — set NEXT_PUBLIC_APP_URL to https://watchflowing.com";
        } else if (!connected) {
          userMessage = "Telegram account is not connected";
        }

        const botReady = config.botConfigured && probe.ok;

        return NextResponse.json({
          linked: connected,
          connected,
          telegramUsername: fresh?.telegramUsername ?? null,
          telegramChatId: connected ? fresh?.telegramChatId ?? null : null,
          telegramConnectedAt: fresh?.telegramConnectedAt ?? null,
          telegramNotificationsEnabled: fresh?.telegramNotificationsEnabled ?? true,
          emailNotificationsEnabled: fresh?.emailNotificationsEnabled ?? true,
          email: fresh?.email ?? user.email,
          linkUrl: botReady ? buildConnectUrl(user.id, botUsername) : null,
          botUsername,
          botConfigured: botReady,
          webhookConfigured: config.webhookConfigured,
          publicAppUrlConfigured: config.publicAppUrlConfigured,
          configError: !probe.ok && config.botConfigured
            ? "Invalid bot configuration"
            : config.configError,
          userMessage,
          statusLabel: connected ? "Connected" : "Not connected",
        });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "telegram-prefs",
      async () => {
        const body = (await request.json().catch(() => ({}))) as {
          telegramNotificationsEnabled?: boolean;
          emailNotificationsEnabled?: boolean;
        };

        const data: {
          telegramNotificationsEnabled?: boolean;
          emailNotificationsEnabled?: boolean;
        } = {};

        if (typeof body.telegramNotificationsEnabled === "boolean") {
          data.telegramNotificationsEnabled = body.telegramNotificationsEnabled;
        }
        if (typeof body.emailNotificationsEnabled === "boolean") {
          data.emailNotificationsEnabled = body.emailNotificationsEnabled;
        }

        if (Object.keys(data).length === 0) {
          return NextResponse.json({ error: "No valid fields" }, { status: 400 });
        }

        const updated = await prisma.user.update({
          where: { id: user.id },
          data,
          select: {
            telegramNotificationsEnabled: true,
            emailNotificationsEnabled: true,
            telegramConnected: true,
            telegramUsername: true,
            telegramChatId: true,
          },
        });

        const connected = Boolean(updated.telegramChatId);
        return NextResponse.json({
          success: true,
          ...updated,
          linked: connected,
          connected,
          statusLabel: connected ? "Connected" : "Not connected",
        });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "telegram-unlink",
      async () => {
        const config = getTelegramConfigStatus();
        const botUsername = getTelegramBotUsername() || DEFAULT_BOT_USERNAME;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            telegramChatId: null,
            telegramUsername: null,
            telegramConnected: false,
            telegramConnectedAt: null,
          },
        });
        return NextResponse.json({
          success: true,
          linked: false,
          connected: false,
          statusLabel: "Not connected",
          linkUrl: config.botConfigured
            ? buildConnectUrl(user.id, botUsername)
            : null,
          botConfigured: config.botConfigured,
          webhookConfigured: config.webhookConfigured,
          userMessage: config.botConfigured
            ? "Telegram account is not connected"
            : "Telegram bot is not configured",
        });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
