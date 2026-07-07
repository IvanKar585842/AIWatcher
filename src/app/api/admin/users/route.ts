import { Plan } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailure, apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";

export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        subscription: { select: { plan: true, status: true } },
        _count: { select: { monitors: true, notifications: true } },
      },
    });

    return apiSuccess({ users });
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await parseJsonBody<{
      userId: string;
      role?: "USER" | "ADMIN";
      plan?: Plan;
    }>(request);

    if (!body.userId) {
      return apiFailure("userId required", 400);
    }

    const updates: Promise<unknown>[] = [];

    if (body.role) {
      updates.push(
        prisma.user.update({
          where: { id: body.userId },
          data: { role: body.role },
        })
      );
    }

    if (body.plan) {
      updates.push(
        prisma.subscription.upsert({
          where: { userId: body.userId },
          update: { plan: body.plan, status: "active" },
          create: { userId: body.userId, plan: body.plan, status: "active" },
        })
      );
    }

    await Promise.all(updates);

    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      include: { subscription: true },
    });

    return apiSuccess({ user });
  } catch (error) {
    return apiFailureFromError(error);
  }
}
