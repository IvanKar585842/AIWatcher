import Anthropic from "@anthropic-ai/sdk";
import { AIProvider, buildAnalysisPrompt, parseChangeAnalysis } from "./types";
import { truncateContent, withRetry } from "./utils";

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    this.client = new Anthropic({ apiKey });
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";
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
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("Empty response from Claude");
      }

      return parseChangeAnalysis(textBlock.text);
    });
  }
}
