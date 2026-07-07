import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit";
import { getUserConversation } from "@/lib/chat/access";
import { chatRenameSchema } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    return withRateLimit(
      `chat-conversation-${id}`,
      async () => {
        const conversation = await getUserConversation(user.id, id);
        if (!conversation) {
          return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, conversation });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    return withRateLimit(
      `chat-conversation-patch-${id}`,
      async () => {
        const existing = await getUserConversation(user.id, id);
        if (!existing) {
          return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        const body = await parseJsonBody(request);
        const parsed = chatRenameSchema.safeParse(body);
        if (!parsed.success) {
          throw new ApiError("Invalid title", 400);
        }

        const conversation = await prisma.chatConversation.update({
          where: { id },
          data: { title: parsed.data.title },
        });

        return NextResponse.json({ success: true, conversation });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    return withRateLimit(
      `chat-conversation-delete-${id}`,
      async () => {
        const existing = await getUserConversation(user.id, id);
        if (!existing) {
          return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
        }

        await prisma.chatConversation.delete({ where: { id } });
        return NextResponse.json({ success: true });
      },
      user.id
    );
  } catch (error) {
    return apiFailureFromError(error);
  }
}
