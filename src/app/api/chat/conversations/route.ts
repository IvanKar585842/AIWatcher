import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { parseJsonBody, ApiError } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { chatDeleteAllSchema } from "@/lib/validations";

export async function GET() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "chat-conversations-list",
      async () => {
        const conversations = await prisma.chatConversation.findMany({
          where: { userId: user.id },
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true, role: true, createdAt: true },
            },
            _count: { select: { messages: true } },
          },
        });

        return NextResponse.json({ success: true, conversations });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    return withRateLimit(
      "chat-conversations-create",
      async () => {
        const conversation = await prisma.chatConversation.create({
          data: { userId: user.id, title: "New conversation" },
        });
        return NextResponse.json({ success: true, conversation });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    return withRateLimit(
      "chat-conversations-delete-all",
      async () => {
        const body = await parseJsonBody(request);
        const parsed = chatDeleteAllSchema.safeParse(body);
        if (!parsed.success) {
          throw new ApiError('Send { "confirm": "DELETE_ALL" } to clear all history', 400);
        }

        const result = await prisma.chatConversation.deleteMany({
          where: { userId: user.id },
        });

        return NextResponse.json({ success: true, deleted: result.count });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
