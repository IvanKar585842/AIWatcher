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

interface ChangeEmailParams {
  to: string;
  monitorName: string;
  url: string;
  summary: string;
  emoji: string;
  bulletPoints: string[];
  importance: string;
  changeId: string;
}

export async function sendChangeEmail(params: ChangeEmailParams) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const from = process.env.RESEND_FROM_EMAIL ?? "WatchFlow AI <notifications@watchflow.ai>";

  const importanceColor: Record<string, string> = {
    LOW: "#6b7280",
    MEDIUM: "#3b82f6",
    HIGH: "#f59e0b",
    CRITICAL: "#ef4444",
  };

  const color = importanceColor[params.importance] ?? "#3b82f6";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                ${params.emoji} Change Detected
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">
                ${params.monitorName}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;background:${color};color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px;">
                ${params.importance}
              </div>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
                ${params.summary}
              </p>
              ${
                params.bulletPoints.length > 0
                  ? `
              <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
                <h3 style="margin:0 0 12px;font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Key Changes</h3>
                <ul style="margin:0;padding:0 0 0 20px;">
                  ${params.bulletPoints.map((bp) => `<li style="margin-bottom:8px;color:#374151;font-size:14px;line-height:1.5;">${bp}</li>`).join("")}
                </ul>
              </div>`
                  : ""
              }
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0;">
                    <a href="${params.url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:16px;font-weight:600;">
                      Open Website →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:16px 0 0;">
                    <a href="${appUrl}/dashboard/changes/${params.changeId}" style="color:#6b7280;font-size:13px;text-decoration:underline;">
                      View full diff in WatchFlow AI
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Powered by <strong>WatchFlow AI</strong> — Intelligent web monitoring
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await getResend().emails.send({
    from,
    to: params.to,
    subject: `${params.emoji} ${params.monitorName} — Change Detected`,
    html,
  });
}

export async function sendWelcomeEmail(to: string, name: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const from = process.env.RESEND_FROM_EMAIL ?? "WatchFlow AI <notifications@watchflow.ai>";

  await getResend().emails.send({
    from,
    to,
    subject: "Welcome to WatchFlow AI! 🎉",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <h1 style="color:#2563eb;">Welcome to WatchFlow AI, ${name}!</h1>
        <p style="color:#374151;line-height:1.6;">Start monitoring any webpage and get AI-powered explanations of what changed and why it matters.</p>
        <a href="${appUrl}/dashboard" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">Go to Dashboard</a>
      </div>
    `,
  });
}
