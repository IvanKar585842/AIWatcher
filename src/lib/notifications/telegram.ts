const TELEGRAM_API = "https://api.telegram.org/bot";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

async function telegramRequest(method: string, body: Record<string, unknown>) {
  const response = await fetch(`${TELEGRAM_API}${getBotToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description ?? "Telegram API error");
  }
  return data;
}

export async function sendTelegramMessage(chatId: string, text: string, parseMode = "HTML") {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: false,
  });
}

interface ChangeNotificationParams {
  chatId: string;
  monitorName: string;
  url: string;
  summary: string;
  emoji: string;
  bulletPoints: string[];
  importance: string;
}

export async function sendTelegramChangeNotification(params: ChangeNotificationParams) {
  const bullets =
    params.bulletPoints.length > 0
      ? "\n\n<b>Key changes:</b>\n" +
        params.bulletPoints.map((bp) => `• ${escapeHtml(bp)}`).join("\n")
      : "";

  const text = [
    `${params.emoji} <b>Change Detected</b>`,
    ``,
    `<b>Monitor:</b> ${escapeHtml(params.monitorName)}`,
    `<b>Importance:</b> ${params.importance}`,
    ``,
    escapeHtml(params.summary),
    bullets,
    ``,
    `<a href="${params.url}">Open Website →</a>`,
  ].join("\n");

  return sendTelegramMessage(params.chatId, text);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function setTelegramWebhook(url: string) {
  return telegramRequest("setWebhook", { url });
}

export async function getTelegramBotInfo() {
  return telegramRequest("getMe", {});
}
