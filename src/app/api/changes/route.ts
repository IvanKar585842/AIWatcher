import { NextRequest, NextResponse } from "next/server";
import { MonitoringMode, type Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { searchChangesSchema } from "@/lib/validations";

function isVisualMode(mode?: string | null): boolean {
  return mode === MonitoringMode.VISUAL_CHANGES || mode === MonitoringMode.SCREENSHOT_DIFF;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "changes-list",
      async () => {
        const searchParams = Object.fromEntries(request.nextUrl.searchParams);
        const parsed = searchChangesSchema.safeParse(searchParams);

        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid parameters", details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const { query, category, importance, monitorId, page, limit } = parsed.data;
        const skip = (page - 1) * limit;

        const where: Prisma.ChangeWhereInput = {
          monitor: { userId: user.id },
        };

        if (monitorId) where.monitorId = monitorId;
        if (category) where.category = category as Prisma.EnumChangeCategoryFilter;
        if (importance) where.importance = importance as Prisma.EnumChangeImportanceFilter;

        if (query) {
          where.OR = [
            { summary: { contains: query, mode: "insensitive" } },
            { oldValue: { contains: query, mode: "insensitive" } },
            { newValue: { contains: query, mode: "insensitive" } },
          ];
        }

        // Avoid selecting aiRawResponse (can include large screenshot previews)
        const [changes, total] = await Promise.all([
          prisma.change.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
              id: true,
              summary: true,
              emoji: true,
              importance: true,
              category: true,
              oldValue: true,
              newValue: true,
              bulletPoints: true,
              analysisStatus: true,
              createdAt: true,
              monitor: { select: { id: true, name: true, url: true, mode: true } },
            },
          }),
          prisma.change.count({ where }),
        ]);

        const lightweight = changes.map((c) => ({
          id: c.id,
          summary: c.summary,
          emoji: c.emoji,
          importance: c.importance,
          category: c.category,
          oldValue: c.oldValue,
          newValue: c.newValue,
          bulletPoints: c.bulletPoints.slice(0, 4),
          analysisStatus: c.analysisStatus,
          createdAt: c.createdAt,
          monitor: c.monitor,
          changeType: c.category,
          hasScreenshots: isVisualMode(c.monitor.mode),
        }));

        return NextResponse.json({
          changes: lightweight,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
