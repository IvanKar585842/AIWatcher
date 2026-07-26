import { NextResponse } from "next/server";
import { getAccountBriefing } from "@/lib/ai/chat-user-context";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

/**
 * Proactive account briefing for the AI Assistant empty state.
 * Read-only, authenticated, user-scoped — never returns another user's data.
 */
export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "chat-insights",
      async () => {
        const briefing = await getAccountBriefing(user.id);
        return NextResponse.json({
          success: true,
          hasMonitors: briefing.hasMonitors,
          insights: briefing.insights,
          recommendations: briefing.recommendations,
          suggestedQuestions: briefing.suggestedQuestions,
        });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
