import { NextRequest, NextResponse } from "next/server";
import { MonitoringMode, Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { isIntervalAllowedForUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { apiFailureFromError } from "@/lib/api-response";
import {
  assertMonitorModeAllowed,
  assertMonitorModeSelectable,
  assertMonitorQuota,
  assertNotificationAllowed,
  assertVisualMonitorQuota,
} from "@/lib/plan-guards";
import { withRateLimit } from "@/lib/rate-limit";
import { createMonitorSchema } from "@/lib/validations";
import { resolveFaviconUrl } from "@/lib/favicon";
import { getFaviconUrl } from "@/lib/utils";
import { syncMonitorQueue } from "@/lib/monitoring/queue";
import { markOnboardingCompleted } from "@/lib/onboarding";
import {
  prepareMonitorConfigForStorage,
  sanitizeMonitorConfigForClient,
} from "@/lib/monitoring/session-cookies";
import { invalidateUserMonitoringContext } from "@/lib/ai/chat-user-context";

function isVisualMode(mode: MonitoringMode): boolean {
  return mode === MonitoringMode.VISUAL_CHANGES || mode === MonitoringMode.SCREENSHOT_DIFF;
}

function isSchemaMismatch(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2010" || error.code === "P2022";
  }
  return (
    error instanceof Error &&
    (error.message.includes("column") ||
      error.message.includes("does not exist") ||
      error.message.includes("Invalid") ||
      error.message.includes("enum"))
  );
}

export async function GET() {
  try {
    const user = await requireUser();
    const userId = user.id;

    return withRateLimit(
      "monitors-list",
      async () => {
        try {
          // Non-blocking analytics — must not delay or fail the list
          void trackEvent({ type: "user.active", userId });

          const monitors = await prisma.monitor.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 250,
            include: {
              _count: { select: { changes: true } },
            },
          });

          // Never leak encrypted session cookies to the client
          return NextResponse.json({
            success: true,
            monitors: monitors.map((m) => ({
              ...m,
              config: sanitizeMonitorConfigForClient(m.config),
            })),
          });
        } catch (error) {
          if (isSchemaMismatch(error)) {
            console.error("Database schema mismatch on GET /api/monitors:", error);
            return NextResponse.json(
              {
                success: false,
                error: "Database schema is out of sync. Run: npm run db:sync",
              },
              { status: 503 }
            );
          }
          throw error;
        }
      },
      userId
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "monitors-create",
      async () => {
        try {
          const body = await parseJsonBody(request);
          const parsed = createMonitorSchema.safeParse(body);

          if (!parsed.success) {
            const message =
              parsed.error.errors[0]?.message ?? "Validation failed";
            return NextResponse.json(
              { success: false, error: message, details: parsed.error.flatten() },
              { status: 400 }
            );
          }

          const monitorCount = await prisma.monitor.count({
            where: { userId: user.id },
          });

          assertMonitorQuota(user, monitorCount);
          assertMonitorModeSelectable(parsed.data.mode);
          if (isVisualMode(parsed.data.mode)) {
            const visualMonitorCount = await prisma.monitor.count({
              where: {
                userId: user.id,
                mode: { in: [MonitoringMode.VISUAL_CHANGES, MonitoringMode.SCREENSHOT_DIFF] },
              },
            });
            assertVisualMonitorQuota(user, visualMonitorCount);
          }

          if (!isIntervalAllowedForUser(user, parsed.data.interval)) {
            return NextResponse.json(
              {
                success: false,
                error:
                  "Faster check intervals unlock on Pro — catch critical updates within minutes.",
                upgrade: {
                  feature: "FASTER_INTERVALS",
                  title: "Faster checks on Pro",
                  description:
                    "Monitor as often as every 5 minutes when timing is critical.",
                  minPlan: "PRO",
                },
              },
              { status: 403 }
            );
          }

          try {
            assertMonitorModeAllowed(user, parsed.data.mode);
            assertNotificationAllowed(user, parsed.data.notificationMethod);
          } catch (err) {
            return apiFailureFromError(err);
          }

          const existing = await prisma.monitor.findFirst({
            where: { userId: user.id, url: parsed.data.url },
            select: { id: true },
          });

          if (existing) {
            return NextResponse.json(
              { success: false, error: "You are already monitoring this URL." },
              { status: 409 }
            );
          }

          const nextCheckAt = new Date();
          const faviconUrl = await resolveFaviconUrl(parsed.data.url).catch(() =>
            getFaviconUrl(parsed.data.url, 128)
          );
          let storedConfig: ReturnType<typeof prepareMonitorConfigForStorage> | undefined;
          if (parsed.data.config) {
            try {
              storedConfig = prepareMonitorConfigForStorage({
                incoming: parsed.data.config,
                existing: null,
                userId: user.id,
                monitorUrl: parsed.data.url,
              });
            } catch (err) {
              return NextResponse.json(
                {
                  success: false,
                  error: err instanceof Error ? err.message : "Invalid session configuration",
                },
                { status: 400 }
              );
            }
          }
          const monitor = await prisma.monitor.create({
            data: {
              userId: user.id,
              name: parsed.data.name,
              url: parsed.data.url,
              faviconUrl,
              description: parsed.data.description ?? null,
              category: parsed.data.category ?? null,
              tags: parsed.data.tags ?? [],
              aiPrompt: parsed.data.aiPrompt ?? null,
              config: storedConfig as Prisma.InputJsonValue | undefined,
              mode: parsed.data.mode,
              selector: parsed.data.selector ?? null,
              keywords: parsed.data.keywords ?? [],
              interval: parsed.data.interval,
              notificationMethod: parsed.data.notificationMethod,
              respectRobots: parsed.data.respectRobots,
              nextCheckAt,
            },
          });

          invalidateUserMonitoringContext(user.id);

          await syncMonitorQueue(monitor.id, nextCheckAt);

          if (!user.onboardingCompleted) {
            await markOnboardingCompleted(user.id);
            void trackEvent({
              type: "onboarding.completed",
              userId: user.id,
              metadata: { via: "first_monitor" },
            });
          }

          void trackEvent({
            type: "monitor.created",
            userId: user.id,
            metadata: { monitorId: monitor.id, mode: monitor.mode, first: monitorCount === 0 },
          });

          if (monitorCount === 0) {
            void trackEvent({
              type: "monitor.first_created",
              userId: user.id,
              metadata: { monitorId: monitor.id, mode: monitor.mode },
            });
          }

          return NextResponse.json(
            {
              success: true,
              monitor: {
                ...monitor,
                config: sanitizeMonitorConfigForClient(monitor.config),
              },
            },
            { status: 201 }
          );
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
              return NextResponse.json(
                { success: false, error: "You are already monitoring this URL." },
                { status: 409 }
              );
            }
            if (isSchemaMismatch(error)) {
              console.error("Database schema mismatch on POST /api/monitors:", error);
              return NextResponse.json(
                {
                  success: false,
                  error: "Database schema is out of sync. Run: npm run db:sync",
                },
                { status: 503 }
              );
            }
          }
          if (error instanceof ApiError) {
            return NextResponse.json(
              { success: false, error: error.message },
              { status: error.status }
            );
          }
          console.error("Create monitor error:", error);
          const message =
            error instanceof Error ? error.message : "Failed to create monitor";
          return NextResponse.json({ success: false, error: message }, { status: 500 });
        }
      },
      user.id,
      "strict"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
