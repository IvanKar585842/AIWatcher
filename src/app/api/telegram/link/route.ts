import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";

const DEFAULT_BOT_USERNAME = "WatchFlowAlertsBot";

function buildConnectUrl(userId: string): string {
  const botUsername =
    process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim() || DEFAULT_BOT_USERNAME;
  return `https://t.me/${botUsername}?start=${userId}`;
}

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "telegram-link",
      async () => {
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

        const connected = Boolean(fresh?.telegramChatId);

        return NextResponse.json({
          linked: connected,
          connected,
          telegramUsername: fresh?.telegramUsername ?? null,
          telegramConnectedAt: fresh?.telegramConnectedAt ?? null,
          telegramNotificationsEnabled: fresh?.telegramNotificationsEnabled ?? true,
          emailNotificationsEnabled: fresh?.emailNotificationsEnabled ?? true,
          email: fresh?.email ?? user.email,
          linkUrl: buildConnectUrl(user.id),
          botUsername:
            process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim() ||
            DEFAULT_BOT_USERNAME,
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

        return NextResponse.json({
          success: true,
          ...updated,
          linked: Boolean(updated.telegramChatId),
          connected: Boolean(updated.telegramChatId),
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
          linkUrl: buildConnectUrl(user.id),
        });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
