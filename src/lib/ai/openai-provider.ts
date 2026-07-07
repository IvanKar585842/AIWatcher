import OpenAI from "openai";
import { AIProvider, buildAnalysisPrompt, parseChangeAnalysis } from "./types";
import { truncateContent, withRetry } from "./utils";

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  }

  async analyzeChange(params: {
    url: string;
    monitorName: string;
    mode: string;
    oldHtml: string;
    newHtml: string;
    userPrompt?: string;
  }) {
    const prompt = buildAnalysisPrompt({
      ...params,
      oldHtml: truncateContent(params.oldHtml),
      newHtml: truncateContent(params.newHtml),
    });

    return withRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "You are a precise web change analyst. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from OpenAI");
      return parseChangeAnalysis(content);
    });
  }
}
