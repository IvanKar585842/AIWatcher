import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getAllowedIntervals,
  getPlanLimits,
  isIntervalAllowed,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";
import { createMonitorSchema } from "@/lib/validations";

export async function GET() {
  return withRateLimit("monitors-list", async () => {
    try {
      const user = await requireUser();
      const monitors = await prisma.monitor.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { changes: true } },
        },
      });

      return NextResponse.json({ monitors });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withRateLimit("monitors-create", async () => {
    try {
      const user = await requireUser();
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
      if (error instanceof Error && error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  });
}
