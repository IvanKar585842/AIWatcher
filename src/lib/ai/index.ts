import { ClaudeProvider } from "./claude-provider";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";
import type { AIProvider } from "./types";

export type AIProviderType = "openai" | "claude" | "gemini";

let cachedProvider: AIProvider | null = null;
let cachedType: AIProviderType | null = null;

export function getAIProviderType(): AIProviderType {
  const provider = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();
  if (provider === "claude" || provider === "gemini" || provider === "openai") {
    return provider;
  }
  return "gemini";
}

export function createAIProvider(type?: AIProviderType): AIProvider {
  const providerType = type ?? getAIProviderType();

  switch (providerType) {
    case "claude":
      return new ClaudeProvider();
    case "gemini":
      return new GeminiProvider();
    case "openai":
    default:
      return new OpenAIProvider();
  }
}

export function getAIProvider(): AIProvider {
  const type = getAIProviderType();
  if (cachedProvider && cachedType === type) {
    return cachedProvider;
  }
  cachedProvider = createAIProvider(type);
  cachedType = type;
  return cachedProvider;
}

export * from "./types";
