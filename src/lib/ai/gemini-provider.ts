import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AIProvider,
  buildAnalysisPrompt,
  parseChangeAnalysis,
} from "./types";
import { truncateContent, withRetry } from "./utils";

const SYSTEM_INSTRUCTION = `You are WatchFlowing's change analyst.
Return structured JSON only. Be specific — never summarize as merely "Content changed."
Write a 2–4 sentence summary, concrete "what changed" bullets, categoryLabel, and potentialImpact.
Honor the user's monitoring prompt when deciding importance and shouldNotify.
Set shouldNotify=false for noise: ads, timestamps, cookie banners, minor formatting, tracking params.`;

export class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
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
        systemInstruction: SYSTEM_INSTRUCTION,
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
