import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import {
  getAllowedIntervals,
  getPlanLimits,
  isIntervalAllowed,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";
import { createMonitorSchema } from "@/lib/validations";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "monitors-list",
      async () => {
        await trackEvent({ type: "user.active", userId: user.id });
        const monitors = await prisma.monitor.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { changes: true } },
          },
        });

        return NextResponse.json({ monitors });
      },
      user.id
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "monitors-create",
      async () => {
        const body = await request.json();
        const parsed = createMonitorSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const plan = user.subscription?.plan ?? "FREE";
        const limits = getPlanLimits(plan);

        const monitorCount = await prisma.monitor.count({
          where: { userId: user.id },
        });

        if (monitorCount >= limits.maxMonitors) {
          return NextResponse.json(
            { error: `Monitor limit reached (${limits.maxMonitors}). Upgrade your plan.` },
            { status: 403 }
          );
        }

        if (!isIntervalAllowed(plan, parsed.data.interval)) {
          return NextResponse.json(
            {
              error: `Interval not allowed on ${plan} plan. Allowed: ${getAllowedIntervals(plan).join(", ")}`,
            },
            { status: 403 }
          );
        }

        if (
          (parsed.data.notificationMethod === "TELEGRAM" ||
            parsed.data.notificationMethod === "BOTH") &&
          !limits.telegram
        ) {
          return NextResponse.json(
            { error: "Telegram notifications require Pro plan or higher." },
            { status: 403 }
          );
        }

        const existing = await prisma.monitor.findFirst({
          where: { userId: user.id, url: parsed.data.url },
          select: { id: true },
        });

        if (existing) {
          return NextResponse.json(
            { error: "You are already monitoring this URL." },
            { status: 409 }
          );
        }

        try {
          const monitor = await prisma.monitor.create({
            data: {
              userId: user.id,
              name: parsed.data.name,
              url: parsed.data.url,
              mode: parsed.data.mode,
              selector: parsed.data.selector,
              keywords: parsed.data.keywords ?? [],
              interval: parsed.data.interval,
              notificationMethod: parsed.data.notificationMethod,
              respectRobots: parsed.data.respectRobots,
              nextCheckAt: new Date(),
            },
          });

          return NextResponse.json({ monitor }, { status: 201 });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return NextResponse.json(
              { error: "You are already monitoring this URL." },
              { status: 409 }
            );
          }
          throw error;
        }
      },
      user.id
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
