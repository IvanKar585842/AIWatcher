import Stripe from "stripe";
import { trackEvent } from "@/lib/analytics";
import {
  getStripe,
  handleSubscriptionDeleted,
  handleSubscriptionUpdate,
} from "@/lib/stripe";

/**
 * Shared Stripe webhook event processor.
 * Used by /api/webhooks/stripe and /api/stripe/webhook.
 */
export async function processStripeEvent(event: Stripe.Event): Promise<void> {
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
    default:
      break;
  }
}
