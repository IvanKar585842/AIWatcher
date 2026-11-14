import { telegramLog } from "@/lib/telegram/config";
import { getTelegramBotToken } from "@/lib/telegram/env";
import { escapeHtml } from "@/lib/security/html";

const TELEGRAM_API = "https://api.telegram.org/bot";

export type TelegramSendResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; blocked?: boolean; invalidChat?: boolean };

function getBotToken(): string {
  const token = getTelegramBotToken();
  if (!token) {
    telegramLog("config_missing", { reason: "TELEGRAM_BOT_TOKEN missing" });
    throw new Error("Missing token");
  }
  return token;
}

async function telegramRequest(
  method: string,
  body?: Record<string, unknown>
): Promise<TelegramSendResult> {
  try {
    const token = getBotToken();
    const response = await fetch(`${TELEGRAM_API}${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });

    const data = (await response.json()) as {
      ok?: boolean;
      description?: string;
      error_code?: number;
      result?: unknown;
    };

    if (!data.ok) {
      const description = data.description ?? "Telegram API error";
      const blocked =
        data.error_code === 403 ||
        /blocked|forbidden|deactivated/i.test(description);
      const invalidChat =
        data.error_code === 400 ||
        /chat not found|invalid chat/i.test(description);

      telegramLog("api_error", {
        method,
        errorCode: data.error_code,
        description,
        blocked,
        invalidChat,
      });

      return { ok: false, error: description, blocked, invalidChat };
    }

    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram request failed";
    telegramLog("request_failed", { method, error: message });
    return {
      ok: false,
      error: message === "Missing token"
        ? "Telegram bot is not configured"
        : "Unable to send Telegram notification",
    };
  }
}

/** Low-level send — never throws for API/blocked/invalid chat failures. */
export async function sendTelegramNotification(
  chatId: string,
  message: string,
  options?: {
    parseMode?: string;
    replyMarkup?: Record<string, unknown>;
    disableWebPagePreview?: boolean;
  }
): Promise<TelegramSendResult> {
  if (!chatId?.trim()) {
    return { ok: false, error: "Telegram account is not connected", invalidChat: true };
  }

  if (!getTelegramBotToken()) {
    telegramLog("send_skipped", { reason: "Missing token" });
    return { ok: false, error: "Telegram bot is not configured" };
  }

  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text: message,
    parse_mode: options?.parseMode ?? "HTML",
    disable_web_page_preview: options?.disableWebPagePreview ?? true,
    ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  });
}

/** Bot command helper — logs failures instead of crashing the webhook. */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode = "HTML"
): Promise<TelegramSendResult> {
  const result = await sendTelegramNotification(chatId, text, { parseMode });
  if (!result.ok) {
    telegramLog("message_send_failed", {
      chatId,
      error: result.error,
    });
  }
  return result;
}

interface ChangeNotificationParams {
  chatId: string;
  monitorName: string;
  url: string;
  summary: string;
  emoji: string;
  bulletPoints: string[];
  importance: string;
  category?: string;
  recommendedAction?: string;
  changeId?: string;
  appeared?: string[];
  disappeared?: string[];
}

export async function sendTelegramChangeNotification(
  params: ChangeNotificationParams
): Promise<TelegramSendResult> {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://watchflowing.com"
  ).replace(/\/$/, "");
  const dashboardUrl = `${appUrl}/dashboard`;
  const changeDetailUrl = params.changeId
    ? `${appUrl}/dashboard/changes/${params.changeId}`
    : dashboardUrl;

  const lines = (label: string, items: string[] | undefined) => {
    const kept = (items ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 3);
    if (kept.length === 0) return [];
    return ["", `<b>${label}</b>`, ...kept.map((item) => `• ${escapeHtml(item)}`)];
  };

  const text = [
    `🚨 <b>WatchFlowing</b>`,
    ``,
    `<b>${escapeHtml(params.monitorName)}</b>`,
    ``,
    escapeHtml(params.summary || "Something changed on your site."),
    ...lines("What changed", params.bulletPoints),
    ...lines("What appeared", params.appeared),
    ...lines("What disappeared", params.disappeared),
    ...(params.recommendedAction?.trim()
      ? ["", `<b>Next</b>`, escapeHtml(params.recommendedAction.trim())]
      : []),
  ].join("\n");

  return sendTelegramNotification(params.chatId, text, {
    parseMode: "HTML",
    disableWebPagePreview: true,
    replyMarkup: {
      inline_keyboard: [[{ text: "Open Dashboard", url: changeDetailUrl }]],
    },
  });
}

export async function setTelegramWebhook(url: string, secretToken?: string) {
  return telegramRequest("setWebhook", {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: false,
    ...(secretToken ? { secret_token: secretToken } : {}),
  });
}

export async function getTelegramBotInfo() {
  return telegramRequest("getMe");
}

export async function getTelegramWebhookInfo() {
  return telegramRequest("getWebhookInfo");
}

export async function deleteTelegramWebhook() {
  return telegramRequest("deleteWebhook", { drop_pending_updates: false });
}

/** Long-poll Bot API. Used by the local worker when no public HTTPS webhook exists. */
export async function getTelegramUpdates(offset?: number, timeoutSeconds = 20) {
  return telegramRequest("getUpdates", {
    timeout: timeoutSeconds,
    allowed_updates: ["message"],
    ...(offset != null ? { offset } : {}),
  });
}
