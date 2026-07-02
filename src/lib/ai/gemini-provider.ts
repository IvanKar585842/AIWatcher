import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AIProvider,
  CHANGE_ANALYSIS_PROMPT,
  parseChangeAnalysis,
} from "./types";

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
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

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const content = result.response.text();
    if (!content) throw new Error("Empty response from Gemini");
    return parseChangeAnalysis(content);
  }
}

function truncateContent(content: string, maxLength = 12000): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "\n...[truncated]";
}
