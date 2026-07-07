import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";
import { createTelegramLinkCode } from "@/lib/telegram/link-token";

export async function GET() {
  return withRateLimit("telegram-link", async () => {
    try {
      const user = await requireUser();
      const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "WatchFlowAIBot";
      let linkUrl: string | null = null;

      try {
        const linkCode = createTelegramLinkCode(user.id);
        linkUrl = `https://t.me/${botUsername}?start=${linkCode}`;
      } catch {
        linkUrl = null;
      }

      return NextResponse.json({
        linked: !!user.telegramChatId,
        telegramUsername: user.telegramUsername,
        linkUrl,
      });
    } catch (error) {
      return apiErrorResponse(error);
    }
  });
}

export async function DELETE() {
  return withRateLimit("telegram-unlink", async () => {
    try {
      const user = await requireUser();
      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: null, telegramUsername: null },
      });
      return NextResponse.json({ success: true });
    } catch (error) {
      return apiErrorResponse(error);
    }
  });
}
