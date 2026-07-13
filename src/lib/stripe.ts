import Stripe from "stripe";
import { Plan } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  assertStripeCheckoutReady,
  getStripePriceId,
  isStripeSecretConfigured,
  type StripePlanKey,
} from "@/lib/stripe-config";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    if (!isStripeSecretConfigured()) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim(), {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return stripe;
}

export async function getOrCreateStripeCustomer(userId: string, email: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  const customer = await getStripe().customers.create({
    email,
    metadata: { userId },
  });

  await prisma.subscription.upsert({
    where: { userId },
    update: { stripeCustomerId: customer.id },
    create: {
      userId,
      stripeCustomerId: customer.id,
      plan: Plan.FREE,
    },
  });

  return customer.id;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: StripePlanKey
) {
  assertStripeCheckoutReady(plan);

  const customerId = await getOrCreateStripeCustomer(userId, email);
  const priceId = getStripePriceId(plan);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    client_reference_id: userId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${appUrl}/dashboard/billing?success=true&plan=${plan}`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
    metadata: { userId, plan },
    subscription_data: {
      metadata: { userId, plan },
    },
  });

  if (!session.url) {
    throw new Error("Stripe Checkout session did not return a URL");
  }

  return session;
}

export async function createBillingPortalSession(customerId: string) {
  if (!isStripeSecretConfigured()) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/billing`,
  });

  return session;
}

async function resolveUserIdFromSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  if (subscription.metadata?.userId) {
    return subscription.metadata.userId;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return null;

  const existing = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });

  return existing?.userId ?? null;
}

/** Stripe statuses that keep paid entitlements. */
const PAID_ACCESS_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

export function hasActiveStripeSubscription(
  subscription:
    | {
        stripeSubscriptionId?: string | null;
        status?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!subscription?.stripeSubscriptionId) return false;
  return PAID_ACCESS_STATUSES.has((subscription.status ?? "").toLowerCase());
}

function planFromPriceId(priceId: string | undefined): Plan {
  if (!priceId) return Plan.FREE;
  if (priceId === getStripePriceId("PRO")) return Plan.PRO;
  if (priceId === getStripePriceId("BUSINESS")) return Plan.BUSINESS;
  return Plan.FREE;
}

/**
 * Maps Stripe subscription → DB plan.
 * Incomplete / unpaid / canceled never grant Pro/Business.
 */
export function planFromStripeSubscription(subscription: Stripe.Subscription): Plan {
  if (!PAID_ACCESS_STATUSES.has(subscription.status)) {
    return Plan.FREE;
  }
  const priceId = subscription.items.data[0]?.price.id;
  return planFromPriceId(priceId);
}

export async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = await resolveUserIdFromSubscription(subscription);
  if (!userId) {
    console.warn("Stripe subscription update skipped — no userId", subscription.id);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const plan = planFromStripeSubscription(subscription);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  await prisma.subscription.upsert({
    where: { userId },
    update: {
      plan,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId ?? null,
      stripeCustomerId: customerId ?? undefined,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    create: {
      userId,
      plan,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId ?? null,
      stripeCustomerId: customerId ?? null,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await resolveUserIdFromSubscription(subscription);
  if (!userId) {
    console.warn("Stripe subscription delete skipped — no userId", subscription.id);
    return;
  }

  await prisma.subscription.update({
    where: { userId },
    data: {
      plan: Plan.FREE,
      stripeSubscriptionId: null,
      stripePriceId: null,
      status: "canceled",
      cancelAtPeriodEnd: false,
    },
  });
}
