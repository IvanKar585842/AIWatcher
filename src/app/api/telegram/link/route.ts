import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();
    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "WatchFlowAIBot";
    const linkUrl = `https://t.me/${botUsername}?start=link_${user.id}`;

    return NextResponse.json({
      linked: !!user.telegramChatId,
      telegramUsername: user.telegramUsername,
      linkUrl,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: null, telegramUsername: null },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
