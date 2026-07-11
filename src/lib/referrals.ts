import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

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
      if (updated.referralCode) return updated.referralCode;
    } catch {
      // Unique collision — retry
    }
  }

  throw new Error("Could not allocate referral code");
}

export type ReferralStats = {
  code: string;
  invitePath: string;
  signups: number;
  pendingRewards: number;
  status: "foundation";
};

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await ensureReferralCode(userId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { referralSignups: true },
  });

  return {
    code,
    invitePath: `/sign-up?ref=${encodeURIComponent(code)}`,
    signups: user.referralSignups,
    pendingRewards: 0,
    status: "foundation",
  };
}

/**
 * Attach referredBy when a new user signs up with ?ref=CODE.
 * Does not grant credits — foundation only.
 */
export async function applyReferralOnSignup(
  newUserId: string,
  referralCode: string | null | undefined
): Promise<void> {
  const code = referralCode?.trim().toUpperCase();
  if (!code) return;

  const referrer = await prisma.user.findFirst({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!referrer || referrer.id === newUserId) return;

  const me = await prisma.user.findUnique({
    where: { id: newUserId },
    select: { referredBy: true },
  });
  if (me?.referredBy) return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: newUserId },
      data: { referredBy: code },
    }),
    prisma.user.update({
      where: { id: referrer.id },
      data: { referralSignups: { increment: 1 } },
    }),
  ]);
}
