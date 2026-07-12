import { randomBytes } from "node:crypto";
import { Plan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";

/** Short human-friendly referral codes, e.g. WF-A3K9XQ */
export function generateReferralCode(): string {
  const token = randomBytes(4).toString("hex").toUpperCase();
  return `WF-${token.slice(0, 6)}`;
}

export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      if (updated.referralCode) {
        await trackEvent({
          type: "referral_created",
          userId,
          metadata: { code: updated.referralCode },
        });
        return updated.referralCode;
      }
    } catch {
      // Unique collision — retry
    }
  }

  throw new Error("Could not allocate referral code");
}

export type ReferralStats = {
  code: string;
  invitePath: string;
  /** Alias for referralSignups */
  referralCount: number;
  signups: number;
  bonusMonitors: number;
  proUntil: string | null;
  pendingRewards: number;
  status: "active";
  rewards: {
    referrerBonusMonitors: number;
    refereeProDays: number;
  };
};

const REFEREE_PRO_DAYS = 7;
const REFERRER_BONUS_MONITORS = 1;

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await ensureReferralCode(userId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      referralSignups: true,
      referralBonusMonitors: true,
      referralProUntil: true,
    },
  });

  return {
    code,
    invitePath: `/sign-up?ref=${encodeURIComponent(code)}`,
    referralCount: user.referralSignups,
    signups: user.referralSignups,
    bonusMonitors: user.referralBonusMonitors,
    proUntil: user.referralProUntil?.toISOString() ?? null,
    pendingRewards: 0,
    status: "active",
    rewards: {
      referrerBonusMonitors: REFERRER_BONUS_MONITORS,
      refereeProDays: REFEREE_PRO_DAYS,
    },
  };
}

/**
 * Attach referredBy when a new user signs up with ?ref=CODE.
 * Rewards: +1 monitor slot for referrer, 7-day Pro trial for referee (non-spammy).
 */
export async function applyReferralOnSignup(
  newUserId: string,
  referralCode: string | null | undefined
): Promise<boolean> {
  const code = referralCode?.trim().toUpperCase();
  if (!code) return false;

  const referrer = await prisma.user.findFirst({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!referrer || referrer.id === newUserId) return false;

  const me = await prisma.user.findUnique({
    where: { id: newUserId },
    select: { referredBy: true, subscription: { select: { plan: true } } },
  });
  if (me?.referredBy) return false;

  const proUntil = new Date();
  proUntil.setDate(proUntil.getDate() + REFEREE_PRO_DAYS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: newUserId },
      data: {
        referredBy: code,
        // Only grant trial Pro if still on FREE
        ...(me?.subscription?.plan === Plan.FREE || !me?.subscription
          ? { referralProUntil: proUntil }
          : {}),
      },
    }),
    prisma.user.update({
      where: { id: referrer.id },
      data: {
        referralSignups: { increment: 1 },
        referralBonusMonitors: { increment: REFERRER_BONUS_MONITORS },
      },
    }),
  ]);

  await trackEvent({
    type: "signup_from_report",
    userId: newUserId,
    metadata: { source: "referral", code, referrerId: referrer.id },
  });

  return true;
}
