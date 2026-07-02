import Anthropic from "@anthropic-ai/sdk";
import {
  AIProvider,
  CHANGE_ANALYSIS_PROMPT,
  parseChangeAnalysis,
} from "./types";

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
    oldContent: string;
    newContent: string;
  }) {
    const prompt = CHANGE_ANALYSIS_PROMPT.replace("{url}", params.url)
      .replace("{monitorName}", params.monitorName)
      .replace("{mode}", params.mode)
      .replace("{oldContent}", truncateContent(params.oldContent))
      .replace("{newContent}", truncateContent(params.newContent));

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
  }
}

function truncateContent(content: string, maxLength = 12000): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "\n...[truncated]";
}
