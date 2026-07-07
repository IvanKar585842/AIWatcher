import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { searchChangesSchema } from "@/lib/validations";
import type { Prisma } from "@prisma/client";

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

        const [changes, total] = await Promise.all([
          prisma.change.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
              monitor: { select: { id: true, name: true, url: true } },
            },
          }),
          prisma.change.count({ where }),
        ]);

        return NextResponse.json({
          changes,
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
