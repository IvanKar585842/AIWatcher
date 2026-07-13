/**
 * Subscription view model mapped onto the existing Prisma `Subscription` table.
 * Stripe Checkout + webhooks keep these fields in sync.
 *
 * Field mapping (requested names → DB):
 * - stripeCustomerId      → Subscription.stripeCustomerId
 * - stripeSubscriptionId  → Subscription.stripeSubscriptionId
 * - subscriptionStatus    → Subscription.status
 * - subscriptionPlan      → Subscription.plan
 * - subscriptionEndsAt    → Subscription.currentPeriodEnd
 */
import type { Plan, Subscription } from "@prisma/client";

export type SubscriptionDisplayStatus =
  | "Active"
  | "Cancelled"
  | "Expired"
  | "Past due"
  | "Inactive";

export type UserSubscriptionView = {
  userId: string;
  planId: Plan;
  status: string;
  displayStatus: SubscriptionDisplayStatus;
  subscriptionId: string | null;
  renewalDate: Date | null;
  subscriptionEndsAt: Date | null;
  createdAt: Date;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
  canManageBilling: boolean;
};

const PAID_ACCESS = new Set(["active", "trialing", "past_due"]);

export function getSubscriptionDisplayStatus(
  sub: Pick<Subscription, "status" | "plan" | "cancelAtPeriodEnd" | "currentPeriodEnd">
): SubscriptionDisplayStatus {
  const status = (sub.status ?? "").toLowerCase();
  const endsAt = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const ended = endsAt !== null && endsAt.getTime() < Date.now();

  if (status === "past_due") return "Past due";
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    return ended || sub.plan === "FREE" ? "Expired" : "Cancelled";
  }
  if (sub.cancelAtPeriodEnd && PAID_ACCESS.has(status)) return "Cancelled";
  if (PAID_ACCESS.has(status) && sub.plan !== "FREE") return "Active";
  if (ended) return "Expired";
  return "Inactive";
}

export function toUserSubscriptionView(sub: Subscription): UserSubscriptionView {
  return {
    userId: sub.userId,
    planId: sub.plan,
    status: sub.status,
    displayStatus: getSubscriptionDisplayStatus(sub),
    subscriptionId: sub.stripeSubscriptionId,
    renewalDate: sub.currentPeriodEnd,
    subscriptionEndsAt: sub.currentPeriodEnd,
    createdAt: sub.createdAt,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    stripeCustomerId: sub.stripeCustomerId,
    stripePriceId: sub.stripePriceId,
    canManageBilling: Boolean(sub.stripeCustomerId),
  };
}

/** Whether paid entitlements should apply for this subscription row. */
export function subscriptionGrantsPaidAccess(
  sub: { plan: Plan; status: string } | null | undefined
): boolean {
  if (!sub || sub.plan === "FREE") return false;
  return PAID_ACCESS.has(sub.status.toLowerCase());
}
