import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { applyReferralOnSignup, getReferralStats } from "@/lib/referrals";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "referrals-get",
      async () => {
        const stats = await getReferralStats(user.id);
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://watchflowing.com").replace(
          /\/$/,
          ""
        );

        const fresh = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            referredBy: true,
            referralBonusMonitors: true,
            referralProUntil: true,
          },
        });

        return NextResponse.json({
          referralCode: stats.code,
          referredBy: fresh?.referredBy ?? null,
          referralCount: stats.referralCount,
          referralStats: {
            signups: stats.signups,
            referralCount: stats.referralCount,
            bonusMonitors: fresh?.referralBonusMonitors ?? 0,
            proUntil: fresh?.referralProUntil?.toISOString() ?? null,
            pendingRewards: stats.pendingRewards,
            status: stats.status,
            rewards: stats.rewards,
          },
          inviteUrl: `${appUrl}${stats.invitePath}`,
          note: "Earn +1 monitor slot per referral. New users get 7 days of Pro.",
        });
      },
      user.id,
      "api"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const claimSchema = z.object({
  code: z.string().min(3).max(32),
});

/** Claim a referral code once for the current user (from ?ref= or invite link). */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "referrals-claim",
      async () => {
        const body = claimSchema.parse(await request.json());
        const applied = await applyReferralOnSignup(user.id, body.code);
        const stats = await getReferralStats(user.id);
        return NextResponse.json({ applied, referralStats: stats });
      },
      user.id,
      "strict"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
