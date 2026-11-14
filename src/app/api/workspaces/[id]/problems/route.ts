import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { listWorkspaceProblems } from "@/lib/workspace-access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const user = await requireUser();
    return withRateLimit(`workspace-problems-${id}`, async () => {
      const problems = await listWorkspaceProblems(user.id, id);
      return NextResponse.json({ problems });
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}
