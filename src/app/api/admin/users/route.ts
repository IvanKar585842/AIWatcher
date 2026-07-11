import { Plan } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailure, apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { getUserUsage } from "@/lib/usage";
import { withRateLimit } from "@/lib/rate-limit";
import { securityLog } from "@/lib/security/log";

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    return withRateLimit(
      "admin-users-get",
      async () => {
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get("q") ?? searchParams.get("query") ?? "").trim();
        const userId = searchParams.get("id")?.trim();

        if (userId) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
              onboardingCompleted: true,
              telegramChatId: true,
              subscription: { select: { plan: true, status: true } },
              _count: { select: { monitors: true, notifications: true } },
              monitors: {
                orderBy: { updatedAt: "desc" },
                take: 50,
                select: {
                  id: true,
                  name: true,
                  url: true,
                  status: true,
                  mode: true,
                  lastCheckedAt: true,
                  lastChangedAt: true,
                  errorCount: true,
                  errorMessage: true,
                  _count: { select: { changes: true } },
                },
              },
            },
          });

          if (!user) {
            return apiFailure("User not found", 404);
          }

          const [usage, recentActivity] = await Promise.all([
            getUserUsage(user.id),
            prisma.analyticsEvent.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: "desc" },
              take: 30,
              select: {
                id: true,
                type: true,
                durationMs: true,
                metadata: true,
                createdAt: true,
              },
            }),
          ]);

          return apiSuccess({ user, usage, recentActivity });
        }

        const users = await prisma.user.findMany({
          where: query
            ? {
                OR: [
                  { email: { contains: query, mode: "insensitive" } },
                  { name: { contains: query, mode: "insensitive" } },
                ],
              }
            : undefined,
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
      },
      admin.id,
      "admin"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    return withRateLimit(
      "admin-users-patch",
      async () => {
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

        securityLog({
          type: "suspicious.activity",
          message: "Admin updated user role/plan",
          userId: admin.id,
          resourceId: body.userId,
          route: "admin-users-patch",
          metadata: { role: body.role, plan: body.plan },
        });

        const user = await prisma.user.findUnique({
          where: { id: body.userId },
          include: { subscription: true },
        });

        return apiSuccess({ user });
      },
      admin.id,
      "admin"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
