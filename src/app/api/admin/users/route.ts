import { Plan } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailure, apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { getUserUsage } from "@/lib/usage";
import { withRateLimit } from "@/lib/rate-limit";
import { securityLog } from "@/lib/security/log";

const adminUserPatchSchema = z
  .object({
    userId: z.string().min(1).max(64),
    role: z.enum(["USER", "ADMIN"]).optional(),
    plan: z.nativeEnum(Plan).optional(),
  })
  .refine((b) => b.role !== undefined || b.plan !== undefined, {
    message: "role or plan required",
  });

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
        const raw = await parseJsonBody(request);
        const parsed = adminUserPatchSchema.safeParse(raw);
        if (!parsed.success) {
          return apiFailure(parsed.error.errors[0]?.message ?? "Invalid request", 400);
        }

        const { userId, role, plan } = parsed.data;
        const updates: Promise<unknown>[] = [];

        if (role) {
          // Only server-side admins reach here (requireAdmin). Clients cannot self-promote.
          updates.push(
            prisma.user.update({
              where: { id: userId },
              data: { role },
            })
          );
        }

        if (plan) {
          updates.push(
            prisma.subscription.upsert({
              where: { userId },
              update: { plan, status: "active" },
              create: { userId, plan, status: "active" },
            })
          );
        }

        await Promise.all(updates);

        securityLog({
          type: "suspicious.activity",
          message: "Admin updated user role/plan",
          userId: admin.id,
          resourceId: userId,
          route: "admin-users-patch",
          metadata: { role, plan },
        });

        const user = await prisma.user.findUnique({
          where: { id: userId },
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
