export const CHAT_LIMITS = {
  MAX_USER_MESSAGE_CHARS: 2000,
  MAX_MESSAGE_IN_CONTEXT_CHARS: 1200,
  MAX_CONTEXT_CHARS: 6000,
  MAX_RESPONSE_TOKENS_SIMPLE: 800,
  MAX_RESPONSE_TOKENS_ADVANCED: 1500,
  RECENT_TURN_COUNT: 6,
  SUMMARIZE_AFTER_MESSAGES: 14,
  KEEP_MESSAGES_AFTER_SUMMARY: 4,
  KNOWLEDGE_CHUNK_MAX: 4,
} as const;

export const CHAT_DAILY_LIMITS = {
  FREE: 20,
  PRO: 200,
  BUSINESS: 1000,
} as const;

/** Prefer plan entitlements — these numbers mirror PLAN_ENTITLEMENTS.chatDailyMessages */

export type ChatModelTier = "fast" | "advanced" | "summarize";

export function getChatModelId(tier: ChatModelTier): string {
  switch (tier) {
    case "advanced":
      return (
        process.env.OPENAI_CHAT_MODEL_ADVANCED?.trim() ||
        process.env.OPENAI_MODEL?.trim() ||
        "gpt-4o"
      );
    case "summarize":
      return (
        process.env.OPENAI_CHAT_MODEL_SUMMARIZE?.trim() ||
        process.env.OPENAI_CHAT_MODEL_FAST?.trim() ||
        "gpt-4o-mini"
      );
    case "fast":
    default:
      return (
        process.env.OPENAI_CHAT_MODEL_FAST?.trim() ||
        process.env.OPENAI_CHAT_MODEL?.trim() ||
        process.env.OPENAI_MODEL?.trim() ||
        "gpt-4o-mini"
      );
  }
}

export const MODEL_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2.0, output: 8.0 },
};

export function getModelPricing(model: string): { input: number; output: number } {
  if (MODEL_PRICING_USD_PER_1M[model]) return MODEL_PRICING_USD_PER_1M[model];
  if (model.includes("mini")) return MODEL_PRICING_USD_PER_1M["gpt-4o-mini"];
  return MODEL_PRICING_USD_PER_1M["gpt-4o"];
}
