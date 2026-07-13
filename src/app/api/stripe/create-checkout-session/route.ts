import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { apiErrorResponse } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import {
  createBillingPortalSession,
  createCheckoutSession,
  hasActiveStripeSubscription,
} from "@/lib/stripe";
import { isStripeSecretConfigured } from "@/lib/stripe-config";

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
    return withRateLimit(
      "stripe-checkout",
      async () => {
        if (!isStripeSecretConfigured()) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Payments are not configured yet. Add Stripe keys in environment variables.",
            },
            { status: 503 }
          );
        }

        const body = await parseJsonBody(request);
        const parsed = checkoutSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: "Invalid plan. Choose PRO or BUSINESS." },
            { status: 400 }
          );
        }

        // Existing subscribers change plans via Customer Portal (no fake plan upgrades)
        if (hasActiveStripeSubscription(user.subscription)) {
          const customerId = user.subscription?.stripeCustomerId;
          if (!customerId) {
            return NextResponse.json(
              { success: false, error: "Billing account missing. Contact support." },
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
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
