/**
 * Stripe environment configuration.
 * Fill these in `.env.local` (local) and Vercel (production). Never commit real keys.
 *
 * Required for payments:
 * - STRIPE_SECRET_KEY
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
 * - STRIPE_WEBHOOK_SECRET
 * - STRIPE_PRO_PRICE_ID
 * - STRIPE_BUSINESS_PRICE_ID
 */

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
  return Boolean(key) && !key.includes("...");
}

export function getStripePriceId(plan: StripePlanKey): string {
  const env = getStripeEnv();
  return plan === "PRO" ? env.STRIPE_PRO_PRICE_ID : env.STRIPE_BUSINESS_PRICE_ID;
}

export function getStripePublishableKey(): string {
  return getStripeEnv().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

export function assertStripeCheckoutReady(plan: StripePlanKey): void {
  if (!isStripeSecretConfigured()) {
    throw new Error(
      "Payments are not configured yet. Add STRIPE_SECRET_KEY to your environment."
    );
  }
  const priceId = getStripePriceId(plan);
  if (!priceId || priceId.includes("...")) {
    throw new Error(
      `Stripe price ID missing for ${plan}. Set STRIPE_${plan}_PRICE_ID in the environment.`
    );
  }
}
