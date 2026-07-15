import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-response";
import { readStoredHtml } from "@/lib/monitoring/snapshot-store";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    return withRateLimit(
      `change-get-${id}`,
      async () => {
        const change = await prisma.change.findFirst({
          where: {
            id,
            monitor: { userId: user.id },
          },
          include: {
            monitor: true,
            notifications: true,
          },
        });

        if (!change) {
          return NextResponse.json({ error: "Change not found" }, { status: 404 });
        }

        const [oldHtml, newHtml] = await Promise.all([
          readStoredHtml(change.oldHtml),
          readStoredHtml(change.newHtml),
        ]);

        const meta =
          change.aiRawResponse &&
          typeof change.aiRawResponse === "object" &&
          !Array.isArray(change.aiRawResponse)
            ? (change.aiRawResponse as Record<string, unknown>)
            : {};

        const { aiRawResponse: _raw, oldHtml: _oldRef, newHtml: _newRef, monitor, ...rest } =
          change;

        return NextResponse.json({
          change: {
            ...rest,
            monitor: {
              id: monitor.id,
              name: monitor.name,
              url: monitor.url,
              mode: monitor.mode,
            },
            oldHtml,
            newHtml,
            visualDiffPercent:
              typeof meta.visualDiffPercent === "number" ? meta.visualDiffPercent : null,
            previousScreenshot: meta.previousScreenshot ?? null,
            currentScreenshot: meta.currentScreenshot ?? null,
            structureSummary: Array.isArray(meta.structureSummary) ? meta.structureSummary : [],
            comparisonReason: meta.comparisonReason ?? null,
            categoryLabel:
              typeof meta.categoryLabel === "string" ? meta.categoryLabel : null,
            potentialImpact:
              typeof meta.potentialImpact === "string" ? meta.potentialImpact : null,
            recommendedAction:
              typeof meta.recommendedAction === "string" ? meta.recommendedAction : null,
            upgradePreview: Boolean(meta.upgradePreview),
            upgradeTitle:
              typeof meta.upgradeTitle === "string" ? meta.upgradeTitle : null,
            upgradeDescription:
              typeof meta.upgradeDescription === "string" ? meta.upgradeDescription : null,
          },
        });
      },
      user.id
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
