import { prisma } from "@/lib/db";

const RETENTION_DAYS = 30;

export async function cleanupOldChatConversations(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const stale = await prisma.chatConversation.findMany({
    where: { updatedAt: { lt: cutoff } },
    select: { id: true },
  });

  if (stale.length === 0) return 0;

  await prisma.chatConversation.deleteMany({
    where: { id: { in: stale.map((c) => c.id) } },
  });

  return stale.length;
}
