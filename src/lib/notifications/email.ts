import { Resend } from "resend";

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

interface ChangeEmailParams {
  to: string;
  monitorName: string;
  url: string;
  summary: string;
  emoji: string;
  changes: string[];
  importance: string;
  changeId: string;
}

export async function sendChangeEmail(params: ChangeEmailParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const from = process.env.RESEND_FROM_EMAIL ?? "WatchFlow AI <notifications@watchflow.ai>";

  const safe = {
    monitorName: escapeHtml(params.monitorName),
    summary: escapeHtml(params.summary),
    emoji: escapeHtml(params.emoji),
    importance: escapeHtml(params.importance),
    url: escapeHtml(params.url),
    changes: params.changes.map(escapeHtml),
  };

  const importanceColor: Record<string, string> = {
    LOW: "#71717a",
    MEDIUM: "#38bdf8",
    HIGH: "#fbbf24",
    CRITICAL: "#f87171",
  };

  const color = importanceColor[params.importance] ?? "#38bdf8";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Change Detected</title>
</head>
<body style="margin:0;padding:0;background:#090909;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#090909;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid rgba(56,189,248,0.15);border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(56,189,248,0.7);">WatchFlow AI</p>
              <h1 style="margin:0;color:#f4f4f5;font-size:22px;font-weight:600;">
                ${safe.emoji} Change Detected
              </h1>
              <p style="margin:10px 0 0;color:#a1a1aa;font-size:14px;">${safe.monitorName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <span style="display:inline-block;background:${color}22;color:${color};border:1px solid ${color}44;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.05em;">
                ${safe.importance}
              </span>
              <p style="margin:20px 0 0;color:#d4d4d8;font-size:15px;line-height:1.7;">
                ${safe.summary}
              </p>
              ${
                safe.changes.length > 0
                  ? `<div style="margin-top:24px;padding:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">
                <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#71717a;">Detected Changes</p>
                <ul style="margin:0;padding:0 0 0 18px;">
                  ${safe.changes.map((c) => `<li style="margin-bottom:8px;color:#a1a1aa;font-size:14px;line-height:1.5;">${c}</li>`).join("")}
                </ul>
              </div>`
                  : ""
              }
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${safe.url}" style="display:inline-block;background:linear-gradient(135deg,rgba(34,211,238,0.9),rgba(56,189,248,0.9));color:#090909;text-decoration:none;padding:14px 36px;border-radius:999px;font-size:14px;font-weight:600;">
                      Open Website →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <a href="${escapeHtml(appUrl)}/dashboard/changes/${escapeHtml(params.changeId)}" style="color:#71717a;font-size:12px;text-decoration:underline;">
                      View full analysis in dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:rgba(255,255,255,0.02);border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;font-size:11px;color:#52525b;">
                Intelligent web monitoring · WatchFlow AI
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const result = await getResend().emails.send({
    from,
    to: params.to,
    subject: `${params.emoji} ${params.monitorName} — Change Detected`,
    html,
    text: `${params.summary}\n\n${params.changes.map((c) => `• ${c}`).join("\n")}\n\n${params.url}`,
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
    subject: "Welcome to WatchFlow AI",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px;background:#090909;color:#d4d4d8;">
        <h1 style="color:#22d3ee;">Welcome, ${safeName}</h1>
        <p style="line-height:1.6;color:#a1a1aa;">Your AI monitoring command center is ready. Add your first monitor and we'll watch the web for you.</p>
        <a href="${escapeHtml(appUrl)}/dashboard" style="display:inline-block;background:#22d3ee;color:#090909;padding:12px 24px;border-radius:999px;text-decoration:none;margin-top:16px;font-weight:600;">Open Dashboard</a>
      </div>
    `,
  });
}
