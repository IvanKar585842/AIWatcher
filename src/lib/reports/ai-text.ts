/**
 * Lightweight text generation for weekly reports.
 * Does NOT modify analyzeChange / monitoring AI path.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { getAIProviderType, isAIConfigured } from "@/lib/ai";
import { withRetry } from "@/lib/ai/utils";

export async function generateReportText(
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  if (!isAIConfigured()) return null;

  const type = getAIProviderType();

  try {
    if (type === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY!.trim();
      const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
      const client = new GoogleGenerativeAI(apiKey);
      return await withRetry(async () => {
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
          generationConfig: { temperature: 0.3, maxOutputTokens: 900 },
        });
        const result = await model.generateContent(userPrompt);
        return result.response.text()?.trim() || null;
      });
    }

    if (type === "openai") {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
      const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
      return await withRetry(async () => {
        const response = await client.chat.completions.create({
          model,
          temperature: 0.3,
          max_tokens: 900,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        return response.choices[0]?.message?.content?.trim() || null;
      });
    }

    // Claude — use Anthropic messages if key present; otherwise skip AI
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (type === "claude" && anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
          max_tokens: 900,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      return data.content?.find((c) => c.type === "text")?.text?.trim() || null;
    }

    return null;
  } catch {
    return null;
  }
}
