"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Loader2, Radar, ShieldCheck } from "lucide-react";

type ScoreResponse = {
  preview: boolean;
  overallScore: number;
  hostname: string;
  url: string;
  dimensions: Array<{
    key: string;
    label: string;
    score: number;
    notes: string[];
  }>;
  risksPreview?: string[];
  recommendations?: string[];
  risks?: string[];
  changeFrequencyHint?: string;
  cta?: { title: string; description: string; href: string };
  sharePath?: string;
  publicUrl?: string;
};

export default function IntelligenceScorePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScoreResponse | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/public/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#090909] text-zinc-200">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.1),transparent_50%)]" />
      <div className="relative mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-xs text-zinc-500 hover:text-cyan-300">
            WatchFlowing
          </Link>
          <Link href="/sign-up" className="text-xs text-cyan-400 hover:text-cyan-300">
            Sign up
          </Link>
        </div>

        <div className="mb-8 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10">
            <Radar className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
              Free analyzer
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              WatchFlowing Intelligence Score
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Instant website health, SEO, performance, and risk signals — then monitor continuously.
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-4 sm:flex-row sm:items-center"
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="min-h-12 flex-1 rounded-xl border border-white/[0.08] bg-black/40 px-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-400/30"
            required
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/20 px-5 text-sm font-medium text-cyan-50 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Analyze
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-500/80">
                Intelligence Score
              </p>
              <p className="mt-2 font-mono text-5xl font-semibold text-zinc-50">
                {result.overallScore}
              </p>
              <p className="mt-2 text-sm text-zinc-400">{result.hostname}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {result.dimensions.map((d) => (
                <div
                  key={d.key}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-zinc-200">{d.label}</p>
                    <p className="font-mono text-lg text-cyan-200">{d.score}</p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {d.notes.map((n) => (
                      <li key={n} className="text-[11px] text-zinc-500">
                        • {n}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {result.preview && result.cta && (
              <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-5 text-center">
                <p className="text-sm font-medium text-zinc-100">{result.cta.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{result.cta.description}</p>
                <Link
                  href={result.cta.href}
                  className="mt-4 inline-flex min-h-11 items-center rounded-full border border-cyan-400/30 bg-cyan-500/20 px-5 text-sm text-cyan-50"
                >
                  Unlock full report
                </Link>
              </div>
            )}

            {!result.preview && result.recommendations && (
              <div className="rounded-xl border border-white/[0.06] p-4">
                <p className="text-sm font-medium text-zinc-200">Recommendations</p>
                <ul className="mt-2 space-y-1">
                  {result.recommendations.map((r) => (
                    <li key={r} className="text-xs text-zinc-400">
                      • {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
