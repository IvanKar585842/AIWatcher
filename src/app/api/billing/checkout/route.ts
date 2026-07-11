import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import {
  createBillingPortalSession,
  createCheckoutSession,
} from "@/lib/stripe";
import { isStripePaymentsEnabled, isStripeSecretConfigured } from "@/lib/stripe-config";

const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "billing-checkout",
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

        const session = await createCheckoutSession(
          user.id,
          user.email,
          parsed.data.plan
        );

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

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "billing-portal",
      async () => {
        if (!isStripeSecretConfigured()) {
          return NextResponse.json(
            {
              success: false,
              error: "Payments are not configured yet.",
            },
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

        const session = await createBillingPortalSession(customerId);
        return NextResponse.json({ success: true, url: session.url });
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** Lightweight readiness probe used by billing UI. */
export async function HEAD() {
  return new NextResponse(null, {
    status: isStripePaymentsEnabled() ? 204 : 503,
  });
}
