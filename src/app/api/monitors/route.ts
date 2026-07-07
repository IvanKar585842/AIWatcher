import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import {
  getEffectivePlan,
  getUserAllowedIntervals,
  getUserPlanLimits,
  isIntervalAllowedForUser,
} from "@/lib/admin";
import { prisma } from "@/lib/db";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { apiFailure, apiFailureFromError } from "@/lib/api-response";
import { assertNotificationAllowed } from "@/lib/plan-guards";
import { withRateLimit } from "@/lib/rate-limit";
import { createMonitorSchema } from "@/lib/validations";
import { syncMonitorQueue } from "@/lib/monitoring/queue";

function isSchemaMismatch(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2010" || error.code === "P2022";
  }
  return (
    error instanceof Error &&
    (error.message.includes("column") ||
      error.message.includes("Invalid") ||
      error.message.includes("enum"))
  );
}

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "monitors-list",
      async () => {
        try {
          await trackEvent({ type: "user.active", userId: user.id });
          const monitors = await prisma.monitor.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            include: {
              _count: { select: { changes: true } },
            },
          });

          return NextResponse.json({ success: true, monitors });
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
      user.id
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

          const plan = getEffectivePlan(user);
          const limits = getUserPlanLimits(user);

          const monitorCount = await prisma.monitor.count({
            where: { userId: user.id },
          });

          if (monitorCount >= limits.maxMonitors) {
            return NextResponse.json(
              {
                success: false,
                error: `Monitor limit reached (${limits.maxMonitors}). Upgrade your plan.`,
              },
              { status: 403 }
            );
          }

          if (!isIntervalAllowedForUser(user, parsed.data.interval)) {
            return NextResponse.json(
              {
                success: false,
                error: `Interval not allowed on ${plan} plan. Allowed: ${getUserAllowedIntervals(user).join(", ")}`,
              },
              { status: 403 }
            );
          }

          if (
            parsed.data.notificationMethod === "TELEGRAM" ||
            parsed.data.notificationMethod === "BOTH"
          ) {
            assertNotificationAllowed(user, parsed.data.notificationMethod);
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
          const monitor = await prisma.monitor.create({
            data: {
              userId: user.id,
              name: parsed.data.name,
              url: parsed.data.url,
              description: parsed.data.description ?? null,
              category: parsed.data.category ?? null,
              tags: parsed.data.tags ?? [],
              aiPrompt: parsed.data.aiPrompt ?? null,
              config: parsed.data.config ?? undefined,
              mode: parsed.data.mode,
              selector: parsed.data.selector ?? null,
              keywords: parsed.data.keywords ?? [],
              interval: parsed.data.interval,
              notificationMethod: parsed.data.notificationMethod,
              respectRobots: parsed.data.respectRobots,
              nextCheckAt,
            },
          });

          await syncMonitorQueue(monitor.id, nextCheckAt);

          return NextResponse.json({ success: true, monitor }, { status: 201 });
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
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
