import type Stripe from "stripe";
import { isDeleteConfirmed, buildAccountExport } from "../src/lib/account";
import { snapshotKeepCount } from "../src/lib/monitoring/retention";
import { planFromStripeSubscription } from "../src/lib/stripe";

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error("FAIL", name);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

function subscription(status: string, plan?: string): Stripe.Subscription {
  return {
    status,
    metadata: plan ? { plan } : {},
    items: { data: [{ price: { id: "price_unused", product: "prod_unused" } }] },
  } as unknown as Stripe.Subscription;
}

assert("delete requires the exact word DELETE", isDeleteConfirmed("DELETE") && !isDeleteConfirmed("delete"));
assert("a canceled subscription loses paid access", planFromStripeSubscription(subscription("canceled", "PRO")) === "FREE");
assert("an unpaid invoice drops the plan to free", planFromStripeSubscription(subscription("unpaid", "BUSINESS")) === "FREE");
assert("past_due keeps the paid plan until Stripe ends it", planFromStripeSubscription(subscription("past_due", "PRO")) === "PRO");
assert("an active business subscription stays business", planFromStripeSubscription(subscription("active", "BUSINESS")) === "BUSINESS");

const exported = buildAccountExport({
  user: {
    id: "user_1",
    email: "a@example.com",
    name: "Ada",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    telegramUsername: null,
    telegramConnected: false,
    emailNotificationsEnabled: true,
    subscription: {
      plan: "PRO",
      status: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    },
  },
  monitors: [],
  changes: [],
});
assert("export includes the account email", exported.account.email === "a@example.com");
assert("export does not include a session secret", !("encryptedSession" in exported.account));
assert("official marketplace snapshots are not archived", snapshotKeepCount("amazon_creators_api") === 2);
assert("ordinary pages keep a short snapshot history", snapshotKeepCount("scrapling") === 10);

if (!process.exitCode) console.log("plan rule checks passed");
