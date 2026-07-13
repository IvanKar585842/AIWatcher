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
import { isStripePaymentsEnabled, isStripeSecretConfigured } from "@/lib/stripe-config";
import { toStripeClientError } from "@/lib/stripe-errors";

const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return await withRateLimit(
      "billing-checkout",
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

        const body = await parseJsonBody(request);
        const parsed = checkoutSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: "Invalid plan. Choose PRO or BUSINESS." },
            { status: 400 }
          );
        }

        try {
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

export async function GET() {
  try {
    const user = await requireUser();
    return await withRateLimit(
      "billing-portal",
      async () => {
        if (!isStripeSecretConfigured()) {
          return NextResponse.json(
            { success: false, error: "Stripe configuration error" },
            { status: 503 }
          );
        }

        const customerId = user.subscription?.stripeCustomerId;

        if (!customerId) {
          return NextResponse.json(
            {
              success: false,
              error: "No billing account yet. Upgrade to a paid plan first.",
            },
            { status: 400 }
          );
        }

        try {
          const session = await createBillingPortalSession(customerId);
          return NextResponse.json({ success: true, url: session.url });
        } catch (error) {
          throw error instanceof ApiError ? error : toStripeClientError(error);
        }
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(
      error instanceof ApiError ? error : toStripeClientError(error)
    );
  }
}

/** Lightweight readiness probe used by billing UI. */
export async function HEAD() {
  return new NextResponse(null, {
    status: isStripePaymentsEnabled() ? 204 : 503,
  });
}
