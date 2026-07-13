import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { requireUser } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-response";
import { ApiError } from "@/lib/errors";
import { getAIProviderType, isAIConfigured } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { classifyMonitoringError } from "@/lib/monitoring/error-messages";
import { withRateLimit } from "@/lib/rate-limit";
import { assertMonitorOwnedBy } from "@/lib/security/ownership";

export const maxDuration = 30;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "the website";
  }
}

async function generateExplanation(prompt: string): Promise<string> {
  const type = getAIProviderType();

  if (type === "openai" && process.env.OPENAI_API_KEY) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You explain website monitoring failures to non-technical SaaS users. Be concise, calm, and practical. Never invent stack traces or internal details.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 220,
    });
    const text = response.choices[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty AI response");
    return text;
  }

  if (type === "claude" && process.env.ANTHROPIC_API_KEY) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest",
      max_tokens: 220,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content.find((c) => c.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) throw new Error("Empty AI response");
    return text;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new ApiError("AI explanations are not enabled", 503);
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
  });
  const result = await model.generateContent(prompt);
  const text = result.response.text()?.trim();
  if (!text) throw new Error("Empty AI response");
  return text;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const user = await requireUser();
    return withRateLimit(
      `monitor-explain-error-${id}`,
      async () => {
        await assertMonitorOwnedBy(user.id, id);

        if (!isAIConfigured()) {
          throw new ApiError(
            "AI explanations are not enabled for this workspace.",
            503
          );
        }

        const monitor = await prisma.monitor.findUnique({
          where: { id },
          select: { url: true, errorMessage: true, name: true },
        });

        if (!monitor?.errorMessage) {
          throw new ApiError("This monitor has no failed check to explain.", 400);
        }

        const info = classifyMonitoringError(monitor.errorMessage);
        const host = hostnameOf(monitor.url);

        // Minimal payload only — no HTML, snapshots, or stack traces
        const prompt = [
          "Explain why this website monitoring check failed.",
          "Write 3 short sentences covering: what happened, why it likely happened, and what the user can do.",
          "Do not invent HTTP codes. Do not mention databases, browsers, or stack traces.",
          "",
          `Website host: ${host}`,
          `Monitor name: ${monitor.name.slice(0, 80)}`,
          `Status kind: ${info.kind}`,
          `User-facing title: ${info.title}`,
          `Known explanation: ${info.description}`,
          `Technical hint (optional): ${info.technical?.slice(0, 120) ?? "none"}`,
        ].join("\n");

        try {
          const explanation = await generateExplanation(prompt);
          return NextResponse.json({
            success: true,
            explanation,
            kind: info.kind,
          });
        } catch (error) {
          console.error("[monitoring][explain-error]", {
            monitorId: id,
            kind: info.kind,
            error: error instanceof Error ? error.message : String(error),
          });
          throw new ApiError(
            "Could not generate an explanation right now. Please try again.",
            502
          );
        }
      },
      user.id,
      "sensitive"
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
