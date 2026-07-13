import { prisma } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { INTERVAL_LABELS, MODE_LABELS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";
import { verifyTelegramLinkCode } from "@/lib/telegram/link-token";
import { telegramLog } from "@/lib/telegram/config";

interface TelegramUpdate {
  message?: {
    chat: { id: number; username?: string };
    text?: string;
    from?: { id: number; username?: string };
  };
}

const CONNECTED_MESSAGE =
  "✅ Your WatchFlowing account is connected successfully.";

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  if (!message?.text) return;

  const chatId = String(message.chat.id);
  const telegramUserId = message.from?.id != null ? String(message.from.id) : chatId;
  const text = message.text.trim();
  const [command, ...args] = text.split(/\s+/);
  const cmd = command.toLowerCase().split("@")[0];

  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
  });

  switch (cmd) {
    case "/start": {
      const payload = args[0];
      if (payload) {
        const linked = await tryLinkTelegramAccount({
          payload,
          chatId,
          telegramUserId,
          username: message.from?.username ?? message.chat.username ?? null,
        });
        if (linked) return;
      }

      if (user?.telegramConnected || user?.telegramChatId) {
        await sendTelegramMessage(
          chatId,
          `${CONNECTED_MESSAGE}\n\n` +
            "<b>Commands:</b>\n" +
            "/list — View your monitors\n" +
            "/pause [id] — Pause a monitor\n" +
            "/resume [id] — Resume a monitor\n" +
            "/delete [id] — Delete a monitor\n" +
            "/latest [id] — Latest change for a monitor"
        );
        return;
      }

      await sendTelegramMessage(
        chatId,
        "👋 <b>Welcome to WatchFlowing!</b>\n\n" +
          "To connect notifications, open Dashboard → Settings → Notifications and tap <b>Connect Telegram</b>, then press /start from that link.\n\n" +
          "<b>Commands:</b>\n" +
          "/list — View your monitors\n" +
          "/pause [id] — Pause a monitor\n" +
          "/resume [id] — Resume a monitor\n" +
          "/delete [id] — Delete a monitor\n" +
          "/latest [id] — Latest change for a monitor"
      );
      break;
    }

    case "/list": {
      if (!user) {
        await sendTelegramMessage(
          chatId,
          "❌ Telegram account is not connected. Connect from Dashboard → Settings → Notifications."
        );
        return;
      }

      const monitors = await prisma.monitor.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      if (monitors.length === 0) {
        await sendTelegramMessage(chatId, "📭 No monitors yet. Create one at your dashboard.");
        return;
      }

      const list = monitors
        .map((m, i) => {
          const status = m.status === "ACTIVE" ? "🟢" : m.status === "PAUSED" ? "⏸️" : "🔴";
          return `${i + 1}. ${status} <b>${m.name}</b>\n   ID: <code>${m.id.slice(-8)}</code>\n   ${MODE_LABELS[m.mode]} · ${INTERVAL_LABELS[m.interval]}`;
        })
        .join("\n\n");

      await sendTelegramMessage(chatId, `📋 <b>Your Monitors</b>\n\n${list}`);
      break;
    }

    case "/pause": {
      if (!user) {
        await sendTelegramMessage(chatId, "❌ Telegram account is not connected.");
        return;
      }
      const monitorId = await resolveMonitorId(user.id, args[0]);
      if (!monitorId) {
        await sendTelegramMessage(chatId, "❌ Monitor not found. Use /list to see IDs.");
        return;
      }
      await prisma.monitor.update({
        where: { id: monitorId },
        data: { status: "PAUSED" },
      });
      await sendTelegramMessage(chatId, "⏸️ Monitor paused.");
      break;
    }

    case "/resume": {
      if (!user) {
        await sendTelegramMessage(chatId, "❌ Telegram account is not connected.");
        return;
      }
      const monitorId = await resolveMonitorId(user.id, args[0]);
      if (!monitorId) {
        await sendTelegramMessage(chatId, "❌ Monitor not found.");
        return;
      }
      await prisma.monitor.update({
        where: { id: monitorId },
        data: { status: "ACTIVE" },
      });
      await sendTelegramMessage(chatId, "▶️ Monitor resumed.");
      break;
    }

    case "/delete": {
      if (!user) {
        await sendTelegramMessage(chatId, "❌ Telegram account is not connected.");
        return;
      }
      const monitorId = await resolveMonitorId(user.id, args[0]);
      if (!monitorId) {
        await sendTelegramMessage(chatId, "❌ Monitor not found.");
        return;
      }
      await prisma.monitor.delete({ where: { id: monitorId } });
      await sendTelegramMessage(chatId, "🗑️ Monitor deleted.");
      break;
    }

    case "/latest": {
      if (!user) {
        await sendTelegramMessage(chatId, "❌ Telegram account is not connected.");
        return;
      }
      const monitorId = await resolveMonitorId(user.id, args[0]);
      if (!monitorId) {
        await sendTelegramMessage(chatId, "❌ Monitor not found.");
        return;
      }

      const change = await prisma.change.findFirst({
        where: { monitorId },
        orderBy: { createdAt: "desc" },
        include: { monitor: true },
      });

      if (!change) {
        await sendTelegramMessage(chatId, "📭 No changes detected yet for this monitor.");
        return;
      }

      const bullets =
        change.bulletPoints.length > 0
          ? "\n\n" + change.bulletPoints.map((bp) => `• ${bp}`).join("\n")
          : "";

      await sendTelegramMessage(
        chatId,
        `${change.emoji} <b>Latest Change</b>\n\n` +
          `<b>${change.monitor.name}</b>\n` +
          `${formatRelativeTime(change.createdAt)}\n\n` +
          `${change.summary}${bullets}\n\n` +
          `<a href="${change.monitor.url}">Open Website →</a>`
      );
      break;
    }

    default:
      await sendTelegramMessage(
        chatId,
        "Unknown command. Try /list, /pause, /resume, /delete, or /latest."
      );
  }
}

async function tryLinkTelegramAccount(params: {
  payload: string;
  chatId: string;
  telegramUserId: string;
  username: string | null;
}): Promise<boolean> {
  const userId = resolveStartPayloadUserId(params.payload);
  if (!userId) {
    telegramLog("link_invalid_payload", { chatId: params.chatId });
    await sendTelegramMessage(
      params.chatId,
      "⚠️ Invalid or expired connection link. Open Dashboard → Settings → Notifications and tap Connect Telegram again."
    );
    return true;
  }

  const linkUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!linkUser) {
    telegramLog("link_user_not_found", { userId, chatId: params.chatId });
    await sendTelegramMessage(
      params.chatId,
      "⚠️ WatchFlowing account not found for this connection link."
    );
    return true;
  }

  if (linkUser.telegramChatId && linkUser.telegramChatId !== params.chatId) {
    telegramLog("link_already_linked_other_chat", { userId, chatId: params.chatId });
    await sendTelegramMessage(
      params.chatId,
      "⚠️ This WatchFlowing account is already linked to another Telegram chat. Disconnect it in dashboard settings first."
    );
    return true;
  }

  const existing = await prisma.user.findFirst({
    where: { telegramChatId: params.chatId, NOT: { id: userId } },
  });
  if (existing) {
    telegramLog("link_chat_taken", { userId, chatId: params.chatId });
    await sendTelegramMessage(
      params.chatId,
      "⚠️ This Telegram account is already linked to another WatchFlowing user."
    );
    return true;
  }

  // Persist Telegram user/chat id + connected status on the WatchFlowing user
  await prisma.user.update({
    where: { id: userId },
    data: {
      telegramChatId: params.chatId,
      telegramUsername: params.username,
      telegramConnected: true,
      telegramConnectedAt: new Date(),
      telegramNotificationsEnabled: true,
    },
  });

  telegramLog("link_success", {
    userId,
    telegramUserId: params.telegramUserId,
    chatId: params.chatId,
  });

  const send = await sendTelegramMessage(params.chatId, CONNECTED_MESSAGE);
  if (!send.ok) {
    telegramLog("link_confirm_send_failed", {
      userId,
      error: send.error,
    });
  }
  return true;
}

/**
 * Accepts:
 * - start=USER_ID (cuid)
 * - start=link_... signed codes (legacy / more secure TTL tokens)
 */
function resolveStartPayloadUserId(payload: string): string | null {
  if (payload.startsWith("link_")) {
    return verifyTelegramLinkCode(payload);
  }
  // Prisma cuid() ids are typically 25 chars; reject obvious garbage
  if (/^[a-z0-9]{20,36}$/i.test(payload)) {
    return payload;
  }
  return null;
}

async function resolveMonitorId(userId: string, partialId?: string): Promise<string | null> {
  if (!partialId) return null;

  const monitors = await prisma.monitor.findMany({ where: { userId } });
  const match = monitors.find(
    (m) => m.id === partialId || m.id.endsWith(partialId) || m.id.startsWith(partialId)
  );
  return match?.id ?? null;
}
