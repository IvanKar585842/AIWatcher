import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { probeSelector } from "@/lib/monitoring/selector-probe";
import { withRateLimit } from "@/lib/rate-limit";
import { fetchWithSafeRedirects, validateMonitorUrl } from "@/lib/security/url";

const bodySchema = z.object({
  url: z.string().min(1).max(2048).refine((url) => validateMonitorUrl(url).ok, {
    message: "This URL cannot be monitored (private or blocked address)",
  }),
  selector: z.string().min(1).max(500),
});

/**
 * POST /api/monitors/test-selector
 * Checks selectors against the initial HTML. A miss is not treated as deletion.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "monitor-compatibility",
      async () => {
        const body = await parseJsonBody(req);
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: parsed.error.errors[0]?.message ?? "Validation failed" },
            { status: 400 }
          );
        }
        const response = await fetchWithSafeRedirects(parsed.data.url, {
          signal: AbortSignal.timeout(12_000),
          headers: { "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot; monitoring service)", Accept: "text/html" },
        });
        if (!response.ok) {
          return NextResponse.json(
            { success: false, error: `HTTP ${response.status} while testing the selector` },
            { status: 422 }
          );
        }
        const html = (await response.text()).slice(0, 1_500_000);
        const probe = probeSelector(html, parsed.data.selector);
        return NextResponse.json({ success: true, data: probe });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
