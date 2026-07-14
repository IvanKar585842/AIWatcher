import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isStripeSecretConfigured, isStripePaymentsEnabled } from "@/lib/stripe-config";
import { getTelegramBotToken, getTelegramWebhookSecret } from "@/lib/telegram/env";

export const dynamic = "force-dynamic";

/**
 * Lightweight readiness probe for uptime monitors (no auth).
 * Does not expose secrets — only boolean capability flags.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const status = database === "ok" ? 200 : 503;

  return NextResponse.json(
    {
      ok: database === "ok",
      service: "watchflowing",
      database,
      payments: {
        configured: isStripeSecretConfigured(),
        enabled: isStripePaymentsEnabled(),
      },
      email: Boolean(process.env.RESEND_API_KEY?.trim()),
      redis: Boolean(
        process.env.UPSTASH_REDIS_REST_URL?.trim() &&
          process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
      ),
      cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
      telegram: Boolean(getTelegramBotToken()),
      telegramWebhook: Boolean(getTelegramWebhookSecret()),
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
