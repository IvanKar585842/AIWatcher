import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { assertFeature } from "@/lib/plan-guards";
import { withRateLimit } from "@/lib/rate-limit";
import { createApiKey } from "@/lib/access/secrets";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(40),
});

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "api-keys-list",
      async () => {
        const keys = await prisma.apiKey.findMany({
          where: { userId: user.id, revokedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
        });
        return NextResponse.json({ success: true, keys });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "api-keys-create",
      async () => {
        assertFeature(user, "API_ACCESS");
        const body = bodySchema.parse(await parseJsonBody(request));
        const active = await prisma.apiKey.count({
          where: { userId: user.id, revokedAt: null },
        });
        if (active >= 5) {
          throw new ApiError("Revoke an existing key before creating another. The limit is 5.", 400);
        }
        const created = createApiKey(body.name);
        const row = await prisma.apiKey.create({
          data: {
            userId: user.id,
            name: created.name,
            prefix: created.prefix,
            keyHash: created.hash,
          },
          select: { id: true, name: true, prefix: true, createdAt: true },
        });
        return NextResponse.json({ success: true, key: row, token: created.token });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Name the API key" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}
