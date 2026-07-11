/**
 * Subscription view model mapped onto the existing Prisma `Subscription` table.
 * Stripe Checkout + webhooks keep these fields in sync.
 */
import type { Plan, Subscription } from "@prisma/client";

export type UserSubscriptionView = {
  userId: string;
  planId: Plan;
  status: string;
  subscriptionId: string | null;
  renewalDate: Date | null;
  createdAt: Date;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripePriceId: string | null;
};

export function toUserSubscriptionView(sub: Subscription): UserSubscriptionView {
  return {
    userId: sub.userId,
    planId: sub.plan,
    status: sub.status,
    subscriptionId: sub.stripeSubscriptionId,
    renewalDate: sub.currentPeriodEnd,
    createdAt: sub.createdAt,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    stripeCustomerId: sub.stripeCustomerId,
    stripePriceId: sub.stripePriceId,
  };
}
