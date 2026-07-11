import OpenAI from "openai";
import type { ChatModelTier } from "./chat-config";
import { CHAT_LIMITS, getChatModelId } from "./chat-config";
import { getMaxResponseTokens, selectModelTier } from "./chat-classifier";
import type { ChatTurn } from "./chat-context";
import {
  calculateCostUsd,
  estimateTokens,
  streamTextChunks,
} from "./chat-tokens";

export interface ChatCompletionResult {
  content: string;
  model: string;
  tier: ChatModelTier;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export function isChatOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OpenAI is not configured. Add OPENAI_API_KEY to .env.local (it overrides .env) and restart the dev server."
    );
  }
  return new OpenAI({ apiKey });
}

export async function streamChatCompletion(
  systemPrompt: string,
  history: ChatTurn[],
  userMessage: string,
  onToken: (token: string) => void
): Promise<ChatCompletionResult> {
  const client = getOpenAIClient();
  const tier = selectModelTier(userMessage, history.length);
  const model = getChatModelId(tier);
  const maxTokens = getMaxResponseTokens(tier);

  // Ensure the current user turn is included for the model
  const turns = [...history];
  const last = turns[turns.length - 1];
  if (!(last?.role === "user" && last.content === userMessage)) {
    turns.push({ role: "user", content: userMessage });
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...turns.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  ];

  const stream = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.4,
    max_tokens: maxTokens,
    stream: true,
    stream_options: { include_usage: true },
  });

  let fullText = "";
  let promptTokens = estimateTokens(systemPrompt + history.map((h) => h.content).join(""));
  let completionTokens = 0;

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? "";
    if (token) {
      fullText += token;
      onToken(token);
    }

    if (chunk.usage) {
      promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
      completionTokens = chunk.usage.completion_tokens ?? completionTokens;
    }
  }

  if (!fullText.trim()) {
    throw new Error("Empty response from OpenAI");
  }

  if (!completionTokens) {
    completionTokens = estimateTokens(fullText);
  }

  const totalTokens = promptTokens + completionTokens;
  const costUsd = calculateCostUsd(model, promptTokens, completionTokens);

  return {
    content: fullText,
    model,
    tier,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
  };
}

export async function streamCachedResponse(
  answer: string,
  onToken: (token: string) => void
): Promise<ChatCompletionResult> {
  await streamTextChunks(answer, onToken);

  const completionTokens = estimateTokens(answer);

  return {
    content: answer,
    model: "cache",
    tier: "fast",
    promptTokens: 0,
    completionTokens,
    totalTokens: completionTokens,
    costUsd: 0,
  };
}

export { CHAT_LIMITS };
