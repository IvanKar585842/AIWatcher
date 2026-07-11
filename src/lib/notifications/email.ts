import { Resend } from "resend";
import { MODE_LABELS } from "@/lib/constants";
import type { MonitoringMode } from "@prisma/client";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
    resend = new Resend(apiKey);
  }
  return resend;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEmailTime(date: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(date));
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function importanceHeadline(importance: string): string {
  if (importance === "CRITICAL") return "Critical website change detected";
  if (importance === "HIGH") return "Important website change detected";
  if (importance === "MEDIUM") return "Website change detected";
  return "Minor website update detected";
}

interface ChangeEmailParams {
  to: string;
  monitorName: string;
  url: string;
  summary: string;
  emoji: string;
  changes: string[];
  importance: string;
  category?: string;
  recommendedAction?: string;
  monitorMode?: string;
  changeId: string;
  detectedAt?: Date | string;
}

export async function sendChangeEmail(params: ChangeEmailParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const from = process.env.RESEND_FROM_EMAIL ?? "WatchFlow AI <notifications@watchflow.ai>";
  const dashboardUrl = `${appUrl}/dashboard/changes/${params.changeId}`;
  const settingsUrl = `${appUrl}/dashboard/settings`;
  const notificationsUrl = `${appUrl}/dashboard/notifications`;
  const detectedAt = formatEmailTime(params.detectedAt ?? new Date());
  const hostname = getHostname(params.url);
  const modeLabel =
    params.monitorMode && MODE_LABELS[params.monitorMode as MonitoringMode]
      ? MODE_LABELS[params.monitorMode as MonitoringMode]
      : params.category?.replace(/_/g, " ") || "Website monitoring";
  const recommendation =
    params.recommendedAction?.trim() ||
    (params.importance === "HIGH" || params.importance === "CRITICAL"
      ? "Open the full analysis and decide next steps."
      : "Review when convenient.");

  const safe = {
    monitorName: escapeHtml(params.monitorName),
    summary: escapeHtml(params.summary),
    emoji: escapeHtml(params.emoji),
    importance: escapeHtml(params.importance),
    url: escapeHtml(params.url),
    hostname: escapeHtml(hostname),
    modeLabel: escapeHtml(modeLabel),
    category: escapeHtml((params.category ?? "CONTENT").replace(/_/g, " ")),
    recommendation: escapeHtml(recommendation),
    dashboardUrl: escapeHtml(dashboardUrl),
    settingsUrl: escapeHtml(settingsUrl),
    notificationsUrl: escapeHtml(notificationsUrl),
    detectedAt: escapeHtml(detectedAt),
    headline: escapeHtml(importanceHeadline(params.importance)),
    changes: params.changes.map(escapeHtml),
  };

  const importanceColor: Record<string, string> = {
    LOW: "#a1a1aa",
    MEDIUM: "#38bdf8",
    HIGH: "#fbbf24",
    CRITICAL: "#f87171",
  };
  const color = importanceColor[params.importance] ?? "#38bdf8";
  const urgencyIcon =
    params.importance === "CRITICAL" || params.importance === "HIGH" ? "🚨 " : "";

  const changeRows =
    safe.changes.length > 0
      ? safe.changes
          .slice(0, 6)
          .map(
            (c) => `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#d4d4d8;font-size:14px;line-height:1.5;">
                <span style="color:#22d3ee;margin-right:8px;">•</span>${c}
              </td>
            </tr>`
          )
          .join("")
      : `
            <tr>
              <td style="padding:8px 0;color:#a1a1aa;font-size:14px;line-height:1.5;">
                A meaningful change was detected on this page.
              </td>
            </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>${urgencyIcon}${safe.monitorName} — ${safe.importance}</title>
</head>
<body style="margin:0;padding:0;background:#090909;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#090909;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#111111;border:1px solid rgba(56,189,248,0.18);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 24px 20px;border-bottom:1px solid rgba(255,255,255,0.06);background:linear-gradient(135deg,rgba(34,211,238,0.08),transparent 55%);">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(56,189,248,0.75);">AI Watcher</p>
              <h1 style="margin:0;color:#fafafa;font-size:22px;font-weight:600;line-height:1.3;">
                ${urgencyIcon}${safe.emoji} ${safe.headline}
              </h1>
              <p style="margin:10px 0 0;color:#a1a1aa;font-size:14px;">
                ${safe.monitorName} · ${safe.modeLabel}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#71717a;">Website</p>
                    <p style="margin:0;color:#f4f4f5;font-size:16px;font-weight:600;">${safe.hostname}</p>
                    <a href="${safe.url}" style="display:inline-block;margin-top:6px;color:#67e8f9;font-size:12px;word-break:break-all;text-decoration:none;">${safe.url}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 18px 16px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#71717a;">Monitor type</p>
                    <p style="margin:0;color:#e4e4e7;font-size:13px;">${safe.modeLabel} · ${safe.category}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td width="50%" style="padding-right:8px;vertical-align:top;">
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 16px;">
                      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#71717a;">Importance</p>
                      <span style="display:inline-block;background:${color}22;color:${color};border:1px solid ${color}55;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.04em;">
                        ${safe.importance}
                      </span>
                    </div>
                  </td>
                  <td width="50%" style="padding-left:8px;vertical-align:top;">
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 16px;">
                      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#71717a;">Detected</p>
                      <p style="margin:0;color:#e4e4e7;font-size:13px;line-height:1.4;">${safe.detectedAt}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <div style="margin-top:20px;">
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#71717a;">Change</p>
                <p style="margin:0;color:#f4f4f5;font-size:15px;font-weight:600;line-height:1.5;">
                  ${safe.changes[0] ?? safe.summary}
                </p>
              </div>

              <div style="margin-top:18px;">
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#71717a;">AI analysis</p>
                <p style="margin:0;color:#e4e4e7;font-size:15px;line-height:1.7;">
                  ${safe.summary}
                </p>
              </div>

              <div style="margin-top:18px;padding:16px 18px;background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.18);border-radius:12px;">
                <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(103,232,249,0.85);">Recommended action</p>
                <p style="margin:0;color:#ecfeff;font-size:14px;line-height:1.6;">${safe.recommendation}</p>
              </div>

              <div style="margin-top:22px;padding:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
                <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#71717a;">What changed</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${changeRows}
                </table>
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${safe.dashboardUrl}" style="display:inline-block;background:#22d3ee;color:#090909;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:14px;font-weight:700;">
                      View full analysis
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:14px;">
                    <a href="${safe.url}" style="color:#71717a;font-size:12px;text-decoration:underline;">
                      Visit monitored website
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 24px;background:rgba(255,255,255,0.02);border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0 0 10px;font-size:11px;color:#52525b;line-height:1.5;">
                You received this because email alerts are enabled for this monitor.
              </p>
              <p style="margin:0;font-size:11px;line-height:1.6;">
                <a href="${safe.settingsUrl}" style="color:#67e8f9;text-decoration:none;">Notification settings</a>
                <span style="color:#3f3f46;"> · </span>
                <a href="${safe.notificationsUrl}" style="color:#67e8f9;text-decoration:none;">Manage alerts</a>
                <span style="color:#3f3f46;"> · </span>
                <a href="${safe.settingsUrl}" style="color:#71717a;text-decoration:underline;">Unsubscribe / pause</a>
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#3f3f46;">
                AI Watcher · Intelligent website monitoring
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${urgencyIcon.trim()}${params.emoji} ${importanceHeadline(params.importance)}`,
    "",
    `Website: ${hostname}`,
    `Monitor: ${params.monitorName}`,
    `Type: ${modeLabel}`,
    `Importance: ${params.importance}`,
    `Detected: ${detectedAt}`,
    "",
    `Change: ${params.changes[0] ?? params.summary}`,
    "",
    `AI analysis: ${params.summary}`,
    "",
    `Recommended action: ${recommendation}`,
    "",
    "What changed:",
    ...params.changes.map((c) => `• ${c}`),
    "",
    `View full analysis: ${dashboardUrl}`,
    `Notification settings: ${settingsUrl}`,
  ].join("\n");

  const result = await getResend().emails.send({
    from,
    to: params.to,
    subject: `${urgencyIcon}${params.emoji} ${params.monitorName} — ${params.importance}`,
    html,
    text,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result;
}

export async function sendWelcomeEmail(to: string, name: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const from = process.env.RESEND_FROM_EMAIL ?? "WatchFlow AI <notifications@watchflow.ai>";
  const safeName = escapeHtml(name);

  await getResend().emails.send({
    from,
    to,
    subject: "Welcome to AI Watcher",
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#090909;color:#d4d4d8;">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(56,189,248,0.75);">AI Watcher</p>
        <h1 style="color:#fafafa;margin:0 0 12px;">Welcome, ${safeName}</h1>
        <p style="line-height:1.6;color:#a1a1aa;">Your monitoring workspace is ready. Add a monitor and we will watch the web for meaningful changes.</p>
        <a href="${escapeHtml(appUrl)}/dashboard" style="display:inline-block;background:#22d3ee;color:#090909;padding:12px 24px;border-radius:999px;text-decoration:none;margin-top:16px;font-weight:700;">Open Dashboard</a>
      </div>
    `,
  });
}
