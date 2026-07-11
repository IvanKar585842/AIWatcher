import { Plan, type User } from "@prisma/client";
import { getEffectivePlan, getUserPlanEntitlements, isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { getUpgradeCopy } from "@/lib/plan-features";

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
  return getUserPlanEntitlements(user).chatDailyMessages;
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
    const copy = getUpgradeCopy("AI_ANALYSIS");
    const plan = getEffectivePlan(user);
    throw new ApiError(
      plan === Plan.BUSINESS
        ? `Daily AI assistant limit reached (${limit}/day).`
        : `${copy.title} You've used today's ${limit} assistant messages. ${copy.description}`,
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
