import { Plan, type MonitoringInterval } from "@prisma/client";
import { INTERVAL_ORDER, PLAN_LIMITS, getPlanLimits } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { ApiError, UnauthorizedError } from "@/lib/errors";
import { getPlanEntitlements, type PlanEntitlements } from "@/lib/plan-features";

const DEFAULT_ADMIN_EMAILS = ["karpenkoivanb@gmail.com"];

export type AdminUserLike = {
  email: string;
  role?: string | null;
  subscription?: { plan: Plan } | null;
};

export function getAdminEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase());
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function isAdminUser(user: AdminUserLike | null | undefined): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || isAdminEmail(user.email);
}

export function getEffectivePlan(user: AdminUserLike): Plan {
  if (isAdminUser(user)) return Plan.BUSINESS;
  return user.subscription?.plan ?? Plan.FREE;
}

export type PlanLimits = ReturnType<typeof getPlanLimits>;

export const ADMIN_LIMITS: PlanLimits = {
  ...PLAN_LIMITS.BUSINESS,
  maxMonitors: Infinity,
};

export function getUserPlanLimits(user: AdminUserLike): PlanLimits {
  if (isAdminUser(user)) return ADMIN_LIMITS;
  return getPlanLimits(getEffectivePlan(user));
}

export function getUserPlanEntitlements(user: AdminUserLike): PlanEntitlements {
  if (isAdminUser(user)) {
    return {
      ...getPlanEntitlements(Plan.BUSINESS),
      maxMonitors: Infinity,
      maxVisualMonitors: Infinity,
      aiAnalysesPerMonth: null,
      notificationsPerMonth: null,
      storageMb: null,
      chatDailyMessages: Infinity,
    };
  }
  return getPlanEntitlements(getEffectivePlan(user));
}

export function getUserAllowedIntervals(user: AdminUserLike): MonitoringInterval[] {
  const limits = getUserPlanLimits(user);
  const minIndex = INTERVAL_ORDER.indexOf(limits.minInterval);
  return INTERVAL_ORDER.slice(minIndex);
}

export function isIntervalAllowedForUser(
  user: AdminUserLike,
  interval: MonitoringInterval
): boolean {
  return getUserAllowedIntervals(user).includes(interval);
}

export async function ensureAdminPrivileges(userId: string, email: string): Promise<void> {
  if (!isAdminEmail(email)) return;

  await prisma.user.update({
    where: { id: userId },
    data: { role: "ADMIN" } as { role: "ADMIN" | "USER" },
  });

  await prisma.subscription.upsert({
    where: { userId },
    update: { plan: Plan.BUSINESS, status: "active" },
    create: { userId, plan: Plan.BUSINESS, status: "active" },
  });
}

export async function requireAdmin() {
  const { requireUser } = await import("@/lib/auth");
  const user = await requireUser();

  if (!isAdminUser(user)) {
    throw new ApiError("Admin access required", 403);
  }

  return user;
}

export function assertAdminPageAccess(user: AdminUserLike | null | undefined): void {
  if (!isAdminUser(user)) {
    throw new UnauthorizedError("Admin access required");
  }
}
