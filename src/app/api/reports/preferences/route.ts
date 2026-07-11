import { NextRequest, NextResponse } from "next/server";
import { ReportFrequency, ReportType } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";

const prefsSchema = z.object({
  weeklyReportEnabled: z.boolean().optional(),
  reportFrequency: z.nativeEnum(ReportFrequency).optional(),
  reportType: z.nativeEnum(ReportType).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({
      weeklyReportEnabled: user.weeklyReportEnabled,
      reportFrequency: user.reportFrequency,
      reportType: user.reportType,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = prefsSchema.parse(await request.json());

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(typeof body.weeklyReportEnabled === "boolean"
          ? { weeklyReportEnabled: body.weeklyReportEnabled }
          : {}),
        ...(body.reportFrequency ? { reportFrequency: body.reportFrequency } : {}),
        ...(body.reportType ? { reportType: body.reportType } : {}),
      },
      select: {
        weeklyReportEnabled: true,
        reportFrequency: true,
        reportType: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
