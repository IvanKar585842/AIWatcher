import Stripe from "stripe";
import { Plan } from "@prisma/client";
import { STRIPE_PRICE_IDS } from "@/lib/constants";
import { prisma } from "@/lib/db";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
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
  plan: "PRO" | "BUSINESS"
) {
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const priceId =
    plan === "PRO" ? STRIPE_PRICE_IDS.PRO_MONTHLY : STRIPE_PRICE_IDS.BUSINESS_MONTHLY;

  if (!priceId) {
    throw new Error(`Stripe price ID not configured for ${plan}`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard/billing?success=true`,
    cancel_url: `${appUrl}/dashboard/billing?canceled=true`,
    metadata: { userId, plan },
    subscription_data: {
      metadata: { userId, plan },
    },
  });

  return session;
}

export async function createBillingPortalSession(customerId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/billing`,
  });

  return session;
}

export async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  if (!userId) return;

  const priceId = subscription.items.data[0]?.price.id;
  let plan: Plan = Plan.FREE;

  if (priceId === STRIPE_PRICE_IDS.PRO_MONTHLY) {
    plan = Plan.PRO;
  } else if (priceId === STRIPE_PRICE_IDS.BUSINESS_MONTHLY) {
    plan = Plan.BUSINESS;
  }

  await prisma.subscription.update({
    where: { userId },
    data: {
      plan,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  if (!userId) return;

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
