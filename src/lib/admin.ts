import { Plan, UserRole, type MonitoringInterval } from "@prisma/client";
import { INTERVAL_ORDER, PLAN_LIMITS, getPlanLimits } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { getPlanEntitlements, type PlanEntitlements } from "@/lib/plan-features";

/** Bootstrap allowlist — assigned to DB role=ADMIN on login. Set ADMIN_EMAILS in env. */
const DEV_FALLBACK_ADMIN_EMAILS = ["karpenkoivanb@gmail.com"];

export type AdminUserLike = {
  email: string;
  role?: string | null;
  subscription?: { plan: Plan; status?: string | null } | null;
  referralProUntil?: Date | string | null;
  referralBonusMonitors?: number | null;
};

export function getAdminEmails(): string[] {
  const fromEnv = process.env.ADMIN_EMAILS?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (fromEnv && fromEnv.length > 0) return fromEnv;

  // Production: no hardcoded bootstrap — rely on DB role only
  if (process.env.NODE_ENV === "production") {
    return [];
  }

  return DEV_FALLBACK_ADMIN_EMAILS.map((e) => e.toLowerCase());
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * Effective admin check for entitlements / UI hints.
 * Prefer DB role; email allowlist is a bootstrap fallback until role is synced.
 */
export function isAdminUser(user: AdminUserLike | null | undefined): boolean {
  if (!user) return false;
  if (user.role === UserRole.ADMIN || user.role === "ADMIN") return true;
  return isAdminEmail(user.email);
}

const PAID_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

export function getEffectivePlan(user: AdminUserLike): Plan {
  if (isAdminUser(user)) return Plan.BUSINESS;

  const sub = user.subscription;
  const status = (sub?.status ?? "active").toLowerCase();
  const storedPlan = sub?.plan ?? Plan.FREE;
  // Only grant paid plan when Stripe status is valid (webhook is source of truth)
  const base =
    storedPlan !== Plan.FREE && PAID_ACCESS_STATUSES.has(status)
      ? storedPlan
      : Plan.FREE;

  if (base !== Plan.FREE) return base;
  const until = user.referralProUntil ? new Date(user.referralProUntil) : null;
  if (until && until.getTime() > Date.now()) return Plan.PRO;
  return base;
}

export type PlanLimits = ReturnType<typeof getPlanLimits>;

export const ADMIN_LIMITS: PlanLimits = {
  ...PLAN_LIMITS.BUSINESS,
  maxMonitors: Infinity,
};

export function getUserPlanLimits(user: AdminUserLike): PlanLimits {
  if (isAdminUser(user)) return ADMIN_LIMITS;
  const limits = getPlanLimits(getEffectivePlan(user));
  const bonus = Math.max(0, user.referralBonusMonitors ?? 0);
  if (!Number.isFinite(limits.maxMonitors) || bonus === 0) return limits;
  return {
    ...limits,
    maxMonitors: limits.maxMonitors + bonus,
  } as PlanLimits;
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

/**
 * Server-side: promote allowlisted emails to ADMIN + Business plan on login.
 * Never callable from the client. Non-allowlisted emails are ignored.
 */
export async function ensureAdminPrivileges(userId: string, email: string): Promise<void> {
  if (!isAdminEmail(email)) return;

  await prisma.user.update({
    where: { id: userId },
    data: { role: UserRole.ADMIN },
  });

  await prisma.subscription.upsert({
    where: { userId },
    update: { plan: Plan.BUSINESS, status: "active" },
    create: { userId, plan: Plan.BUSINESS, status: "active" },
  });
}

/**
 * Server-only gate for admin pages and APIs.
 * Access requires authenticated user with role === ADMIN in the database.
 * Allowlisted emails are auto-promoted first (bootstrap), then re-checked.
 */
export async function requireAdmin() {
  const { requireUser } = await import("@/lib/auth");
  let user = await requireUser();

  if (isAdminEmail(user.email) && user.role !== UserRole.ADMIN) {
    await ensureAdminPrivileges(user.id, user.email);
    user = await requireUser();
  }

  if (user.role !== UserRole.ADMIN) {
    throw new ApiError("Admin access required", 403);
  }

  return user;
}

export function assertAdminPageAccess(user: AdminUserLike | null | undefined): void {
  if (!user || user.role !== UserRole.ADMIN) {
    throw new ApiError("Admin access required", 403);
  }
}
