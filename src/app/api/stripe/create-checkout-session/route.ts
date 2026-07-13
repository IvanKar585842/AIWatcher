import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { apiErrorResponse } from "@/lib/api-response";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import {
  createBillingPortalSession,
  createCheckoutSession,
  hasActiveStripeSubscription,
} from "@/lib/stripe";
import { isStripeSecretConfigured } from "@/lib/stripe-config";
import { toStripeClientError } from "@/lib/stripe-errors";

const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

/**
 * POST /api/stripe/create-checkout-session
 * Body: { plan: "PRO" | "BUSINESS" }
 * Returns: { url } → Stripe Checkout
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return await withRateLimit(
      "stripe-checkout",
      async () => {
        if (!isStripeSecretConfigured()) {
          return NextResponse.json(
            { success: false, error: "Stripe configuration error" },
            { status: 503 }
          );
        }

        if (!user?.id || !user.email) {
          return NextResponse.json(
            { success: false, error: "Unable to create checkout session" },
            { status: 400 }
          );
        }

        // Ensure Subscription row exists before Stripe customer create
        if (!user.subscription) {
          const { prisma } = await import("@/lib/db");
          const { Plan } = await import("@prisma/client");
          await prisma.subscription.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id, plan: Plan.FREE, status: "active" },
          });
        }

        let body: unknown;
        try {
          body = await parseJsonBody(request);
        } catch {
          return NextResponse.json(
            { success: false, error: "Invalid plan. Choose PRO or BUSINESS." },
            { status: 400 }
          );
        }

        const parsed = checkoutSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: "Invalid plan. Choose PRO or BUSINESS." },
            { status: 400 }
          );
        }

        try {
          // Existing subscribers change plans via Customer Portal
          if (hasActiveStripeSubscription(user.subscription)) {
            const customerId = user.subscription?.stripeCustomerId;
            if (!customerId) {
              return NextResponse.json(
                {
                  success: false,
                  error: "Billing account missing. Contact support.",
                },
                { status: 400 }
              );
            }
            const portal = await createBillingPortalSession(customerId);
            return NextResponse.json({
              success: true,
              url: portal.url,
              mode: "portal",
            });
          }

          const session = await createCheckoutSession(
            user.id,
            user.email,
            parsed.data.plan
          );

          void trackEvent({
            type: "checkout.started",
            userId: user.id,
            metadata: { plan: parsed.data.plan, sessionId: session.id },
          });

          return NextResponse.json({
            success: true,
            url: session.url,
            sessionId: session.id,
          });
        } catch (error) {
          throw error instanceof ApiError ? error : toStripeClientError(error);
        }
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(
      error instanceof ApiError ? error : toStripeClientError(error)
    );
  }
}
