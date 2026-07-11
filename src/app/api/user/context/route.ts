import { NextResponse } from "next/server";
import { getEffectivePlan, isAdminUser } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "user-context",
      async () =>
        NextResponse.json({
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user as { role?: string }).role ?? "USER",
          isAdmin: isAdminUser(user),
          plan: getEffectivePlan(user),
          onboardingCompleted: Boolean(user.onboardingCompleted),
        }),
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
