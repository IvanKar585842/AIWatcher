import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { apiFailureFromError } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import { workspaceHomeSummary } from "@/lib/workspace-access";

function missingAgencyTables(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit("workspace-home-summary", async () => {
      try {
        const workspaces = await workspaceHomeSummary(user.id);
        return NextResponse.json({ workspaces });
      } catch (error) {
        if (missingAgencyTables(error)) return NextResponse.json({ workspaces: [] });
        throw error;
      }
    }, user.id);
  } catch (error) {
    return apiFailureFromError(error);
  }
}
