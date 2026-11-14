import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { hashSecret } from "@/lib/access/secrets";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { assertMonitorOwnedBy, assertMonitorReadable } from "@/lib/security/ownership";

const SIGNAL_KEEP = 50;
const SELECTOR_PATTERN = /^[a-zA-Z0-9_.:#\[\]="' >+~-]{1,120}$/;
const BLOCKED_SELECTOR = /(^|[^a-z])(input|textarea|password|select|form|contenteditable)([^a-z]|$)/i;
const SENSITIVE_MESSAGE = /password|credit card|card number|ssn|cvv/i;

export const siteEventSchema = z
  .object({
    siteKey: z.string().trim().min(20).max(200),
    kind: z.enum(["js_error", "element_missing", "element_present", "page"]),
    message: z.string().max(180).optional(),
    selector: z.string().max(120).optional(),
    text: z.string().max(50_000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "page") {
      if ((value.text?.trim().length ?? 0) < 20) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "Public page text is required" });
      }
      return;
    }
    if (value.text) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "Text is only allowed for a page report" });
    }
  });

export type SiteEventInput = z.infer<typeof siteEventSchema>;

export function buildSiteInstall(origin: string, token: string) {
  const base = origin.replace(/\/$/, "");
  const snippet = `<script src="${base}/monitor.js" data-site-key="${token}" defer></script>`;
  const serverReport = [
    `POST ${base}/api/ingest/report`,
    "Content-Type: application/json",
    "",
    JSON.stringify(
      { siteKey: token, status: 200, html: "<html><!-- the public page your server rendered --></html>" },
      null,
      2
    ),
  ].join("\n");
  return { snippet, serverReport };
}

export function createSiteTokenMaterial() {
  const token = `wfsite_${randomBytes(24).toString("base64url")}`;
  return { token, prefix: token.slice(0, 14), hash: hashSecret(token) };
}

export function originMatchesMonitor(origin: string | null, monitorUrl: string): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(monitorUrl).host;
  } catch {
    return false;
  }
}

export function safeSelector(selector: string | undefined): string | null {
  const value = selector?.trim() ?? "";
  if (!SELECTOR_PATTERN.test(value) || BLOCKED_SELECTOR.test(value)) return null;
  return value;
}

export function cleanSignalMessage(message: string | undefined): string {
  const text = (message ?? "").replace(/[\u0000-\u001F]/g, " ").trim().slice(0, 180);
  if (!text || SENSITIVE_MESSAGE.test(text)) return "error";
  return text;
}

function missingTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

function schemaUnavailable(): never {
  throw new ApiError("Database schema is out of sync. Run the site script migration.", 503);
}

export async function issueSiteToken(userId: string, monitorId: string) {
  await assertMonitorOwnedBy(userId, monitorId);
  const material = createSiteTokenMaterial();
  try {
    await prisma.siteToken.upsert({
      where: { monitorId },
      create: { monitorId, tokenHash: material.hash, prefix: material.prefix },
      update: { tokenHash: material.hash, prefix: material.prefix, revokedAt: null, createdAt: new Date() },
    });
  } catch (error) {
    if (missingTable(error)) schemaUnavailable();
    throw error;
  }
  return material;
}

export async function revokeSiteToken(userId: string, monitorId: string) {
  await assertMonitorOwnedBy(userId, monitorId);
  try {
    const updated = await prisma.siteToken.updateMany({
      where: { monitorId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (updated.count !== 1) throw new ApiError("Not found", 404);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (missingTable(error)) schemaUnavailable();
    throw error;
  }
}

export async function readSiteInstallation(userId: string, monitorId: string) {
  await assertMonitorReadable(userId, monitorId);
  try {
    const token = await prisma.siteToken.findUnique({
      where: { monitorId },
      select: { prefix: true, createdAt: true, revokedAt: true },
    });
    const signals = await prisma.siteSignal.findMany({
      where: { monitorId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, kind: true, message: true, selector: true, createdAt: true },
    });
    const recent = await prisma.snapshot.findMany({
      where: { monitorId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { metadata: true },
    });
    const scriptSeen = recent.some((item) => {
      const meta = item.metadata;
      return Boolean(
        meta &&
          typeof meta === "object" &&
          !Array.isArray(meta) &&
          (meta as { adapter?: unknown }).adapter === "site-script"
      );
    });
    return {
      active: Boolean(token && !token.revokedAt),
      prefix: token?.prefix ?? null,
      createdAt: token?.createdAt ?? null,
      scriptSeen,
      signals,
    };
  } catch (error) {
    if (missingTable(error)) schemaUnavailable();
    throw error;
  }
}

export async function acceptSiteSignal(input: { token: string; origin: string | null; event: SiteEventInput }) {
  const tokenHash = hashSecret(input.token);
  const row = await prisma.siteToken.findUnique({
    where: { tokenHash },
    select: { revokedAt: true, monitor: { select: { id: true, url: true } } },
  });
  if (!row || row.revokedAt) throw new ApiError("Not found", 404);
  if (!originMatchesMonitor(input.origin, row.monitor.url)) {
    throw new ApiError("Origin is not allowed", 403);
  }

  const message = input.event.kind === "js_error" ? cleanSignalMessage(input.event.message) : input.event.kind;
  const selector = input.event.kind === "js_error" ? null : safeSelector(input.event.selector);
  if (input.event.kind !== "js_error" && !selector) {
    throw new ApiError("Selector is not allowed", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.siteSignal.create({
      data: { monitorId: row.monitor.id, kind: input.event.kind, message, selector },
    });
    const stale = await tx.siteSignal.findMany({
      where: { monitorId: row.monitor.id },
      orderBy: { createdAt: "desc" },
      skip: SIGNAL_KEEP,
      select: { id: true },
    });
    if (stale.length > 0) {
      await tx.siteSignal.deleteMany({ where: { id: { in: stale.map((item) => item.id) } } });
    }
  });
}

export async function loadSiteSignalProblems(workspaceId: string) {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await prisma.siteSignal.findMany({
      where: {
        createdAt: { gte: since },
        kind: { in: ["js_error", "element_missing"] },
        monitor: { workspaceId },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        kind: true,
        message: true,
        selector: true,
        monitor: {
          select: {
            name: true,
            url: true,
            status: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.monitor.name,
      url: row.monitor.url,
      status: row.monitor.status,
      client: row.monitor.client,
      summary: row.kind === "js_error" ? row.message : `${row.selector} is missing`,
      importance: "HIGH" as const,
      reason: "signal" as const,
    }));
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}
