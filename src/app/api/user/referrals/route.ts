import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { getReferralStats } from "@/lib/referrals";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireUser();
    const stats = await getReferralStats(user.id);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://watchflowing.com").replace(
      /\/$/,
      ""
    );

    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      select: { referredBy: true },
    });

    return NextResponse.json({
      referralCode: stats.code,
      referredBy: fresh?.referredBy ?? null,
      referralStats: {
        signups: stats.signups,
        pendingRewards: stats.pendingRewards,
        status: stats.status,
      },
      inviteUrl: `${appUrl}${stats.invitePath}`,
      note: "Referral rewards are coming soon. Your invite link is ready to share.",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
