import { createHmac } from "node:crypto";
import { assertSafeFetchUrl, validateMonitorUrl } from "@/lib/security/url";

export interface ChangeWebhookPayload {
  id: string;
  monitorId: string;
  monitorName: string;
  url: string;
  summary: string;
  importance: string;
  category: string;
  changes: string[];
  detectedAt: string;
}

export function assertWebhookTarget(raw: string): URL {
  const checked = validateMonitorUrl(raw);
  if (!checked.ok) throw new Error(checked.error);
  if (checked.url.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }
  return checked.url;
}

export function signWebhookBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function webhookSignatureHeader(secret: string, timestamp: string, body: string): string {
  return `sha256=${signWebhookBody(secret, timestamp, body)}`;
}

export function buildChangeWebhookPayload(input: {
  changeId: string;
  monitorId: string;
  monitorName: string;
  url: string;
  summary: string;
  importance: string;
  category: string;
  changes: string[];
  detectedAt?: Date;
}): ChangeWebhookPayload {
  return {
    id: input.changeId,
    monitorId: input.monitorId,
    monitorName: input.monitorName,
    url: input.url,
    summary: input.summary,
    importance: input.importance,
    category: input.category,
    changes: input.changes.slice(0, 20),
    detectedAt: (input.detectedAt ?? new Date()).toISOString(),
  };
}

export async function deliverCustomerWebhook(input: {
  url: string;
  secret: string;
  payload: ChangeWebhookPayload;
  transport?: (url: string, init: RequestInit) => Promise<Response>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  let target: URL;
  try {
    target = assertWebhookTarget(input.url);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid webhook URL" };
  }

  const body = JSON.stringify(input.payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const init: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "WatchFlowing-Webhook/1.0",
      "x-watchflowing-timestamp": timestamp,
      "x-watchflowing-signature": webhookSignatureHeader(input.secret, timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(8_000),
  };

  try {
    const response = input.transport
      ? await input.transport(target.toString(), init)
      : await fetchAfterSafeCheck(target.toString(), init);
    if (!response.ok) {
      return { ok: false, error: `Webhook responded HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Webhook delivery failed" };
  }
}

async function fetchAfterSafeCheck(url: string, init: RequestInit): Promise<Response> {
  await assertSafeFetchUrl(url);
  const { fetchWithSafeRedirects } = await import("@/lib/security/url");
  return fetchWithSafeRedirects(url, init);
}
