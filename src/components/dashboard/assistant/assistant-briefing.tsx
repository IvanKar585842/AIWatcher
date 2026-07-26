"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type InsightTone = "info" | "ok" | "warn" | "critical";

export type AssistantInsight = {
  id: string;
  text: string;
  tone: InsightTone;
};

export type AssistantRecommendation = {
  id: string;
  text: string;
};

type BriefingResponse = {
  hasMonitors: boolean;
  insights: AssistantInsight[];
  recommendations: AssistantRecommendation[];
  suggestedQuestions: string[];
};

const TONE_STYLES: Record<InsightTone, string> = {
  info: "border-white/[0.08] bg-white/[0.03] text-zinc-300",
  ok: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  warn: "border-amber-400/25 bg-amber-500/10 text-amber-100",
  critical: "border-red-400/25 bg-red-500/10 text-red-100",
};

function ToneIcon({ tone }: { tone: InsightTone }) {
  if (tone === "ok") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  if (tone === "warn") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />;
  if (tone === "critical") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />;
  return <Info className="h-3.5 w-3.5 shrink-0 text-cyan-400" />;
}

export function useAssistantBriefing(enabled = true) {
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat/insights");
      if (!res.ok) {
        setBriefing(null);
        return;
      }
      const data = await res.json();
      setBriefing({
        hasMonitors: Boolean(data.hasMonitors),
        insights: data.insights ?? [],
        recommendations: data.recommendations ?? [],
        suggestedQuestions: data.suggestedQuestions ?? [],
      });
    } catch {
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);

  return { briefing, loading, reload };
}

export function AssistantBriefingPanel({
  briefing,
  loading,
  onAsk,
  compact = false,
}: {
  briefing: BriefingResponse | null;
  loading: boolean;
  onAsk: (question: string) => void;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
        Analyzing your account…
      </div>
    );
  }

  if (!briefing) return null;

  const questions =
    briefing.suggestedQuestions.length > 0
      ? briefing.suggestedQuestions
      : [
          "What changed today?",
          "Which changes are important?",
          "Which websites need attention?",
          "Why did I receive a notification?",
        ];

  return (
    <div className={cn("w-full", compact ? "max-w-none" : "max-w-lg")}>
      {briefing.insights.length > 0 && (
        <div className="mb-4 space-y-2 text-left">
          <p className="px-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-500/70">
            Live insights
          </p>
          {briefing.insights.map((insight) => (
            <div
              key={insight.id}
              className={cn(
                "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-xs leading-relaxed",
                TONE_STYLES[insight.tone]
              )}
            >
              <ToneIcon tone={insight.tone} />
              <span>{insight.text}</span>
            </div>
          ))}
        </div>
      )}

      {briefing.recommendations.length > 0 && (
        <div className="mb-4 space-y-2 text-left">
          <p className="flex items-center gap-1.5 px-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            <Lightbulb className="h-3 w-3 text-amber-400/80" />
            Recommendations
          </p>
          {briefing.recommendations.map((rec) => (
            <button
              key={rec.id}
              type="button"
              onClick={() => onAsk(rec.text)}
              className="flex w-full items-start gap-2 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5 text-left text-xs text-zinc-400 transition-colors hover:border-cyan-400/20 hover:text-cyan-200"
            >
              <span className="mt-0.5 text-cyan-500/60">→</span>
              <span>{rec.text}</span>
            </button>
          ))}
        </div>
      )}

      <div className={cn("grid gap-2", compact ? "" : "sm:grid-cols-2")}>
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            className="min-h-11 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5 text-left text-xs text-zinc-400 transition-colors hover:border-cyan-400/20 hover:text-cyan-200"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
