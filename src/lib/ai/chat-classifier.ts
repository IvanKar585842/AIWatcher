import type { ChatModelTier } from "./chat-config";

const ADVANCED_PATTERNS: RegExp[] = [
  /\btroubleshoot/i,
  /\berror\b/i,
  /\bfailed\b/i,
  /\bdoesn'?t work/i,
  /\bnot working/i,
  /\bwhy (is|did|won'?t|doesn'?t)/i,
  /\bdebug/i,
  /\bcompare\b/i,
  /\bxpath\b/i,
  /\bcss selector/i,
  /\brobots\.txt/i,
  /\bplaywright/i,
  /\bintegration\b/i,
  /\bapi (monitor|endpoint|response)/i,
  /\bselector\b/i,
  /\bstack trace/i,
  /\broot cause/i,
  /не работает/i,
  /ошибк/i,
  /почему не/i,
  /не приходит/i,
];

const SIMPLE_PATTERNS: RegExp[] = [
  /^how (do|can) i\b/i,
  /^what is\b/i,
  /^where (is|can)\b/i,
  /^how does\b/i,
  /^как (создать|добавить|настроить)/i,
  /^что такое/i,
  /^где найти/i,
];

export function selectModelTier(
  userMessage: string,
  conversationLength: number
): ChatModelTier {
  if (ADVANCED_PATTERNS.some((p) => p.test(userMessage))) {
    return "advanced";
  }

  if (userMessage.length > 600 || conversationLength > 10) {
    return "advanced";
  }

  if (SIMPLE_PATTERNS.some((p) => p.test(userMessage.trim()))) {
    return "fast";
  }

  return "fast";
}

export function getMaxResponseTokens(tier: ChatModelTier): number {
  return tier === "advanced" ? 1500 : 800;
}
