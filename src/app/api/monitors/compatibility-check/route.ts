import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { checkMonitorCompatibility } from "@/lib/monitoring/compatibility";
import { withRateLimit } from "@/lib/rate-limit";
import { validateMonitorUrl } from "@/lib/security/url";

const bodySchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .max(2048)
    .refine((url) => validateMonitorUrl(url).ok, {
      message: "This URL cannot be monitored (private or blocked address)",
    }),
});

/**
 * POST /api/monitors/compatibility-check
 * Lightweight pre-create probe — auth + rate limited + SSRF-safe.
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
            {
              success: false,
              error: parsed.error.errors[0]?.message ?? "Validation failed",
            },
            { status: 400 }
          );
        }

        const compatibility = await checkMonitorCompatibility(parsed.data.url);
        return NextResponse.json({ success: true, data: { compatibility } });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
