import { NextRequest, NextResponse } from "next/server";
import { ReportFrequency } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { buildClientReport } from "@/lib/reports/client-report";

const querySchema = z.object({
  period: z.enum(["week", "month"]).default("week"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clientId: string }> }
) {
  const { id, clientId } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`client-report-${clientId}`, async () => {
      const query = querySchema.parse({ period: request.nextUrl.searchParams.get("period") ?? "week" });
      const report = await buildClientReport(
        user.id,
        id,
        clientId,
        query.period === "month" ? ReportFrequency.MONTHLY : ReportFrequency.WEEKLY
      );
      return NextResponse.json({ report });
    }, user.id);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Choose week or month" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
