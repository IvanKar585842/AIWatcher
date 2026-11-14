import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { classifyMonitoringError } from "@/lib/monitoring/error-messages";
import { assertMonitorOwnedBy } from "@/lib/security/ownership";
import { installSystemCa } from "@/lib/security/system-ca";
import { assertSafeFetchUrl } from "@/lib/security/url";

const FETCH_TIMEOUT_MS = 8000;
const FILE_BYTES = 256;
const PAGE_BYTES = 200_000;

export type VerificationMethod = "dns" | "file" | "meta";

export type ProbeBody =
  | { status: number; body: string; redirected: boolean }
  | { error: string };

export function createVerificationToken() {
  return `wfverify_${randomBytes(18).toString("base64url")}`;
}

export function verificationTargets(monitorUrl: string) {
  const url = new URL(monitorUrl);
  const fileUrl = new URL("/.well-known/watchflowing-verify.txt", `${url.protocol}//${url.host}`);
  return { host: url.hostname.replace(/^\[|\]$/g, ""), pageUrl: url.toString(), fileUrl: fileUrl.toString() };
}

export function dnsTokenPresent(records: string[], token: string): boolean {
  const expected = `watchflowing-verify=${token}`;
  return records.some((record) => record.trim() === expected);
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
    return "This domain is verified. The public page still refused the check. Verification does not bypass that protection.";
  }
  return "Watchflowing does not bypass this refusal. If you own the site, verify the domain or install the site script.";
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
    const response = await fetch(safe, { redirect: "manual", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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

export async function lookupVerificationTxt(host: string): Promise<string[]> {
  try {
    const records = await resolveTxt(host);
    return records.map((parts) => parts.join(""));
  } catch {
    return [];
  }
}

export async function readDomainVerification(userId: string, monitorId: string) {
  const monitor = await assertMonitorOwnedBy(userId, monitorId);
  try {
    const row = await prisma.domainVerification.findUnique({
      where: { monitorId },
      select: { token: true, verifiedAt: true, method: true, checkedAt: true, lastError: true },
    });
    return {
      token: row?.token ?? null,
      verifiedAt: row?.verifiedAt ?? null,
      method: row?.method ?? null,
      checkedAt: row?.checkedAt ?? null,
      lastError: row?.lastError ?? null,
      guidance: refusalGuidance(monitor.errorMessage, Boolean(row?.verifiedAt)),
      targets: verificationTargets(monitor.url),
    };
  } catch (error) {
    if (missingTable(error)) schemaUnavailable();
    throw error;
  }
}

export async function issueDomainVerification(userId: string, monitorId: string) {
  await assertMonitorOwnedBy(userId, monitorId);
  const token = createVerificationToken();
  try {
    const row = await prisma.domainVerification.findUnique({ where: { monitorId }, select: { id: true, token: true } });
    if (row) return { token: row.token, created: false };
    await prisma.domainVerification.create({ data: { monitorId, token } });
    return { token, created: true };
  } catch (error) {
    if (missingTable(error)) schemaUnavailable();
    throw error;
  }
}

export async function checkDomainVerification(userId: string, monitorId: string) {
  const monitor = await assertMonitorOwnedBy(userId, monitorId);
  await assertSafeFetchUrl(monitor.url);
  const issued = await issueDomainVerification(userId, monitorId);
  const targets = verificationTargets(monitor.url);
  const [dnsRecords, file, page] = await Promise.all([
    lookupVerificationTxt(targets.host),
    fetchVerificationUrl(targets.fileUrl, FILE_BYTES),
    fetchVerificationUrl(targets.pageUrl, PAGE_BYTES),
  ]);
  const matched = matchVerification({ token: issued.token, dnsRecords, file, page });
  const verified = "method" in matched;
  try {
    await prisma.domainVerification.update({
      where: { monitorId },
      data: {
        checkedAt: new Date(),
        verifiedAt: verified ? new Date() : null,
        method: verified ? matched.method : null,
        lastError: verified ? null : matched.error,
      },
    });
  } catch (error) {
    if (missingTable(error)) schemaUnavailable();
    throw error;
  }
  return { verified, method: verified ? matched.method : null, lastError: verified ? null : matched.error };
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
