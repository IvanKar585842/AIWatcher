import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const report = await prisma.weeklyReport.findFirst({
      where: { id, userId: user.id },
    });
    if (!report) throw new ApiError("Report not found", 404);

    return NextResponse.json({ report });
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
    const body = (await request.json().catch(() => ({}))) as {
      shareEnabled?: boolean;
    };

    const existing = await prisma.weeklyReport.findFirst({
      where: { id, userId: user.id },
      select: { id: true, shareToken: true },
    });
    if (!existing) throw new ApiError("Report not found", 404);

    const shareEnabled = Boolean(body.shareEnabled);
    const shareToken =
      shareEnabled
        ? existing.shareToken || randomBytes(16).toString("hex")
        : existing.shareToken;

    const report = await prisma.weeklyReport.update({
      where: { id },
      data: {
        shareEnabled,
        shareToken: shareEnabled ? shareToken : existing.shareToken,
      },
    });

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
  } catch (error) {
    return apiErrorResponse(error);
  }
}
