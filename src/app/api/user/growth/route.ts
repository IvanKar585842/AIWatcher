import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { withRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  agencyModeEnabled: z.boolean().optional(),
  agencyBrandName: z.string().max(80).nullable().optional(),
  agencyShowPoweredBy: z.boolean().optional(),
  badgeEnabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "growth-get",
      async () => {
        const row = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: {
            username: true,
            agencyModeEnabled: true,
            agencyBrandName: true,
            agencyShowPoweredBy: true,
            badgeEnabled: true,
          },
        });

        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://watchflowing.com").replace(
          /\/$/,
          ""
        );

        return NextResponse.json({
          ...row,
          badgeEmbed:
            row.username && row.badgeEnabled
              ? `<a href="${appUrl}/monitored-by?u=${encodeURIComponent(row.username)}" target="_blank" rel="noopener"><img src="${appUrl}/api/public/badge/${encodeURIComponent(row.username)}" alt="Monitored by WatchFlowing AI" width="220" height="44" /></a>`
              : null,
          badgeImageUrl:
            row.username && row.badgeEnabled
              ? `${appUrl}/api/public/badge/${encodeURIComponent(row.username)}`
              : null,
        });
      },
      user.id,
      "api"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "growth-patch",
      async () => {
        const body = schema.parse(await request.json());

        const updated = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(typeof body.agencyModeEnabled === "boolean"
              ? { agencyModeEnabled: body.agencyModeEnabled }
              : {}),
            ...(body.agencyBrandName !== undefined
              ? { agencyBrandName: body.agencyBrandName?.trim() || null }
              : {}),
            ...(typeof body.agencyShowPoweredBy === "boolean"
              ? { agencyShowPoweredBy: body.agencyShowPoweredBy }
              : {}),
            ...(typeof body.badgeEnabled === "boolean" ? { badgeEnabled: body.badgeEnabled } : {}),
          },
          select: {
            username: true,
            agencyModeEnabled: true,
            agencyBrandName: true,
            agencyShowPoweredBy: true,
            badgeEnabled: true,
          },
        });

        if (body.badgeEnabled === true) {
          await trackEvent({
            type: "badge_installed",
            userId: user.id,
            metadata: { source: "settings" },
          });
        }

        return NextResponse.json(updated);
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
