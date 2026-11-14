import { NextRequest, NextResponse } from "next/server";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { hashSecret } from "@/lib/access/secrets";
import { acceptScriptPage } from "@/lib/monitoring/owner-report";
import { acceptSiteSignal, siteEventSchema } from "@/lib/site-sdk";

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > 80_000) {
      return NextResponse.json({ success: false, error: "Payload is too large" }, { status: 413 });
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid event" }, { status: 400 });
    }
    const parsed = siteEventSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid event" }, { status: 400 });
    }
    const origin = request.headers.get("origin") ?? request.headers.get("referer");
    const limitKey = `site-ingest-${hashSecret(parsed.data.siteKey).slice(0, 16)}`;
    return withRateLimit(limitKey, async () => {
      if (parsed.data.kind === "page") {
        const saved = await acceptScriptPage({
          token: parsed.data.siteKey,
          origin,
          text: parsed.data.text ?? "",
        });
        return NextResponse.json({ ok: true, storedPage: saved.storedPage });
      }
      await acceptSiteSignal({ token: parsed.data.siteKey, origin, event: parsed.data });
      return NextResponse.json({ ok: true });
    }, null, "ingest");
  } catch (error) {
    return apiFailureFromError(error);
  }
}
