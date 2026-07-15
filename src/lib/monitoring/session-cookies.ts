import type { Cookie } from "playwright-core";
import {
  canEncryptSecrets,
  decryptSecret,
  encryptSecret,
} from "@/lib/security/secrets";
import type { MonitorConfig } from "@/lib/monitor-config";
import { parseMonitorConfig } from "@/lib/monitor-config";

const MAX_COOKIES = 80;
const MAX_PAYLOAD_CHARS = 48_000;

export type PlaywrightCookieInput = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
};

function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Cookie domain may be ".example.com" or "www.example.com". */
export function cookieMatchesHost(cookieDomain: string | undefined, host: string): boolean {
  if (!cookieDomain) return true;
  const d = cookieDomain.replace(/^\./, "").toLowerCase();
  return host === d || host.endsWith(`.${d}`);
}

export function parseSessionCookiesJson(raw: string): PlaywrightCookieInput[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(
      "Session cookies must be valid JSON (array of { name, value, domain?, path? })"
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Session cookies JSON must be an array");
  }

  if (parsed.length > MAX_COOKIES) {
    throw new Error(`At most ${MAX_COOKIES} cookies are allowed per monitor`);
  }

  const cookies: PlaywrightCookieInput[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const value = typeof row.value === "string" ? row.value : "";
    if (!name || value.length === 0) continue;

    const domain = typeof row.domain === "string" ? row.domain : undefined;
    const path = typeof row.path === "string" ? row.path : "/";
    const expires =
      typeof row.expires === "number" && Number.isFinite(row.expires)
        ? row.expires
        : typeof row.expirationDate === "number"
          ? row.expirationDate
          : undefined;

    let sameSite: PlaywrightCookieInput["sameSite"];
    if (row.sameSite === "Strict" || row.sameSite === "Lax" || row.sameSite === "None") {
      sameSite = row.sameSite;
    }

    cookies.push({
      name: name.slice(0, 256),
      value: value.slice(0, 4096),
      domain,
      path: path.slice(0, 512) || "/",
      expires,
      httpOnly: Boolean(row.httpOnly),
      secure: row.secure !== false,
      sameSite,
    });
  }

  if (cookies.length === 0) {
    throw new Error("No valid cookies found in session JSON");
  }

  return cookies;
}

export function assertCookiesForMonitorUrl(
  cookies: PlaywrightCookieInput[],
  monitorUrl: string
): void {
  const host = hostnameFromUrl(monitorUrl);
  if (!host) throw new Error("Invalid monitor URL for session cookies");

  for (const c of cookies) {
    if (c.domain && !cookieMatchesHost(c.domain, host)) {
      throw new Error(
        `Cookie "${c.name}" domain (${c.domain}) does not match monitor host (${host})`
      );
    }
  }
}

export function encryptSessionCookies(
  cookies: PlaywrightCookieInput[],
  userId: string
): string {
  if (!canEncryptSecrets()) {
    throw new Error(
      "Encrypted sessions require MONITOR_SESSION_SECRET or CRON_SECRET to be configured"
    );
  }
  const json = JSON.stringify(cookies);
  if (json.length > MAX_PAYLOAD_CHARS) {
    throw new Error("Session cookie payload is too large");
  }
  return encryptSecret(json, userId);
}

export function decryptSessionCookies(
  encrypted: string,
  userId: string
): PlaywrightCookieInput[] {
  const json = decryptSecret(encrypted, userId);
  return parseSessionCookiesJson(json);
}

export function toPlaywrightCookies(
  cookies: PlaywrightCookieInput[],
  monitorUrl: string
): Cookie[] {
  const host = hostnameFromUrl(monitorUrl) ?? "localhost";
  const now = Math.floor(Date.now() / 1000);

  return cookies.map((c) => {
    const expires =
      typeof c.expires === "number" && c.expires > 0 ? Math.floor(c.expires) : -1;
    return {
      name: c.name,
      value: c.value,
      domain: c.domain?.replace(/^\./, "") ? c.domain : host,
      path: c.path || "/",
      expires,
      httpOnly: Boolean(c.httpOnly),
      secure: c.secure !== false,
      sameSite: c.sameSite ?? "Lax",
    };
  }).filter((c) => c.expires === -1 || c.expires > now);
}

export function cookiesFromBrowser(cookies: Cookie[]): PlaywrightCookieInput[] {
  return cookies.slice(0, MAX_COOKIES).map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite:
      c.sameSite === "Strict" || c.sameSite === "Lax" || c.sameSite === "None"
        ? c.sameSite
        : "Lax",
  }));
}

export function isSessionExpired(config: MonitorConfig, now = Date.now()): boolean {
  if (!config.encryptedSession) return false;
  if (!config.sessionExpiresAt) return false;
  const ts = Date.parse(config.sessionExpiresAt);
  if (!Number.isFinite(ts)) return false;
  return ts <= now;
}

/**
 * Merge incoming config with existing, encrypting write-only session cookies.
 * Never stores plaintext cookies. Sessions are scoped to userId via AAD.
 */
export function prepareMonitorConfigForStorage(options: {
  incoming: MonitorConfig | null | undefined;
  existing: unknown;
  userId: string;
  monitorUrl: string;
}): MonitorConfig {
  const base = parseMonitorConfig(options.existing);
  const incoming = options.incoming ? { ...options.incoming } : {};
  const merged: MonitorConfig = { ...base, ...incoming };

  // Client must never set/overwrite ciphertext directly
  delete (merged as { sessionCookiesPlain?: string }).sessionCookiesPlain;
  if (incoming.encryptedSession === undefined) {
    merged.encryptedSession = base.encryptedSession;
  }

  if (incoming.clearSession) {
    delete merged.encryptedSession;
    merged.sessionStatus = "none";
    merged.sessionExpiresAt = null;
    delete merged.clearSession;
    return merged;
  }
  delete merged.clearSession;

  const plain = incoming.sessionCookiesPlain;
  if (typeof plain === "string") {
    if (!plain.trim()) {
      delete merged.encryptedSession;
      merged.sessionStatus = "none";
      merged.sessionExpiresAt = null;
    } else {
      const cookies = parseSessionCookiesJson(plain);
      assertCookiesForMonitorUrl(cookies, options.monitorUrl);
      merged.encryptedSession = encryptSessionCookies(cookies, options.userId);
      merged.sessionStatus = "active";
    }
  }

  delete (merged as { sessionCookiesPlain?: string }).sessionCookiesPlain;

  if (merged.encryptedSession && !merged.sessionStatus) {
    merged.sessionStatus = "active";
  }

  return merged;
}

/** Strip secrets before sending config to the browser/client. */
export function sanitizeMonitorConfigForClient(raw: unknown): MonitorConfig {
  const cfg = parseMonitorConfig(raw);
  const hasSession = Boolean(cfg.encryptedSession);
  const {
    encryptedSession: _enc,
    sessionCookiesPlain: _plain,
    clearSession: _clear,
    ...rest
  } = cfg;
  return {
    ...rest,
    hasSession,
    sessionStatus: hasSession ? cfg.sessionStatus ?? "active" : "none",
  };
}
