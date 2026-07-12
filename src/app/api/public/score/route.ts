import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";
import { analyzeIntelligenceScore } from "@/lib/growth/intelligence-score";
import { trackEvent } from "@/lib/analytics";
import { ApiError } from "@/lib/errors";
import { apiErrorResponse } from "@/lib/api-response";

const bodySchema = z.object({
  url: z.string().min(3).max(2048),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anon";

  return withRateLimit(
    `intelligence-score:${ip}`,
    async () => {
      try {
        const parsed = bodySchema.parse(await request.json());
        const preview = await analyzeIntelligenceScore(parsed.url);

        const { userId: clerkId } = await auth();
        let userId: string | null = null;
        if (clerkId) {
          const user = await prisma.user.findUnique({
            where: { clerkId },
            select: { id: true },
          });
          userId = user?.id ?? null;
        }

        const shareToken = randomBytes(12).toString("hex");
        const saved = await prisma.intelligenceScore.create({
          data: {
            url: preview.url,
            hostname: preview.hostname,
            overallScore: preview.overallScore,
            payload: {
              ...preview,
              // Full detail only for signed-in users in response; store full anyway
              previewOnly: !userId,
            },
            userId,
            shareToken,
          },
          select: { id: true, shareToken: true },
        });

        await trackEvent({
          type: "score_generated",
          userId: userId ?? undefined,
          metadata: {
            hostname: preview.hostname,
            score: preview.overallScore,
            authenticated: Boolean(userId),
          },
        });

        const appUrl = (
          process.env.NEXT_PUBLIC_APP_URL ?? "https://watchflowing.com"
        ).replace(/\/$/, "");

        // Gate full notes behind account — return teaser for anonymous
        if (!userId) {
          return NextResponse.json({
            preview: true,
            overallScore: preview.overallScore,
            hostname: preview.hostname,
            url: preview.url,
            dimensions: preview.dimensions.map((d) => ({
              key: d.key,
              label: d.label,
              score: d.score,
              notes: d.notes.slice(0, 1),
            })),
            risksPreview: preview.risks.slice(0, 1),
            changeFrequencyHint: preview.changeFrequencyHint,
            cta: {
              title: "Unlock the full Intelligence Report",
              description:
                "Create a free WatchFlowing account to see all risks, SEO notes, and continuous monitoring.",
              href: `/sign-up?from=score&score=${saved.id}`,
            },
            sharePath: `/score/${saved.shareToken}`,
          });
        }

        return NextResponse.json({
          preview: false,
          ...preview,
          previewOnly: false,
          id: saved.id,
          sharePath: `/score/${saved.shareToken}`,
          publicUrl: `${appUrl}/score/${saved.shareToken}`,
        });
      } catch (error) {
        if (error instanceof ApiError) return apiErrorResponse(error);
        if (error instanceof Error && /blocked|unsafe|private/i.test(error.message)) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return apiErrorResponse(error);
      }
    },
    null,
    "public"
  );
}
