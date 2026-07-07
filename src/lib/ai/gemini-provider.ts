import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AIProvider,
  buildAnalysisPrompt,
  parseChangeAnalysis,
} from "./types";
import { truncateContent, withRetry } from "./utils";

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
    });
  }
}
