import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const patchSchema = z.object({
  completed: z.boolean(),
});

function isMissingColumn(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2022" || error.code === "P2021";
  }
  return error instanceof Error && /productTourCompleted|column/i.test(error.message);
}

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "product-tour-get",
      async () => {
        try {
          const row = await prisma.user.findUnique({
            where: { id: user.id },
            select: { productTourCompleted: true, onboardingCompleted: true },
          });
          return NextResponse.json({
            success: true,
            completed: Boolean(row?.productTourCompleted),
          });
        } catch (error) {
          if (isMissingColumn(error)) {
            // Migration not applied: treat already-onboarded users as tour-complete
            // so existing accounts are not interrupted.
            return NextResponse.json({
              success: true,
              completed: Boolean(user.onboardingCompleted),
              pendingMigration: true,
            });
          }
          throw error;
        }
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "product-tour-patch",
      async () => {
        const body = await parseJsonBody(request);
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: "Invalid product tour payload" },
            { status: 400 }
          );
        }

        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { productTourCompleted: parsed.data.completed },
          });
        } catch (error) {
          if (isMissingColumn(error)) {
            return NextResponse.json({
              success: true,
              completed: parsed.data.completed,
              pendingMigration: true,
            });
          }
          throw error;
        }

        return NextResponse.json({
          success: true,
          completed: parsed.data.completed,
        });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
