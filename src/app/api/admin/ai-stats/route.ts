import { ChatMessageRole } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { apiFailureFromError, apiSuccess } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    return withRateLimit(
      "admin-ai-stats",
      async () => {
        const today = startOfUtcDay();

        const [
          totalRequests,
          cachedRequests,
          tokensAgg,
          costAgg,
          todayRequests,
          avgResponseLength,
          topUsersByCost,
          requestsByModel,
        ] = await Promise.all([
          prisma.chatMessage.count({
            where: { role: ChatMessageRole.ASSISTANT },
          }),
          prisma.chatMessage.count({
            where: { role: ChatMessageRole.ASSISTANT, cached: true },
          }),
          prisma.chatMessage.aggregate({
            where: { role: ChatMessageRole.ASSISTANT },
            _sum: { totalTokens: true, promptTokens: true, completionTokens: true },
            _avg: { totalTokens: true, completionTokens: true },
          }),
          prisma.chatMessage.aggregate({
            where: { role: ChatMessageRole.ASSISTANT, cached: false },
            _sum: { costUsd: true },
            _avg: { costUsd: true },
          }),
          prisma.chatMessage.count({
            where: {
              role: ChatMessageRole.ASSISTANT,
              createdAt: { gte: today },
            },
          }),
          prisma.chatMessage.aggregate({
            where: { role: ChatMessageRole.ASSISTANT },
            _avg: { completionTokens: true },
          }),
          prisma.chatMessage.groupBy({
            by: ["conversationId"],
            where: {
              role: ChatMessageRole.ASSISTANT,
              cached: false,
              costUsd: { gt: 0 },
            },
            _sum: { costUsd: true, totalTokens: true },
            _count: { id: true },
          }),
          prisma.chatMessage.groupBy({
            by: ["model"],
            where: { role: ChatMessageRole.ASSISTANT },
            _count: { id: true },
            _sum: { totalTokens: true, costUsd: true },
          }),
        ]);

        const conversationIds = topUsersByCost
          .sort((a, b) => (b._sum.costUsd ?? 0) - (a._sum.costUsd ?? 0))
          .slice(0, 20)
          .map((r) => r.conversationId);
        const conversations = await prisma.chatConversation.findMany({
          where: { id: { in: conversationIds } },
          select: {
            id: true,
            user: { select: { id: true, email: true, name: true } },
          },
        });
        const convUserMap = new Map(conversations.map((c) => [c.id, c.user]));

        const userCostMap = new Map<
          string,
          { email: string; name: string | null; costUsd: number; tokens: number; requests: number }
        >();

        for (const row of topUsersByCost) {
          const user = convUserMap.get(row.conversationId);
          if (!user) continue;
          const existing = userCostMap.get(user.id);
          const cost = row._sum.costUsd ?? 0;
          const tokens = row._sum.totalTokens ?? 0;
          const requests = row._count.id;

          if (existing) {
            existing.costUsd += cost;
            existing.tokens += tokens;
            existing.requests += requests;
          } else {
            userCostMap.set(user.id, {
              email: user.email,
              name: user.name,
              costUsd: cost,
              tokens,
              requests,
            });
          }
        }

        const expensiveUsers = Array.from(userCostMap.values())
          .sort((a, b) => b.costUsd - a.costUsd)
          .slice(0, 8);

        const totalUsers = await prisma.user.count();
        const totalCost = costAgg._sum.costUsd ?? 0;

        return apiSuccess({
          totalRequests,
          cachedRequests,
          cacheHitRate:
            totalRequests > 0 ? Math.round((cachedRequests / totalRequests) * 1000) / 10 : 0,
          requestsToday: todayRequests,
          totalTokens: tokensAgg._sum.totalTokens ?? 0,
          totalPromptTokens: tokensAgg._sum.promptTokens ?? 0,
          totalCompletionTokens: tokensAgg._sum.completionTokens ?? 0,
          avgTokensPerRequest: Math.round(tokensAgg._avg.totalTokens ?? 0),
          avgCompletionTokens: Math.round(avgResponseLength._avg.completionTokens ?? 0),
          totalCostUsd: Math.round(totalCost * 10000) / 10000,
          avgCostPerRequest: Math.round((costAgg._avg.costUsd ?? 0) * 1_000_000) / 1_000_000,
          avgCostPerUser:
            totalUsers > 0 ? Math.round((totalCost / totalUsers) * 1_000_000) / 1_000_000 : 0,
          expensiveUsers,
          requestsByModel: requestsByModel.map((m) => ({
            model: m.model ?? "unknown",
            requests: m._count.id,
            tokens: m._sum.totalTokens ?? 0,
            costUsd: Math.round((m._sum.costUsd ?? 0) * 10000) / 10000,
          })),
          cacheEntries: await prisma.chatAnswerCache.count(),
        });
      },
      admin.id,
      "admin"
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
