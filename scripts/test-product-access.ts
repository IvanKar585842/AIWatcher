import Stripe from "stripe";
import { createApiKey, createTeamInvite, hashSecret, inviteIsOpen, teamHasRoom, canReadTeamMonitor } from "../src/lib/access/secrets";
import { describeDeploymentSchedule } from "../src/lib/monitoring/deployment-schedule";
import { describeAlertChannels } from "../src/lib/notifications/alert-readiness";
import {
  assertWebhookTarget,
  buildChangeWebhookPayload,
  deliverCustomerWebhook,
  signWebhookBody,
} from "../src/lib/notifications/customer-webhook";

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error("FAIL", name);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

const daily = describeDeploymentSchedule({});
assert("without a worker the deployment tick is daily", daily.minutes === 24 * 60);

const worker = describeDeploymentSchedule({ MONITOR_WORKER_URL: "http://127.0.0.1:8787" });
assert("a localhost worker tick is one minute", worker.minutes === 1);

const blocked = describeDeploymentSchedule({ MONITOR_WORKER_URL: "http://worker.example" });
assert("a public http worker does not shorten the tick", blocked.minutes === 24 * 60);

const github = describeDeploymentSchedule({ MONITOR_TICK_SOURCE: "github" });
assert("the GitHub tick source is five minutes", github.minutes === 5);

const key = createApiKey("Production");
assert("an API key is shown once and stored as a hash", key.token.startsWith("wf_") && key.hash === hashSecret(key.token));
assert("the stored key is not the token", key.hash !== key.token);

const invite = createTeamInvite(new Date("2026-11-08T00:00:00.000Z"));
assert("a fresh invite can be accepted", inviteIsOpen({ expiresAt: invite.expiresAt, acceptedAt: null }, new Date("2026-11-08T01:00:00.000Z")));
assert("an accepted invite cannot be reused", inviteIsOpen({ expiresAt: invite.expiresAt, acceptedAt: new Date() }) === false);
assert("a team of 25 has no room", teamHasRoom(25, 25) === false);
assert("a team of 24 still has room", teamHasRoom(24, 25));
assert(
  "a member can read a shared monitor and a stranger cannot",
  canReadTeamMonitor({ userId: "member", ownerId: "owner", memberIds: ["owner", "member"] }) &&
    canReadTeamMonitor({ userId: "stranger", ownerId: "owner", memberIds: ["owner"] }) === false
);

let rejectedPrivate = false;
try {
  assertWebhookTarget("https://127.0.0.1/hook");
} catch {
  rejectedPrivate = true;
}
assert("a private webhook target is rejected", rejectedPrivate);

let rejectedHttp = false;
try {
  assertWebhookTarget("http://example.com/hook");
} catch {
  rejectedHttp = true;
}
assert("a webhook must use https", rejectedHttp);

async function main() {
const payload = buildChangeWebhookPayload({
  changeId: "chg",
  monitorId: "mon",
  monitorName: "Example",
  url: "https://example.com",
  summary: "Title changed",
  importance: "MEDIUM",
  category: "CONTENT",
  changes: ["Title changed"],
  detectedAt: new Date("2026-11-08T00:00:00.000Z"),
});
let signature = "";
const delivered = await deliverCustomerWebhook({
  url: "https://example.com/hook",
  secret: "test-secret",
  payload,
  transport: async (_url, init) => {
    const headers = new Headers(init.headers);
    const timestamp = headers.get("x-watchflowing-timestamp") ?? "";
    signature = headers.get("x-watchflowing-signature") ?? "";
    const expected = `sha256=${signWebhookBody("test-secret", timestamp, String(init.body))}`;
    if (signature !== expected) throw new Error("bad signature");
    return new Response(null, { status: 204 });
  },
});
assert("a webhook delivery is signed", delivered.ok === true && signature.startsWith("sha256="));

const alerts = describeAlertChannels({
  resendConfigured: false,
  hasEmail: true,
  emailEnabled: true,
  telegramTokenConfigured: false,
  telegramConnected: false,
  telegramEnabled: true,
  planAllowsTelegram: true,
  webhookConfigured: false,
  planAllowsWebhook: false,
});
assert("in-app alerts stay available when providers are missing", alerts.find((item) => item.channel === "in_app")?.ready === true);
assert("email is not ready without the email provider", alerts.find((item) => item.channel === "email")?.ready === false);
assert("webhooks stay closed on a plan that does not include them", alerts.find((item) => item.channel === "webhook")?.ready === false);

const stripeSecret = "whsec_" + Buffer.from("watchflowing-test-secret").toString("base64");
const stripe = new Stripe("sk_test_watchflowing");
const eventPayload = JSON.stringify({
  id: "evt_test_signature",
  object: "event",
  api_version: "2025-02-24.acacia",
  created: 1_700_000_000,
  type: "ping",
  livemode: false,
  pending_webhooks: 0,
  request: { id: null, idempotency_key: null },
  data: { object: { id: "ping" } },
});
const header = Stripe.webhooks.generateTestHeaderString({ payload: eventPayload, secret: stripeSecret });
const verified = stripe.webhooks.constructEvent(eventPayload, header, stripeSecret);
assert("a Stripe webhook with a valid signature is accepted", verified.id === "evt_test_signature");
let stripeRejected = false;
try {
  stripe.webhooks.constructEvent(eventPayload, `${header}x`, stripeSecret);
} catch {
  stripeRejected = true;
}
assert("a Stripe webhook with a bad signature is rejected", stripeRejected);

if (!process.exitCode) console.log("product access checks passed");
}

void main();
