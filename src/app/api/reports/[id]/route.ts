import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";

const sharePatchSchema = z.object({
  shareEnabled: z.boolean().optional().default(false),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    return withRateLimit(
      `reports-get-${id}`,
      async () => {
        const report = await prisma.weeklyReport.findFirst({
          where: { id, userId: user.id },
        });
        if (!report) throw new ApiError("Report not found", 404);

        return NextResponse.json({ report });
      },
      user.id,
      "api"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    return withRateLimit(
      `reports-share-${id}`,
      async () => {
        const body = sharePatchSchema.parse(await request.json().catch(() => ({})));

        const existing = await prisma.weeklyReport.findFirst({
          where: { id, userId: user.id },
          select: { id: true, shareToken: true },
        });
        if (!existing) throw new ApiError("Report not found", 404);

        const shareEnabled = body.shareEnabled;
        const shareToken = shareEnabled
          ? existing.shareToken || randomBytes(16).toString("hex")
          : existing.shareToken;

        const report = await prisma.weeklyReport.update({
          where: { id },
          data: {
            shareEnabled,
            shareToken: shareEnabled ? shareToken : existing.shareToken,
          },
        });

        if (shareEnabled) {
          const { trackEvent } = await import("@/lib/analytics");
          await trackEvent({
            type: "report_shared",
            userId: user.id,
            metadata: { reportId: report.id },
          });
        }

        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://watchflowing.com").replace(
          /\/$/,
          ""
        );

        return NextResponse.json({
          report,
          publicUrl:
            report.shareEnabled && report.shareToken
              ? `${appUrl}/report/${report.shareToken}`
              : null,
        });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
