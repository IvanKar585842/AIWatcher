import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { classifyMonitoringError } from "@/lib/monitoring/error-messages";
import { assertMonitorOwnedBy } from "@/lib/security/ownership";
import { installSystemCa } from "@/lib/security/system-ca";
import { assertSafeFetchUrl, fetchValidated } from "@/lib/security/url";
import { publishedEgressIps } from "@/lib/monitoring/egress";

const FETCH_TIMEOUT_MS = 8000;
const FILE_BYTES = 256;
const PAGE_BYTES = 200_000;
const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_FILE_PATH = "/.well-known/watchflowing-verify.txt";

export type VerificationMethod = "dns" | "file" | "meta";

export type ProbeBody =
  | { status: number; body: string; redirected: boolean }
  | { error: string };

export function createVerificationToken() {
  return `wfverify_${randomBytes(18).toString("base64url")}`;
}

export function verificationFilePath(filePath?: string | null): string {
  const path = filePath?.trim() || DEFAULT_FILE_PATH;
  if (!path.startsWith("/") || path.includes("..") || path.includes("\\") || path.includes("://")) {
    return DEFAULT_FILE_PATH;
  }
  return path;
}

export function verificationTargets(monitorUrl: string, filePath?: string | null) {
  const url = new URL(monitorUrl);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const path = verificationFilePath(filePath);
  const fileUrl = new URL(path, `${url.protocol}//${host}`);
  if (fileUrl.hostname.toLowerCase() !== host) {
    throw new Error("The verification file must stay on the monitored host");
  }
  return {
    host,
    txtName: `_watchflowing-verification.${host}`,
    pageUrl: url.toString(),
    filePath: path,
    fileUrl: fileUrl.toString(),
  };
}

export function isVerificationExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  return expiresAt != null && expiresAt.getTime() <= now.getTime();
}

export function dnsTokenPresent(records: string[], token: string): boolean {
  const prefixed = `watchflowing-verify=${token}`;
  return records.some((record) => {
    const value = record.trim();
    return value === token || value === prefixed;
  });
}

export function fileTokenPresent(body: ProbeBody, token: string): boolean {
  if ("error" in body || body.redirected || body.status !== 200) return false;
  return body.body.trim() === token;
}

export function metaTokenPresent(body: ProbeBody, token: string): boolean {
  if ("error" in body || body.redirected || body.status !== 200) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta\\b[^>]*name=["']watchflowing-verify["'][^>]*content=["']${escaped}["'][^>]*>|<meta\\b[^>]*content=["']${escaped}["'][^>]*name=["']watchflowing-verify["'][^>]*>`,
    "i"
  );
  return pattern.test(body.body);
}

export function matchVerification(input: { token: string; dnsRecords: string[]; file: ProbeBody; page: ProbeBody }):
  | { method: VerificationMethod }
  | { error: string } {
  if (dnsTokenPresent(input.dnsRecords, input.token)) return { method: "dns" };
  if (fileTokenPresent(input.file, input.token)) return { method: "file" };
  if (metaTokenPresent(input.page, input.token)) return { method: "meta" };
  return {
    error: "The domain did not present the token in DNS, the verification file, or a meta tag.",
  };
}

export function refusalGuidance(errorMessage: string | null | undefined, verified: boolean): string | null {
  if (!errorMessage) return null;
  const info = classifyMonitoringError(errorMessage);
  if (info.kind !== "BLOCKED" && info.kind !== "AUTH_REQUIRED" && info.kind !== "ROBOTS_BLOCKED") return null;
  if (info.kind === "ROBOTS_BLOCKED") {
    return "The site's robots.txt disallows this check. Watchflowing keeps that refusal.";
  }
  if (verified) {
    return "This domain is verified. The page still refused the check. Verification does not bypass that protection.";
  }
  return "Watchflowing does not bypass this refusal. If you own the site, send the public page from your server.";
}

function missingTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

function schemaUnavailable(): never {
  throw new ApiError("Database schema is out of sync. Run the domain verification migration.", 503);
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    size += step.value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const text = new TextDecoder().decode(Buffer.concat(chunks));
  return text.slice(0, maxBytes);
}

export async function fetchVerificationUrl(url: string, maxBytes: number): Promise<ProbeBody> {
  try {
    const safe = await assertSafeFetchUrl(url);
    installSystemCa();
    const response = await fetchValidated(safe, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined);
      return { status: response.status, body: "", redirected: true };
    }
    const body = await readLimited(response, maxBytes);
    return { status: response.status, body, redirected: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The verification request failed";
    return { error: message.slice(0, 180) };
  }
}

export async function lookupVerificationTxt(host: string): Promise<{ records: string[]; temporaryError: string | null }> {
  const names = host.startsWith("_watchflowing-verification.")
    ? [host]
    : [`_watchflowing-verification.${host}`, host];
  const records: string[] = [];
  let temporaryError: string | null = null;
  for (const name of names) {
    try {
      const found = await resolveTxt(name);
      records.push(...found.map((parts) => parts.join("")));
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "ENOTFOUND" || code === "ENODATA" || code === "ENOENT" || code === "ENOTXT") continue;
      temporaryError = "DNS is not ready yet. Wait for the record to spread, then check again.";
    }
  }
  return { records, temporaryError: records.length > 0 ? null : temporaryError };
}

function challengeExpiry(now = new Date()): Date {
  return new Date(now.getTime() + CHALLENGE_TTL_MS);
}

function newFilePath(): string {
  return `/watchflowing-verify-${randomBytes(9).toString("base64url")}.txt`;
}

async function assertHostAvailable(userId: string, monitorUrl: string) {
  const host = new URL(monitorUrl).hostname.toLowerCase();
  const rows = await prisma.domainVerification.findMany({
    where: { verifiedAt: { not: null }, monitor: { userId: { not: userId } } },
    select: { monitor: { select: { url: true } } },
  });
  const taken = rows.some((row) => {
    try {
      return new URL(row.monitor.url).hostname.toLowerCase() === host;
    } catch {
      return false;
    }
  });
  if (taken) throw new ApiError("This domain is already verified on another account", 409);
}

export async function readDomainVerification(userId: string, monitorId: string) {
  const monitor = await assertMonitorOwnedBy(userId, monitorId);
  try {
    const row = await prisma.domainVerification.findUnique({
      where: { monitorId },
      select: {
        token: true,
        verifiedAt: true,
        method: true,
        checkedAt: true,
        lastError: true,
        expiresAt: true,
        filePath: true,
      },
    });
    const targets = verificationTargets(monitor.url, row?.filePath);
    return {
      token: row?.token ?? null,
      verifiedAt: row?.verifiedAt ?? null,
      method: row?.method ?? null,
      checkedAt: row?.checkedAt ?? null,
      lastError: row?.lastError ?? null,
      expiresAt: row?.expiresAt ?? null,
      expired: isVerificationExpired(row?.expiresAt),
      guidance: refusalGuidance(monitor.errorMessage, Boolean(row?.verifiedAt)),
      egressIps: publishedEgressIps(),
      targets,
    };
  } catch (error) {
    if (missingTable(error)) schemaUnavailable();
    throw error;
  }
}

export async function issueDomainVerification(userId: string, monitorId: string, options?: { renew?: boolean }) {
  const monitor = await assertMonitorOwnedBy(userId, monitorId);
  await assertHostAvailable(userId, monitor.url);
  const token = createVerificationToken();
  const filePath = newFilePath();
  const expiresAt = challengeExpiry();
  try {
    const row = await prisma.domainVerification.findUnique({
      where: { monitorId },
      select: { id: true, token: true, expiresAt: true, verifiedAt: true },
    });
    if (row && !options?.renew && !isVerificationExpired(row.expiresAt)) {
      return { token: row.token, created: false };
    }
    if (row) {
      await prisma.domainVerification.update({
        where: { monitorId },
        data: { token, filePath, expiresAt, verifiedAt: null, method: null, lastError: null, checkedAt: null },
      });
      return { token, created: false, renewed: true };
    }
    await prisma.domainVerification.create({ data: { monitorId, token, filePath, expiresAt } });
    return { token, created: true };
  } catch (error) {
    if (missingTable(error)) schemaUnavailable();
    if (error instanceof ApiError) throw error;
    throw error;
  }
}

export async function checkDomainVerification(userId: string, monitorId: string) {
  const monitor = await assertMonitorOwnedBy(userId, monitorId);
  await assertSafeFetchUrl(monitor.url);
  await assertHostAvailable(userId, monitor.url);
  let row = await prisma.domainVerification.findUnique({
    where: { monitorId },
    select: { expiresAt: true, verifiedAt: true, filePath: true, token: true },
  });
  if (!row) {
    await issueDomainVerification(userId, monitorId);
    row = await prisma.domainVerification.findUnique({
      where: { monitorId },
      select: { expiresAt: true, verifiedAt: true, filePath: true, token: true },
    });
  }
  if (!row) throw new ApiError("Create the domain check first", 404);
  if (isVerificationExpired(row.expiresAt)) {
    const lastError = "The verification token expired. Create a new token and publish it again.";
    await prisma.domainVerification.update({
      where: { monitorId },
      data: { checkedAt: new Date(), verifiedAt: null, method: null, lastError },
    });
    return { verified: false, method: null, lastError };
  }
  const targets = verificationTargets(monitor.url, row.filePath);
  const [dns, file, page] = await Promise.all([
    lookupVerificationTxt(targets.host),
    fetchVerificationUrl(targets.fileUrl, FILE_BYTES),
    fetchVerificationUrl(targets.pageUrl, PAGE_BYTES),
  ]);
  if (dns.temporaryError && !fileTokenPresent(file, row.token) && !metaTokenPresent(page, row.token)) {
    await prisma.domainVerification.update({
      where: { monitorId },
      data: { checkedAt: new Date(), lastError: dns.temporaryError },
    });
    return { verified: Boolean(row.verifiedAt), method: null, lastError: dns.temporaryError };
  }
  const matched = matchVerification({ token: row.token, dnsRecords: dns.records, file, page });
  const verified = "method" in matched;
  const lastError = verified ? null : matched.error;
  try {
    await prisma.domainVerification.update({
      where: { monitorId },
      data: {
        checkedAt: new Date(),
        verifiedAt: verified ? new Date() : null,
        method: verified ? matched.method : null,
        lastError,
      },
    });
  } catch (error) {
    if (missingTable(error)) schemaUnavailable();
    throw error;
  }
  if (verified) {
    try {
      const { processMonitor } = await import("@/lib/monitoring/processor");
      await processMonitor(monitorId, { force: true });
    } catch {
      // The domain is verified. A blocked page stays a failed check and keeps the last good snapshot.
    }
  }
  return { verified, method: verified ? matched.method : null, lastError };
}

export async function revokeDomainVerification(userId: string, monitorId: string) {
  await assertMonitorOwnedBy(userId, monitorId);
  try {
    await prisma.domainVerification.deleteMany({ where: { monitorId } });
  } catch (error) {
    if (missingTable(error)) schemaUnavailable();
    throw error;
  }
}
