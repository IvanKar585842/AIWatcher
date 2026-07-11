import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { markOnboardingCompleted, resolveOnboardingState } from "@/lib/onboarding";
import { withRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const completeSchema = z.object({
  completed: z.literal(true),
  intent: z
    .enum(["my-website", "competitor", "important-page", "price-changes"])
    .optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "onboarding-get",
      async () => {
        const state = await resolveOnboardingState(user.id, user.onboardingCompleted);
        return NextResponse.json({
          success: true,
          ...state,
        });
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
      "onboarding-complete",
      async () => {
        const body = await parseJsonBody(request);
        const parsed = completeSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { success: false, error: "Invalid onboarding payload" },
            { status: 400 }
          );
        }

        await markOnboardingCompleted(user.id);

        return NextResponse.json({
          success: true,
          onboardingCompleted: true,
          showOnboarding: false,
        });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
