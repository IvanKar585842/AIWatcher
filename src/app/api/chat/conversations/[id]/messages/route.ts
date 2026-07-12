import { NextRequest } from "next/server";
import { ChatMessageRole } from "@prisma/client";
import { resolveCachedAnswer, storeCachedAnswerIfWorthwhile } from "@/lib/ai/chat-cache";
import { buildOptimizedContext, buildConversationTitle } from "@/lib/ai/chat-context";
import { assertChatDailyLimit } from "@/lib/ai/chat-limits";
import { streamCachedResponse, streamChatCompletion, isChatOpenAIConfigured } from "@/lib/ai/chat-openai";
import { trackEvent } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { assertUserConversationOwned } from "@/lib/chat/access";
import { prisma } from "@/lib/db";
import { apiFailureFromError } from "@/lib/api-response";
import { ApiError, parseJsonBody } from "@/lib/errors";
import { withChatRateLimit } from "@/lib/rate-limit";
import { chatMessageSchema } from "@/lib/validations";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;

  try {
    const user = await requireUser();

    return withChatRateLimit(user.id, async () => {
      await assertChatDailyLimit(user);

      const body = await parseJsonBody(request);
      const parsed = chatMessageSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(parsed.error.errors[0]?.message ?? "Invalid message", 400);
      }

      const conversation = await assertUserConversationOwned(user.id, conversationId);
      const userContent = parsed.data.content.trim();

      await prisma.chatMessage.create({
        data: {
          conversationId,
          role: ChatMessageRole.USER,
          content: userContent,
        },
      });

      const isFirstMessage = conversation._count.messages === 0;
      if (isFirstMessage || conversation.title === "New conversation") {
        await prisma.chatConversation.update({
          where: { id: conversationId },
          data: { title: buildConversationTitle(userContent), updatedAt: new Date() },
        });
      } else {
        await prisma.chatConversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      }

      // FAQ / shared cache: skip expensive context build + OpenAI
      const cached = await resolveCachedAnswer(userContent);
      if (cached) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              const result = await streamCachedResponse(cached.answer, (token) => {
                controller.enqueue(encoder.encode(token));
              });

              await prisma.chatMessage.create({
                data: {
                  conversationId,
                  role: ChatMessageRole.ASSISTANT,
                  content: result.content,
                  promptTokens: result.promptTokens,
                  completionTokens: result.completionTokens,
                  totalTokens: result.totalTokens,
                  costUsd: result.costUsd,
                  model: result.model,
                  cached: true,
                },
              });

              await trackEvent({
                type: "ai.chat",
                userId: user.id,
                metadata: {
                  conversationId,
                  model: result.model,
                  cached: true,
                  tokens: result.totalTokens,
                  accountContext: false,
                  cacheSource: cached.source,
                },
              });

              await prisma.chatConversation.update({
                where: { id: conversationId },
                data: {
                  updatedAt: new Date(),
                  totalTokens: { increment: result.totalTokens },
                  totalCostUsd: { increment: result.costUsd },
                },
              });

              controller.close();
            } catch (error) {
              console.error("[chat] cache stream error:", error);
              controller.enqueue(
                encoder.encode("\n\n[Error: Failed to generate response. Please try again.]")
              );
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Conversation-Id": conversationId,
            "X-Chat-Cache": cached.source,
          },
        });
      }

      if (!isChatOpenAIConfigured()) {
        throw new ApiError(
          "OpenAI is not configured. Add OPENAI_API_KEY to .env.local and restart the dev server.",
          503
        );
      }

      const { turns, systemPrompt, usedAccountContext } = await buildOptimizedContext(
        conversationId,
        userContent,
        user.id
      );

      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const result = await streamChatCompletion(
              systemPrompt,
              turns,
              userContent,
              (token) => {
                controller.enqueue(encoder.encode(token));
              }
            );

            if (result.model !== "cache" && !usedAccountContext) {
              await storeCachedAnswerIfWorthwhile(userContent, result.content);
            }

            await prisma.chatMessage.create({
              data: {
                conversationId,
                role: ChatMessageRole.ASSISTANT,
                content: result.content,
                promptTokens: result.promptTokens,
                completionTokens: result.completionTokens,
                totalTokens: result.totalTokens,
                costUsd: result.costUsd,
                model: result.model,
                cached: false,
              },
            });

            await trackEvent({
              type: "ai.chat",
              userId: user.id,
              metadata: {
                conversationId,
                model: result.model,
                cached: false,
                tokens: result.totalTokens,
                accountContext: usedAccountContext,
              },
            });

            await prisma.chatConversation.update({
              where: { id: conversationId },
              data: {
                updatedAt: new Date(),
                totalTokens: { increment: result.totalTokens },
                totalCostUsd: { increment: result.costUsd },
              },
            });

            controller.close();
          } catch (error) {
            console.error("[chat] stream error:", error);
            controller.enqueue(
              encoder.encode("\n\n[Error: Failed to generate response. Please try again.]")
            );
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Conversation-Id": conversationId,
        },
      });
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    const response = apiFailureFromError(error);
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }
}
