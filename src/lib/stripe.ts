import Stripe from "stripe";
import { Plan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/app-url";
import { ApiError } from "@/lib/errors";
import {
  assertStripeCheckoutReady,
  getStripeCatalogId,
  getStripePriceId,
  isStripeSecretConfigured,
  type StripePlanKey,
} from "@/lib/stripe-config";
import { toStripeClientError } from "@/lib/stripe-errors";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    if (!isStripeSecretConfigured()) {
      throw new ApiError("Stripe configuration error", 503);
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY!.trim(), {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return stripe;
}

/**
 * Resolve Vercel STRIPE_*_PRICE_ID to a Stripe Price id.
 * Accepts price_… directly, or prod_… (uses first active recurring price).
 */
export async function resolveStripePriceId(plan: StripePlanKey): Promise<string> {
  const catalogId = getStripeCatalogId(plan);
  if (!catalogId) {
    throw new ApiError("Stripe configuration error", 503);
  }

  if (catalogId.startsWith("price_")) {
    return catalogId;
  }

  if (catalogId.startsWith("prod_")) {
    const prices = await getStripe().prices.list({
      product: catalogId,
      active: true,
      limit: 20,
    });
    const recurring =
      prices.data.find((p) => p.type === "recurring" && p.recurring?.interval === "month") ??
      prices.data.find((p) => p.type === "recurring") ??
      prices.data[0];

    if (!recurring?.id) {
      console.error("[stripe] no active price for product", catalogId, plan);
      throw new ApiError("Stripe configuration error", 503);
    }
    return recurring.id;
  }

  throw new ApiError("Stripe configuration error", 503);
}

export async function getOrCreateStripeCustomer(userId: string, email: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (subscription?.stripeCustomerId) {
    try {
      const existing = await getStripe().customers.retrieve(
        subscription.stripeCustomerId
      );
      if (!("deleted" in existing && existing.deleted)) {
        return subscription.stripeCustomerId;
      }
    } catch (error) {
      // Stale id (test↔live switch, deleted customer) — recreate below
      console.warn(
        "[stripe] stored customer invalid, recreating:",
        subscription.stripeCustomerId,
        error instanceof Error ? error.message : error
      );
      await prisma.subscription.update({
        where: { userId },
        data: { stripeCustomerId: null },
      });
    }
  }

  try {
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
        status: "active",
      },
    });

    return customer.id;
  } catch (error) {
    throw toStripeClientError(error);
  }
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: StripePlanKey
) {
  assertStripeCheckoutReady(plan);

  if (!userId || !email) {
    throw new ApiError("Unable to create checkout session", 400);
  }

  const customerId = await getOrCreateStripeCustomer(userId, email);
  const priceId = await resolveStripePriceId(plan);
  const appUrl = getAppBaseUrl();

  try {
    // Confirm price exists in this Stripe mode before opening Checkout
    await getStripe().prices.retrieve(priceId);

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      client_reference_id: userId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${appUrl}/dashboard?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/dashboard`,
      metadata: { userId, plan, priceId },
      subscription_data: {
        metadata: { userId, plan, priceId },
      },
    });

    if (!session.url) {
      throw new ApiError("Unable to create checkout session", 502);
    }

    return session;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw toStripeClientError(error);
  }
}

export async function createBillingPortalSession(customerId: string) {
  if (!isStripeSecretConfigured()) {
    throw new ApiError("Stripe configuration error", 503);
  }

  if (!customerId) {
    throw new ApiError("No billing account yet. Upgrade to a paid plan first.", 400);
  }

  const appUrl = getAppBaseUrl();

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard`,
    });

    if (!session.url) {
      throw new ApiError("Payment system is temporarily unavailable", 502);
    }

    return session;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw toStripeClientError(error);
  }
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
  const proId = getStripePriceId("PRO");
  const businessId = getStripePriceId("BUSINESS");
  // Direct price match
  if (priceId === proId) return Plan.PRO;
  if (priceId === businessId) return Plan.BUSINESS;
  // Product id stored in env — match via retrieved price's product later; metadata preferred
  return Plan.FREE;
}

/**
 * Maps Stripe subscription → DB plan.
 * Prefers subscription metadata.plan; falls back to price/product env match.
 */
export function planFromStripeSubscription(subscription: Stripe.Subscription): Plan {
  if (!PAID_ACCESS_STATUSES.has(subscription.status)) {
    return Plan.FREE;
  }

  const metaPlan = subscription.metadata?.plan?.toUpperCase();
  if (metaPlan === "PRO") return Plan.PRO;
  if (metaPlan === "BUSINESS") return Plan.BUSINESS;

  const price = subscription.items.data[0]?.price;
  const priceId = price?.id;
  const productId =
    typeof price?.product === "string" ? price.product : price?.product?.id;

  const proCatalog = getStripeCatalogId("PRO");
  const businessCatalog = getStripeCatalogId("BUSINESS");

  if (priceId && (priceId === proCatalog || productId === proCatalog)) {
    return Plan.PRO;
  }
  if (priceId && (priceId === businessCatalog || productId === businessCatalog)) {
    return Plan.BUSINESS;
  }

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
