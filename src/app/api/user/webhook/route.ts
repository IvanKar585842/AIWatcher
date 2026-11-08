import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { assertFeature } from "@/lib/plan-guards";
import { withRateLimit } from "@/lib/rate-limit";
import { assertWebhookTarget } from "@/lib/notifications/customer-webhook";
import { z } from "zod";

const bodySchema = z.object({
  url: z.string().trim().min(8).max(500),
});

export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "user-webhook",
      async () => {
        assertFeature(user, "WEBHOOKS");
        const body = bodySchema.parse(await parseJsonBody(request));
        let target: URL;
        try {
          target = assertWebhookTarget(body.url);
        } catch (error) {
          throw new ApiError(error instanceof Error ? error.message : "Invalid webhook URL", 400);
        }
        const secret = `whsec_${randomBytes(24).toString("base64url")}`;
        await prisma.user.update({
          where: { id: user.id },
          data: { webhookUrl: target.toString(), webhookSecret: secret },
        });
        return NextResponse.json({
          success: true,
          url: target.toString(),
          secret,
        });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Enter an HTTPS webhook URL" }, { status: 400 });
    }
    return apiFailureFromError(error);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "user-webhook-delete",
      async () => {
        assertFeature(user, "WEBHOOKS");
        await prisma.user.update({
          where: { id: user.id },
          data: { webhookUrl: null, webhookSecret: null },
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
