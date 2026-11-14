import { NextRequest, NextResponse } from "next/server";
import { apiFailureFromError } from "@/lib/api-response";
import { hashSecret } from "@/lib/access/secrets";
import { withRateLimit } from "@/lib/rate-limit";
import { acceptOwnerReport, ownerReportSchema } from "@/lib/monitoring/owner-report";

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") || request.headers.get("referer")) {
      return NextResponse.json({ success: false, error: "A browser cannot send this report" }, { status: 403 });
    }
    const raw = await request.text();
    if (raw.length > 150_000) {
      return NextResponse.json({ success: false, error: "Payload is too large" }, { status: 413 });
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid report" }, { status: 400 });
    }
    const parsed = ownerReportSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid report" }, { status: 400 });
    }
    const limitKey = `owner-report-${hashSecret(parsed.data.siteKey).slice(0, 16)}`;
    return withRateLimit(limitKey, async () => {
      const saved = await acceptOwnerReport(parsed.data);
      return NextResponse.json({ ok: true, storedPage: saved.storedPage });
    }, null, "ownerReport");
  } catch (error) {
    return apiFailureFromError(error);
  }
}
