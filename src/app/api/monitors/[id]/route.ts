import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { isIntervalAllowedForUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError, apiErrorResponse } from "@/lib/api-response";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { assertMonitorModeAllowed, assertNotificationAllowed } from "@/lib/plan-guards";
import { withRateLimit } from "@/lib/rate-limit";
import { assertMonitorOwnedBy } from "@/lib/security/ownership";
import { updateMonitorSchema } from "@/lib/validations";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(
      `monitor-get-${id}`,
      async () => {
        const monitor = await prisma.monitor.findFirst({
          where: { id, userId: user.id },
          include: {
            changes: {
              orderBy: { createdAt: "desc" },
              take: 10,
              select: {
                id: true,
                summary: true,
                emoji: true,
                importance: true,
                category: true,
                createdAt: true,
              },
            },
            _count: { select: { changes: true, snapshots: true } },
          },
        });
        if (!monitor) {
          return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
        }
        return NextResponse.json({
          monitor,
          plan: user.subscription?.plan ?? "FREE",
        });
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(
      `monitor-patch-${id}`,
      async () => {
        const body = await parseJsonBody(request);
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
        if (parsed.data.interval && !isIntervalAllowedForUser(user, parsed.data.interval)) {
          return NextResponse.json(
            {
              error:
                "Faster check intervals unlock on Pro — catch critical updates within minutes.",
              upgrade: {
                feature: "FASTER_INTERVALS",
                title: "Faster checks on Pro",
                description: "Monitor as often as every 5 minutes when timing is critical.",
                minPlan: "PRO",
              },
            },
            { status: 403 }
          );
        }
        if (parsed.data.mode) {
          try {
            assertMonitorModeAllowed(user, parsed.data.mode);
          } catch (err) {
            return apiFailureFromError(err);
          }
        }
        if (parsed.data.notificationMethod) {
          try {
            assertNotificationAllowed(user, parsed.data.notificationMethod);
          } catch (err) {
            return apiFailureFromError(err);
          }
        }
        if (parsed.data.url && parsed.data.url !== existing.url) {
          const duplicate = await prisma.monitor.findFirst({
            where: { userId: user.id, url: parsed.data.url, NOT: { id } },
            select: { id: true },
          });
          if (duplicate) {
            return NextResponse.json(
              { error: "You are already monitoring this URL." },
              { status: 409 }
            );
          }
        }
        const { config, ...rest } = parsed.data;
        try {
          const monitor = await prisma.monitor.update({
            where: { id },
            data: {
              ...rest,
              ...(config !== undefined
                ? { config: config === null ? Prisma.JsonNull : (config as Prisma.InputJsonValue) }
                : {}),
            },
          });
          return NextResponse.json({ monitor });
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
      user.id,
      "sensitive"
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return apiErrorResponse(error);
  }
}
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(
      `monitor-delete-${id}`,
      async () => {
        // Ownership check — prevents deleting another user's monitor
        await assertMonitorOwnedBy(user.id, id);
        await prisma.monitor.delete({ where: { id } });
        return NextResponse.json({ success: true });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
