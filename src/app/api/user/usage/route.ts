import { requireUser } from "@/lib/auth";
import { apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { getUserUsage } from "@/lib/usage";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "user-usage",
      async () => {
        const usage = await getUserUsage(user.id);
        return apiSuccess({ usage });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
