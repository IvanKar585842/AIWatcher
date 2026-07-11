import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { securityLog } from "@/lib/security/log";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "::1",
  "metadata.google.internal",
  "metadata.google",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home", ".corp"];

/** IPv4 private / reserved / link-local / CGNAT / loopback */
function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local
  // IPv4-mapped IPv6 ::ffff:x.x.x.x
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

function isBlockedIpLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  const version = isIP(host);
  if (version === 4) return isBlockedIpv4(host);
  if (version === 6) return isBlockedIpv6(host);
  return false;
}

/** Reject decimal / octal / hex IP tricks (e.g. http://2130706433) */
function looksLikeNumericHostTrick(hostname: string): boolean {
  if (/^\d+$/.test(hostname)) return true;
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true;
  return false;
}

export function validateMonitorUrl(
  urlString: string
): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(urlString.trim());
  } catch {
    return { ok: false, error: "Invalid URL format" };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false, error: "Only HTTP and HTTPS URLs are allowed" };
  }

  if (url.username || url.password) {
    return { ok: false, error: "URLs with credentials are not allowed" };
  }

  const hostname = url.hostname.toLowerCase();

  if (!hostname || looksLikeNumericHostTrick(hostname)) {
    return { ok: false, error: "This URL is not allowed for monitoring" };
  }

  if (BLOCKED_HOSTS.has(hostname)) {
    return { ok: false, error: "This URL is not allowed for monitoring" };
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    return { ok: false, error: "Internal hostnames are not allowed" };
  }

  if (isBlockedIpLiteral(hostname)) {
    return { ok: false, error: "Private network addresses are not allowed" };
  }

  return { ok: true, url };
}

/**
 * Re-validate at fetch time and resolve DNS to catch public hostnames
 * that point at private IPs (SSRF / DNS rebinding).
 */
export async function assertSafeFetchUrl(urlString: string): Promise<URL> {
  const validated = validateMonitorUrl(urlString);
  if (!validated.ok) {
    securityLog({
      type: "url.blocked",
      message: validated.error,
      metadata: { url: urlString.slice(0, 200) },
    });
    throw new Error(validated.error);
  }

  const { url } = validated;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (isBlockedIpLiteral(hostname)) {
    securityLog({
      type: "url.blocked",
      message: "Blocked private IP at fetch time",
      metadata: { hostname },
    });
    throw new Error("Private network addresses are not allowed");
  }

  // Hostname already an IP — done
  if (isIP(hostname)) {
    return url;
  }

  try {
    const results = await lookup(hostname, { all: true });
    for (const result of results) {
      if (isBlockedIpLiteral(result.address)) {
        securityLog({
          type: "url.blocked",
          message: "Hostname resolved to private/reserved IP",
          metadata: { hostname, address: result.address },
        });
        throw new Error("This URL resolves to a private network address and cannot be monitored");
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("private network")) {
      throw error;
    }
    // DNS failure: fail closed for monitoring fetches
    securityLog({
      type: "url.blocked",
      message: "DNS lookup failed for monitor URL",
      metadata: {
        hostname,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw new Error("Could not resolve URL hostname for security validation");
  }

  return url;
}
