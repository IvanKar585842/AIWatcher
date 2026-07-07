import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse, parseJsonBody } from "@/lib/errors";
import { createCheckoutSession, createBillingPortalSession } from "@/lib/stripe";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "billing-checkout",
      async () => {
        const body = await parseJsonBody(request);
        const parsed = checkoutSchema.safeParse(body);

        if (!parsed.success) {
          return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
        }

        const session = await createCheckoutSession(user.id, user.email, parsed.data.plan);
        return NextResponse.json({ url: session.url });
      },
      user.id
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
        const customerId = user.subscription?.stripeCustomerId;

        if (!customerId) {
          return NextResponse.json({ error: "No billing account found" }, { status: 400 });
        }

        const session = await createBillingPortalSession(customerId);
        return NextResponse.json({ url: session.url });
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
