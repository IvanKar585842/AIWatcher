import { MonitorStatus, type MonitoringMode } from "@prisma/client";
import { z } from "zod";
import { INTERVAL_MINUTES, resolveEffectiveInterval } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { getEffectivePlan } from "@/lib/admin";
import { hashSecret } from "@/lib/access/secrets";
import { originMatchesMonitor } from "@/lib/site-sdk";
import { parseMonitorConfig } from "@/lib/monitor-config";
import { cleanHtml, extractTextFromHtml } from "./content-cleaner";
import { computeContentHash } from "./compare";
import type { FetchResult } from "./fetcher";
import { serializeMonitorError, type MonitoringErrorInfo } from "./error-messages";
import { acquireMonitorLock, releaseMonitorLock } from "./lock";
import { createMonitorErrorAlert } from "@/lib/notifications/deliver";
import { persistSuccessfulCheck } from "./processor";

const SECRET_MATERIAL = /document\.cookie|set-cookie:|authorization:/i;
const EMAIL_ADDRESS = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SCRIPT_GAP_MS = 60_000;

export function sanitizePublicPageText(raw: string): string {
  const text = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").replace(/\s+/g, " ").trim();
  if (SECRET_MATERIAL.test(text)) {
    throw new ApiError("The report cannot include cookies or authorization data", 400);
  }
  const redacted = text.replace(EMAIL_ADDRESS, "[email]").slice(0, 50_000);
  if (redacted.length < 20) throw new ApiError("The public page was empty", 400);
  return redacted;
}

export const ownerReportSchema = z
  .object({
    siteKey: z.string().trim().min(20).max(200),
    status: z.number().int().min(100).max(599),
    html: z.string().max(100_000).optional(),
    text: z.string().max(60_000).optional(),
  })
  .strict();

export type OwnerReportInput = z.infer<typeof ownerReportSchema>;

function statusInfo(status: number): MonitoringErrorInfo {
  return {
    kind: "WARNING",
    title: `Your site reported HTTP ${status}`,
    description: "Your server sent this status. The last successful page snapshot was kept.",
    suggestions: ["Check the server response", "Send the public page again when the status is normal"],
    statusLabel: `HTTP ${status}`,
    technical: `HTTP ${status}`,
    tone: "amber",
    icon: "alert",
  };
}

function publicDocument(report: OwnerReportInput): string {
  const html = report.html?.trim() ?? "";
  if (html) return html;
  const text = (report.text ?? "").replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char] ?? char);
  return `<article>${text}</article>`;
}

export function buildOwnerFetchResult(mode: MonitoringMode, report: OwnerReportInput): FetchResult {
  const rawHtml = publicDocument(report);
  if (SECRET_MATERIAL.test(rawHtml)) {
    throw new ApiError("The report cannot include cookies or authorization data", 400);
  }
  const cleanedHtml = cleanHtml(rawHtml);
  const extractedText = extractTextFromHtml(cleanedHtml);
  if (extractedText.trim().length < 20 && cleanedHtml.trim().length < 20) {
    throw new ApiError("The public page was empty", 400);
  }
  const partial: FetchResult = {
    rawHtml,
    cleanedHtml,
    extractedText,
    contentHash: "",
    metadata: {
      engine: "owner",
      adapter: "owner-report",
      captureType: "owner-report",
      fetchStrategy: "owner",
      httpStatus: report.status,
      checkStatus: "success",
      browserLaunches: 0,
      resultComplete: true,
      requiresBrowser: false,
    },
  };
  return { ...partial, contentHash: computeContentHash(mode, partial) };
}

async function recordHttpStatus(monitorId: string, userId: string, status: number) {
  const info = statusInfo(status);
  await prisma.monitor.update({
    where: { id: monitorId },
    data: {
      errorMessage: serializeMonitorError(info),
      lastCheckedAt: new Date(),
    },
  });
  await createMonitorErrorAlert({
    userId,
    monitorId,
    error: info,
    errorCount: 1,
    becameErrored: false,
  });
}

/**
 * A report from the company's own server. The outside fetch is not repeated,
 * so a bot check on the public page is not asked to step aside.
 */
export async function acceptOwnerReport(report: OwnerReportInput) {
  const row = await prisma.siteToken.findUnique({
    where: { tokenHash: hashSecret(report.siteKey) },
    select: {
      revokedAt: true,
      monitor: { select: { id: true, status: true, userId: true, mode: true, interval: true } },
    },
  });
  if (!row || row.revokedAt) throw new ApiError("Not found", 404);
  if (row.monitor.status === MonitorStatus.PAUSED) throw new ApiError("This site is paused", 409);

  if (report.status >= 400) {
    await recordHttpStatus(row.monitor.id, row.monitor.userId, report.status);
    return { accepted: true, storedPage: false as const, status: report.status };
  }

  const document = publicDocument(report);
  if (document.replace(/<[^>]+>/g, "").trim().length < 20 && !report.html?.includes("<")) {
    throw new ApiError("Send the public page or its text with a normal status", 400);
  }

  if (!acquireMonitorLock(row.monitor.id)) {
    throw new ApiError("A check is already running", 409);
  }
  try {
    const monitor = await prisma.monitor.findUnique({
      where: { id: row.monitor.id },
      include: {
        user: { include: { subscription: true } },
        snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!monitor || monitor.status === MonitorStatus.PAUSED) throw new ApiError("Not found", 404);
    const plan = getEffectivePlan(monitor.user);
    const config = parseMonitorConfig(monitor.config);
    const now = new Date();
    const nextCheckAt = new Date(now.getTime() + INTERVAL_MINUTES[resolveEffectiveInterval(plan, monitor.interval)] * 60 * 1000);
    const result = buildOwnerFetchResult(monitor.mode, report);
    const saved = await persistSuccessfulCheck({
      monitor,
      result,
      plan,
      nextCheckAt,
      now,
      config,
      allowAssetFetch: false,
    });
    return { accepted: true, storedPage: true as const, status: report.status, result: saved.status };
  } finally {
    releaseMonitorLock(row.monitor.id);
  }
}

/** A consented script on the owner's page. One stored look per minute, with no visitor identity. */
export async function acceptScriptPage(input: { token: string; origin: string | null; text: string }) {
  const row = await prisma.siteToken.findUnique({
    where: { tokenHash: hashSecret(input.token) },
    select: { revokedAt: true, monitor: { select: { id: true, url: true, status: true } } },
  });
  if (!row || row.revokedAt) throw new ApiError("Not found", 404);
  if (!originMatchesMonitor(input.origin, row.monitor.url)) throw new ApiError("Origin is not allowed", 403);
  if (row.monitor.status === MonitorStatus.PAUSED) throw new ApiError("This site is paused", 409);

  const text = sanitizePublicPageText(input.text);
  const latest = await prisma.snapshot.findFirst({
    where: { monitorId: row.monitor.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, metadata: true },
  });
  const meta = latest?.metadata;
  const recentScript =
    Boolean(latest) &&
    meta != null &&
    typeof meta === "object" &&
    !Array.isArray(meta) &&
    (meta as { adapter?: unknown }).adapter === "site-script" &&
    Date.now() - latest!.createdAt.getTime() < SCRIPT_GAP_MS;
  if (recentScript) return { accepted: true, storedPage: false as const };

  if (!acquireMonitorLock(row.monitor.id)) return { accepted: true, storedPage: false as const };
  try {
    const monitor = await prisma.monitor.findUnique({
      where: { id: row.monitor.id },
      include: {
        user: { include: { subscription: true } },
        snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!monitor || monitor.status === MonitorStatus.PAUSED) throw new ApiError("Not found", 404);
    const plan = getEffectivePlan(monitor.user);
    const config = parseMonitorConfig(monitor.config);
    const now = new Date();
    const nextCheckAt = new Date(
      now.getTime() + INTERVAL_MINUTES[resolveEffectiveInterval(plan, monitor.interval)] * 60 * 1000
    );
    const result = buildOwnerFetchResult(monitor.mode, { siteKey: input.token, status: 200, text });
    result.metadata.engine = "site-script";
    result.metadata.adapter = "site-script";
    result.metadata.captureType = "site-script";
    result.metadata.fetchStrategy = "site-script";
    const saved = await persistSuccessfulCheck({
      monitor,
      result,
      plan,
      nextCheckAt,
      now,
      config,
      allowAssetFetch: false,
    });
    return { accepted: true, storedPage: true as const, result: saved.status };
  } finally {
    releaseMonitorLock(row.monitor.id);
  }
}
