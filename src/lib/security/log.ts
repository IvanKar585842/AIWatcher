/**
 * Structured security audit logs for admins / ops.
 * Never throws — logging must not break request flow.
 */

export type SecurityEventType =
  | "rate_limit.exceeded"
  | "url.blocked"
  | "ownership.denied"
  | "auth.failed"
  | "quota.exceeded"
  | "suspicious.activity"
  | "resource.throttled"
  | "request.failed"
  | "failsafe.activated";

export type SecurityLogPayload = {
  type: SecurityEventType;
  message: string;
  userId?: string | null;
  route?: string;
  resourceId?: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
};

function formatLine(payload: SecurityLogPayload & { timestamp: string }): string {
  const parts = [
    "[security]",
    `[${payload.type}]`,
    payload.userId ? `user=${payload.userId}` : null,
    payload.route ? `route=${payload.route}` : null,
    payload.resourceId ? `resource=${payload.resourceId}` : null,
    payload.message,
  ].filter(Boolean);
  return parts.join(" ");
}

export function securityLog(payload: SecurityLogPayload): void {
  try {
    const entry = {
      ...payload,
      timestamp: new Date().toISOString(),
    };
    console.warn(formatLine(entry), payload.metadata ? JSON.stringify(payload.metadata) : "");
  } catch {
    // never throw
  }
}
