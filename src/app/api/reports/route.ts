import { NextRequest, NextResponse } from "next/server";
import { ReportFrequency, ReportType } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { generateWeeklyReportForUser } from "@/lib/reports/generate";
import { deliverWeeklyReport } from "@/lib/reports/deliver";
import { withRateLimit } from "@/lib/rate-limit";

const reportGenerateSchema = z.object({
  force: z.boolean().optional(),
  deliver: z.boolean().optional(),
  reportType: z.nativeEnum(ReportType).optional(),
  frequency: z.nativeEnum(ReportFrequency).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "reports-list",
      async () => {
        const reports = await prisma.weeklyReport.findMany({
          where: { userId: user.id },
          orderBy: { periodEnd: "desc" },
          take: 24,
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            reportType: true,
            frequency: true,
            executiveSummary: true,
            aiUsed: true,
            shareEnabled: true,
            shareToken: true,
            createdAt: true,
            payload: true,
          },
        });

        return NextResponse.json({
          reports: reports.map((r) => {
            const payload = r.payload as {
              stats?: { totalChanges?: number; importantCount?: number };
            };
            return {
              id: r.id,
              periodStart: r.periodStart,
              periodEnd: r.periodEnd,
              reportType: r.reportType,
              frequency: r.frequency,
              executiveSummary: r.executiveSummary,
              aiUsed: r.aiUsed,
              shareEnabled: r.shareEnabled,
              shareToken: r.shareToken,
              createdAt: r.createdAt,
              totalChanges: payload.stats?.totalChanges ?? 0,
              importantCount: payload.stats?.importantCount ?? 0,
            };
          }),
          preferences: {
            weeklyReportEnabled: user.weeklyReportEnabled,
            reportFrequency: user.reportFrequency,
            reportType: user.reportType,
          },
        });
      },
      user.id,
      "api"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "reports-generate",
      async () => {
        const body = reportGenerateSchema.parse(await request.json().catch(() => ({})));

        const { report, cached } = await generateWeeklyReportForUser(user.id, {
          force: Boolean(body.force),
          reportType: body.reportType,
          frequency: body.frequency,
        });

        let delivery = { email: false, telegram: false };
        if (body.deliver) {
          delivery = await deliverWeeklyReport(report.id);
        }

        return NextResponse.json({
          reportId: report.id,
          cached,
          delivery,
        });
      },
      user.id,
      "ai"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
