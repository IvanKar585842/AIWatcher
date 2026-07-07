import OpenAI from "openai";
import { ChatMessageRole } from "@prisma/client";
import { CHAT_LIMITS, getChatModelId } from "./chat-config";
import { buildSystemPrompt } from "./chat-knowledge";
import {
  calculateCostUsd,
  estimateTokens,
  truncateToChars,
} from "./chat-tokens";
import { prisma } from "@/lib/db";

export interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY in environment.");
  }
  return new OpenAI({ apiKey });
}

export async function summarizeConversationMessages(
  messages: Array<{ role: ChatMessageRole; content: string }>,
  existingSummary: string | null
): Promise<{ summary: string; usage: { promptTokens: number; completionTokens: number } }> {
  const client = getOpenAIClient();
  const model = getChatModelId("summarize");

  const transcript = messages
    .filter((m) => m.role !== ChatMessageRole.SYSTEM)
    .map((m) => {
      const role = m.role === ChatMessageRole.USER ? "User" : "Assistant";
      return `${role}: ${truncateToChars(m.content, 800)}`;
    })
    .join("\n");

  const prompt = existingSummary
    ? `Update this conversation summary with new information from the transcript. Keep bullet points concise (max 8 bullets).\n\nExisting summary:\n${existingSummary}\n\nNew messages:\n${transcript}`
    : `Summarize this support conversation in concise bullet points (max 8). Capture: user goals, monitor setup, preferences, issues discussed, resolutions.\n\nTranscript:\n${transcript}`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You compress chat history for a support assistant. Output only bullet points, no preamble.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 400,
  });

  const summary = response.choices[0]?.message?.content?.trim();
  if (!summary) {
    throw new Error("Failed to generate conversation summary");
  }

  const promptTokens = response.usage?.prompt_tokens ?? estimateTokens(prompt);
  const completionTokens =
    response.usage?.completion_tokens ?? estimateTokens(summary);

  return { summary, usage: { promptTokens, completionTokens } };
}

export async function maybeCompressConversation(conversationId: string): Promise<void> {
  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) return;

  const messageCount = conversation.messages.length;
  if (messageCount < CHAT_LIMITS.SUMMARIZE_AFTER_MESSAGES) return;

  const keepCount = CHAT_LIMITS.KEEP_MESSAGES_AFTER_SUMMARY * 2;
  const toSummarize = conversation.messages.slice(0, -keepCount);
  if (toSummarize.length < 6) return;

  const lastSummarizedAt = conversation.summaryUpdatedAt;
  const messagesSinceSummary = lastSummarizedAt
    ? conversation.messages.filter((m) => m.createdAt > lastSummarizedAt).length
    : messageCount;

  if (messagesSinceSummary < 8 && conversation.summary) return;

  const { summary, usage } = await summarizeConversationMessages(
    toSummarize,
    conversation.summary
  );

  const model = getChatModelId("summarize");
  const costUsd = calculateCostUsd(model, usage.promptTokens, usage.completionTokens);
  const totalTokens = usage.promptTokens + usage.completionTokens;

  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: {
      summary,
      summaryUpdatedAt: new Date(),
      totalTokens: { increment: totalTokens },
      totalCostUsd: { increment: costUsd },
    },
  });
}

export async function buildOptimizedContext(
  conversationId: string,
  userMessage: string
): Promise<{ turns: ChatTurn[]; systemPrompt: string }> {
  await maybeCompressConversation(conversationId);

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const systemPrompt = buildSystemPrompt(userMessage);
  const turns: ChatTurn[] = [];

  if (conversation.summary) {
    turns.push({
      role: "system",
      content: `Conversation summary:\n${conversation.summary}`,
    });
  }

  const recent = conversation.messages.slice(-CHAT_LIMITS.RECENT_TURN_COUNT * 2);

  for (const msg of recent) {
    if (msg.role === ChatMessageRole.SYSTEM) continue;
    turns.push({
      role: msg.role === ChatMessageRole.ASSISTANT ? "assistant" : "user",
      content: truncateToChars(msg.content, CHAT_LIMITS.MAX_MESSAGE_IN_CONTEXT_CHARS),
    });
  }

  let totalChars =
    systemPrompt.length + turns.reduce((sum, t) => sum + t.content.length, 0);

  while (totalChars > CHAT_LIMITS.MAX_CONTEXT_CHARS && turns.length > 2) {
    const removed = turns.shift();
    if (removed?.role === "system" && conversation.summary) {
      turns.unshift({
        role: "system",
        content: `Conversation summary:\n${truncateToChars(conversation.summary, 1500)}`,
      });
    }
    totalChars =
      systemPrompt.length + turns.reduce((sum, t) => sum + t.content.length, 0);
  }

  return { turns, systemPrompt };
}

export function buildConversationTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 48) return cleaned || "New conversation";
  return `${cleaned.slice(0, 45)}…`;
}
