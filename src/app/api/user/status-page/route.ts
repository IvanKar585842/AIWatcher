import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailure, apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { statusPageSettingsSchema } from "@/lib/status-page";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "status-settings-get",
      async () => {
        const monitors = await prisma.monitor.findMany({
          where: { userId: user.id },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            url: true,
            status: true,
            statusPageVisible: true,
          },
        });

        return apiSuccess({
          username: user.username,
          statusPageEnabled: user.statusPageEnabled,
          statusPageTitle: user.statusPageTitle,
          publicUrl: user.username ? `/status/${user.username}` : null,
          monitors,
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
      "status-settings-patch",
      async () => {
        const body = await parseJsonBody(request);
        const parsed = statusPageSettingsSchema.safeParse(body);
        if (!parsed.success) {
          return apiFailure(parsed.error.errors[0]?.message ?? "Invalid settings", 400);
        }

        const data = parsed.data;
        const updates: {
          username?: string | null;
          statusPageEnabled?: boolean;
          statusPageTitle?: string | null;
        } = {};

        if (data.username !== undefined) {
          const username = data.username;
          if (username) {
            const taken = await prisma.user.findFirst({
              where: {
                username,
                NOT: { id: user.id },
              },
              select: { id: true },
            });
            if (taken) {
              return apiFailure("That username is already taken", 409);
            }
          }
          updates.username = username;
        }

        if (data.statusPageEnabled !== undefined) {
          updates.statusPageEnabled = data.statusPageEnabled;
          if (data.statusPageEnabled && !(data.username ?? user.username)) {
            return apiFailure("Set a username before enabling the public status page", 400);
          }
        }

        if (data.statusPageTitle !== undefined) {
          updates.statusPageTitle = data.statusPageTitle;
        }

        const updated = await prisma.user.update({
          where: { id: user.id },
          data: updates,
          select: {
            username: true,
            statusPageEnabled: true,
            statusPageTitle: true,
          },
        });

        return apiSuccess({
          ...updated,
          publicUrl: updated.username ? `/status/${updated.username}` : null,
        });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
