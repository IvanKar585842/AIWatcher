import { prisma } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { INTERVAL_LABELS, MODE_LABELS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";

interface TelegramUpdate {
  message?: {
    chat: { id: number; username?: string };
    text?: string;
    from?: { id: number; username?: string };
  };
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  if (!message?.text) return;

  const chatId = String(message.chat.id);
  const text = message.text.trim();
  const [command, ...args] = text.split(/\s+/);
  const cmd = command.toLowerCase().split("@")[0];

  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
  });

  switch (cmd) {
    case "/start": {
      const linkCode = args[0];
      if (linkCode?.startsWith("link_")) {
        const userId = linkCode.replace("link_", "");
        const linkUser = await prisma.user.findUnique({ where: { id: userId } });
        if (linkUser) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              telegramChatId: chatId,
              telegramUsername: message.from?.username ?? null,
            },
          });
          await sendTelegramMessage(
            chatId,
            "✅ <b>Account linked!</b>\n\nYou'll now receive change notifications here.\n\nUse /list to see your monitors."
          );
          return;
        }
      }

      await sendTelegramMessage(
        chatId,
        "👋 <b>Welcome to WatchFlow AI Bot!</b>\n\n" +
          "To link your account, go to Dashboard → Settings → Telegram and click Connect.\n\n" +
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
        await sendTelegramMessage(chatId, "❌ Account not linked. Use /start with your link code from the dashboard.");
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
        await sendTelegramMessage(chatId, "❌ Account not linked.");
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
        await sendTelegramMessage(chatId, "❌ Account not linked.");
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
        await sendTelegramMessage(chatId, "❌ Account not linked.");
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
        await sendTelegramMessage(chatId, "❌ Account not linked.");
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

async function resolveMonitorId(userId: string, partialId?: string): Promise<string | null> {
  if (!partialId) return null;

  const monitors = await prisma.monitor.findMany({ where: { userId } });
  const match = monitors.find(
    (m) => m.id === partialId || m.id.endsWith(partialId) || m.id.startsWith(partialId)
  );
  return match?.id ?? null;
}
