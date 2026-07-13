/**
 * Stripe environment configuration.
 * Vercel env (server-only except publishable key):
 * - STRIPE_PRO_PRICE_ID      → Price id (price_…) or Product id (prod_…) for Pro
 * - STRIPE_BUSINESS_PRICE_ID → Price id (price_…) or Product id (prod_…) for Business
 */

import { ApiError } from "@/lib/errors";

export type StripePlanKey = "PRO" | "BUSINESS";

const STRIPE_ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_BUSINESS_PRICE_ID",
] as const;

export type StripeEnvKey = (typeof STRIPE_ENV_KEYS)[number];

export function getStripeEnv(): Record<StripeEnvKey, string> {
  return {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY?.trim() ?? "",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "",
    STRIPE_PRO_PRICE_ID: process.env.STRIPE_PRO_PRICE_ID?.trim() ?? "",
    STRIPE_BUSINESS_PRICE_ID: process.env.STRIPE_BUSINESS_PRICE_ID?.trim() ?? "",
  };
}

export function getMissingStripeEnvKeys(): StripeEnvKey[] {
  const env = getStripeEnv();
  return STRIPE_ENV_KEYS.filter((key) => !env[key] || env[key].includes("..."));
}

/** True when checkout + webhooks can run end-to-end. */
export function isStripePaymentsEnabled(): boolean {
  return getMissingStripeEnvKeys().length === 0;
}

/** Secret key present — enough to talk to Stripe API (checkout). */
export function isStripeSecretConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  return Boolean(key) && !key.includes("...") && key.startsWith("sk_");
}

/** Raw env value for a plan — may be price_… or prod_… */
export function getStripeCatalogId(plan: StripePlanKey): string {
  const env = getStripeEnv();
  return plan === "PRO" ? env.STRIPE_PRO_PRICE_ID : env.STRIPE_BUSINESS_PRICE_ID;
}

/** @deprecated use getStripeCatalogId — kept for existing imports */
export function getStripePriceId(plan: StripePlanKey): string {
  return getStripeCatalogId(plan);
}

export function isStripeCatalogIdConfigured(plan: StripePlanKey): boolean {
  const id = getStripeCatalogId(plan);
  if (!id || id.includes("...")) return false;
  return id.startsWith("price_") || id.startsWith("prod_");
}

/** Checkout can start when secret + plan catalog ids are set (webhook not required). */
export function isStripeCheckoutReady(plan?: StripePlanKey): boolean {
  if (!isStripeSecretConfigured()) return false;
  if (plan) return isStripeCatalogIdConfigured(plan);
  return (
    isStripeCatalogIdConfigured("PRO") && isStripeCatalogIdConfigured("BUSINESS")
  );
}

export function getStripePublishableKey(): string {
  return getStripeEnv().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

export function assertStripeCheckoutReady(plan: StripePlanKey): void {
  if (!isStripeSecretConfigured()) {
    throw new ApiError("Stripe configuration error", 503);
  }
  if (!isStripeCatalogIdConfigured(plan)) {
    throw new ApiError("Stripe configuration error", 503);
  }

  const secret = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  const secretLive = secret.startsWith("sk_live_");
  const secretTest = secret.startsWith("sk_test_");
  const pkLive = publishable.startsWith("pk_live_");
  const pkTest = publishable.startsWith("pk_test_");
  if (publishable && ((secretLive && pkTest) || (secretTest && pkLive))) {
    throw new ApiError("Stripe configuration error", 503);
  }
}
