import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createCheckoutSession, createBillingPortalSession } from "@/lib/stripe";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

export async function POST(request: NextRequest) {
  return withRateLimit("billing-checkout", async () => {
    try {
      const user = await requireUser();
      const body = await request.json();
      const parsed = checkoutSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }

      const session = await createCheckoutSession(user.id, user.email, parsed.data.plan);
      return NextResponse.json({ url: session.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function GET() {
  return withRateLimit("billing-portal", async () => {
    try {
      const user = await requireUser();
      const customerId = user.subscription?.stripeCustomerId;

      if (!customerId) {
        return NextResponse.json({ error: "No billing account found" }, { status: 400 });
      }

      const session = await createBillingPortalSession(customerId);
      return NextResponse.json({ url: session.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Portal failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
