import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { createBillingPortalSession } from "@/lib/stripe";
import { isStripeSecretConfigured } from "@/lib/stripe-config";
import { toStripeClientError } from "@/lib/stripe-errors";

/**
 * POST /api/stripe/create-portal-session
 * Opens Stripe Customer Portal (payment method, cancel, invoices).
 */
export async function POST() {
  try {
    const user = await requireUser();
    return await withRateLimit(
      "stripe-portal",
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
