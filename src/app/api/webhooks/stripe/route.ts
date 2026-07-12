import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import {
  getStripe,
  handleSubscriptionDeleted,
  handleSubscriptionUpdate,
} from "@/lib/stripe";

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdate(sub);
      const userId = sub.metadata?.userId;
      if (userId && event.type === "customer.subscription.created") {
        void trackEvent({
          type: "subscription.upgraded",
          userId,
          metadata: { status: sub.status, source: event.type },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(sub);
      if (sub.metadata?.userId) {
        void trackEvent({
          type: "subscription.canceled",
          userId: sub.metadata.userId,
          metadata: { status: sub.status },
        });
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const subscription = await getStripe().subscriptions.retrieve(
          invoice.subscription as string
        );
        await handleSubscriptionUpdate(subscription);
      }
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription && session.metadata?.userId) {
        const subscription = await getStripe().subscriptions.retrieve(
          session.subscription as string
        );
        await handleSubscriptionUpdate(subscription);
        void trackEvent({
          type: "subscription.upgraded",
          userId: session.metadata.userId,
          metadata: {
            plan: session.metadata.plan ?? null,
            source: "checkout.session.completed",
          },
        });
      }
      break;
    }
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const existing = await prisma.processedStripeEvent.findUnique({
    where: { id: event.id },
  });

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await processStripeEvent(event);
    await prisma.processedStripeEvent.create({ data: { id: event.id } });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Stripe webhook processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
