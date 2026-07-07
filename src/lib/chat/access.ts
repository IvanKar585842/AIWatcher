import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";

export async function getUserConversation(userId: string, conversationId: string) {
  return prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function assertUserConversation(userId: string, conversationId: string) {
  const conversation = await getUserConversation(userId, conversationId);
  if (!conversation) {
    throw new ApiError("Conversation not found", 404);
  }
  return conversation;
}
