const TELEGRAM_API = "https://api.telegram.org/bot";

export type TelegramSendResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; blocked?: boolean; invalidChat?: boolean };

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

async function telegramRequest(
  method: string,
  body: Record<string, unknown>
): Promise<TelegramSendResult> {
  try {
    const response = await fetch(`${TELEGRAM_API}${getBotToken()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      ok?: boolean;
      description?: string;
      error_code?: number;
    };

    if (!data.ok) {
      const description = data.description ?? "Telegram API error";
      const blocked =
        data.error_code === 403 ||
        /blocked|forbidden|deactivated/i.test(description);
      const invalidChat =
        data.error_code === 400 ||
        /chat not found|invalid chat/i.test(description);

      return { ok: false, error: description, blocked, invalidChat };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Telegram request failed",
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
    return { ok: false, error: "Invalid chat ID", invalidChat: true };
  }

  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text: message,
    parse_mode: options?.parseMode ?? "HTML",
    disable_web_page_preview: options?.disableWebPagePreview ?? true,
    ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
  });
}

/** @deprecated Prefer sendTelegramNotification — kept for bot command handlers. */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode = "HTML"
) {
  const result = await sendTelegramNotification(chatId, text, { parseMode });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
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
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export async function sendTelegramChangeNotification(
  params: ChangeNotificationParams
): Promise<TelegramSendResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardUrl = params.changeId
    ? `${appUrl}/dashboard/changes/${params.changeId}`
    : `${appUrl}/dashboard`;
  const hostname = getHostname(params.url);
  const changeLine =
    params.bulletPoints[0]?.trim() ||
    params.summary.split(/[.!?]/)[0]?.trim() ||
    "A meaningful page change was detected.";
  const recommendation =
    params.recommendedAction?.trim() ||
    (params.importance === "HIGH" || params.importance === "CRITICAL"
      ? "Open the full analysis and decide next steps."
      : "Review when convenient.");

  const text = [
    `🚨 <b>WatchFlow Alert</b>`,
    ``,
    `<b>Website:</b>`,
    escapeHtml(hostname),
    ``,
    `<b>Change detected:</b>`,
    escapeHtml(changeLine),
    ``,
    `<b>AI Analysis:</b>`,
    `"${escapeHtml(params.summary)}"`,
    ``,
    `<b>Importance:</b>`,
    escapeHtml(params.importance),
    ``,
    `<b>Recommended action:</b>`,
    escapeHtml(recommendation),
  ].join("\n");

  return sendTelegramNotification(params.chatId, text, {
    parseMode: "HTML",
    disableWebPagePreview: true,
    replyMarkup: {
      inline_keyboard: [[{ text: "Open Dashboard", url: dashboardUrl }]],
    },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function setTelegramWebhook(url: string, secretToken?: string) {
  return telegramRequest("setWebhook", {
    url,
    ...(secretToken ? { secret_token: secretToken } : {}),
  });
}

export async function getTelegramBotInfo() {
  return telegramRequest("getMe", {});
}
