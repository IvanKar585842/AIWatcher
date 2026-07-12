import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";

const DEFAULT_MESSAGE_LIMIT = 80;

/**
 * Lightweight ownership check — no message payload.
 */
export async function assertUserConversationOwned(userId: string, conversationId: string) {
  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      id: true,
      title: true,
      userId: true,
      summary: true,
      _count: { select: { messages: true } },
    },
  });
  if (!conversation) {
    throw new ApiError("Conversation not found", 404);
  }
  return conversation;
}

export async function getUserConversation(
  userId: string,
  conversationId: string,
  messageLimit = DEFAULT_MESSAGE_LIMIT
) {
  const conversation = await prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: messageLimit,
      },
    },
  });

  if (!conversation) return null;

  // Chronological order for UI
  return {
    ...conversation,
    messages: [...conversation.messages].reverse(),
  };
}

export async function assertUserConversation(userId: string, conversationId: string) {
  const conversation = await getUserConversation(userId, conversationId);
  if (!conversation) {
    throw new ApiError("Conversation not found", 404);
  }
  return conversation;
}
