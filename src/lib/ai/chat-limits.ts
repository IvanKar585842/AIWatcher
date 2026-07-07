import { Plan, type User } from "@prisma/client";
import { getEffectivePlan, isAdminUser } from "@/lib/admin";
import { CHAT_DAILY_LIMITS } from "@/lib/ai/chat-config";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";

type ChatLimitUser = Pick<User, "id" | "email" | "role"> & {
  subscription?: { plan: Plan } | null;
};

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function getChatDailyLimit(user: ChatLimitUser): number {
  if (isAdminUser(user)) return Infinity;
  const plan = getEffectivePlan(user);
  return CHAT_DAILY_LIMITS[plan] ?? CHAT_DAILY_LIMITS.FREE;
}

export async function getChatDailyUsage(userId: string): Promise<number> {
  return prisma.chatMessage.count({
    where: {
      role: "USER",
      createdAt: { gte: startOfUtcDay() },
      conversation: { userId },
    },
  });
}

export async function assertChatDailyLimit(user: ChatLimitUser): Promise<void> {
  const limit = getChatDailyLimit(user);
  if (!Number.isFinite(limit)) return;

  const used = await getChatDailyUsage(user.id);
  if (used >= limit) {
    const plan = getEffectivePlan(user);
    const upgradeHint =
      plan === Plan.FREE
        ? " Upgrade to Pro for a higher daily limit."
        : plan === Plan.PRO
          ? " Upgrade to Business for a higher daily limit."
          : "";

    throw new ApiError(
      `Daily AI message limit reached (${limit}/day).${upgradeHint}`,
      429
    );
  }
}

export async function getChatLimitStatus(user: ChatLimitUser): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const limit = getChatDailyLimit(user);
  const used = await getChatDailyUsage(user.id);

  if (!Number.isFinite(limit)) {
    return { used, limit: -1, remaining: -1 };
  }

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}
