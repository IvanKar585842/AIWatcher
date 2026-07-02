import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAllowedIntervals, isIntervalAllowed } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";
import { updateMonitorSchema } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withRateLimit(`monitor-get-${id}`, async () => {
    try {
      const user = await requireUser();
      const monitor = await prisma.monitor.findFirst({
        where: { id, userId: user.id },
        include: {
          changes: { orderBy: { createdAt: "desc" }, take: 10 },
          _count: { select: { changes: true, snapshots: true } },
        },
      });

      if (!monitor) {
        return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
      }

      return NextResponse.json({ monitor });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withRateLimit(`monitor-patch-${id}`, async () => {
    try {
      const user = await requireUser();
      const body = await request.json();
      const parsed = updateMonitorSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const existing = await prisma.monitor.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
      }

      const plan = user.subscription?.plan ?? "FREE";

      if (parsed.data.interval && !isIntervalAllowed(plan, parsed.data.interval)) {
        return NextResponse.json(
          {
            error: `Interval not allowed. Allowed: ${getAllowedIntervals(plan).join(", ")}`,
          },
          { status: 403 }
        );
      }

      const monitor = await prisma.monitor.update({
        where: { id },
        data: parsed.data,
      });

      return NextResponse.json({ monitor });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withRateLimit(`monitor-delete-${id}`, async () => {
    try {
      const user = await requireUser();
      const existing = await prisma.monitor.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
      }

      await prisma.monitor.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  });
}
