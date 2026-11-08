import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(
      `api-key-revoke-${id}`,
      async () => {
        const key = await prisma.apiKey.findFirst({
          where: { id, userId: user.id, revokedAt: null },
          select: { id: true },
        });
        if (!key) throw new ApiError("API key not found", 404);
        await prisma.apiKey.update({
          where: { id: key.id },
          data: { revokedAt: new Date() },
        });
        return NextResponse.json({ success: true });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
