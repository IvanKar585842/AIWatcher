import { NextRequest, NextResponse } from "next/server";
import { deleteAccount, isDeleteConfirmed } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { apiFailure, apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "user-delete",
      async () => {
        const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
        if (!isDeleteConfirmed(body?.confirm)) {
          return apiFailure("Type DELETE to confirm account removal.", 400);
        }
        await deleteAccount({ id: user.id, clerkId: user.clerkId });
        return NextResponse.json({ success: true });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
