import { NextResponse } from "next/server";
import { exportAccount } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "user-export",
      async () => {
        const data = await exportAccount(user.id);
        return new NextResponse(JSON.stringify(data, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": 'attachment; filename="watchflowing-account.json"',
            "Cache-Control": "no-store",
          },
        });
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
