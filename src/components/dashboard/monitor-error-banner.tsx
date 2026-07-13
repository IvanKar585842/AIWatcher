"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Clock,
  Link2,
  Loader2,
  ShieldAlert,
  Sparkles,
  WifiOff,
} from "lucide-react";
import {
  classifyMonitoringError,
  type MonitoringErrorInfo,
  type MonitoringErrorTone,
} from "@/lib/monitoring/error-messages";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<MonitoringErrorTone, string> = {
  red: "border-red-500/30 bg-red-500/[0.08] text-red-100",
  amber: "border-amber-500/30 bg-amber-500/[0.08] text-amber-100",
  zinc: "border-white/[0.08] bg-white/[0.03] text-zinc-200",
  emerald: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-100",
};

const ICON_TONE: Record<MonitoringErrorTone, string> = {
  red: "text-red-300",
  amber: "text-amber-300",
  zinc: "text-zinc-400",
  emerald: "text-emerald-300",
};

function ErrorIcon({ info }: { info: MonitoringErrorInfo }) {
  const cls = cn("h-4 w-4 shrink-0", ICON_TONE[info.tone]);
  switch (info.icon) {
    case "shield":
      return <ShieldAlert className={cls} />;
    case "clock":
      return <Clock className={cls} />;
    case "wifi-off":
      return <WifiOff className={cls} />;
    case "link":
      return <Link2 className={cls} />;
    case "bot":
      return <Bot className={cls} />;
    case "check":
      return <AlertTriangle className={cls} />;
    default:
      return <AlertTriangle className={cls} />;
  }
}

export function MonitorErrorBanner({
  errorMessage,
  monitorId,
  compact,
  onRetry,
  retrying,
}: {
  errorMessage: string;
  monitorId?: string;
  compact?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const info = classifyMonitoringError(errorMessage);
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function askAi() {
    if (!monitorId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/monitors/${monitorId}/explain-error`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(
          typeof data.error === "string"
            ? data.error
            : "Could not generate an explanation right now."
        );
        return;
      }
      setAiText(typeof data.explanation === "string" ? data.explanation : null);
    } catch {
      setAiError("Could not reach the AI explanation service.");
    } finally {
      setAiLoading(false);
    }
  }

  if (compact) {
    return (
      <p
        className={cn(
          "mt-3 truncate rounded-lg border px-3 py-2 text-[11px]",
          TONE_STYLES[info.tone]
        )}
        title={info.description}
      >
        {info.title}
      </p>
    );
  }

  return (
    <div className={cn("rounded-xl border px-4 py-4", TONE_STYLES[info.tone])}>
      <div className="flex items-start gap-3">
        <ErrorIcon info={info} />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">
              Monitoring result · {info.statusLabel}
            </p>
            <h3 className="mt-1 text-sm font-semibold text-zinc-50">{info.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{info.description}</p>
          </div>

          {info.suggestions.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-500">
              {info.suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/[0.1] bg-black/30 px-3 text-xs text-zinc-200 transition hover:border-cyan-400/30 hover:text-cyan-100 disabled:opacity-50"
              >
                {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Retry check
              </button>
            )}
            {monitorId && (
              <button
                type="button"
                onClick={askAi}
                disabled={aiLoading}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 text-xs text-cyan-100 transition hover:border-cyan-300/40 disabled:opacity-50"
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Why did this check fail?
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpenAdvanced((v) => !v)}
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Advanced details
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition", openAdvanced && "rotate-180")}
              />
            </button>
          </div>

          {openAdvanced && (
            <div className="rounded-lg border border-white/[0.06] bg-black/40 px-3 py-2 font-mono text-[11px] text-zinc-500">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">
                Technical information
              </p>
              <p className="mt-1 break-all text-zinc-400">
                {info.technical || "No additional technical detail recorded."}
              </p>
              <p className="mt-2 text-zinc-600">Status code / kind: {info.kind}</p>
            </div>
          )}

          {aiError && <p className="text-xs text-red-300/90">{aiError}</p>}
          {aiText && (
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] px-3 py-2 text-xs leading-relaxed text-cyan-50/90">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-cyan-400/70">
                AI explanation
              </p>
              {aiText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
