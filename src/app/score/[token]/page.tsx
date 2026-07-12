"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export default function SharedScorePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [data, setData] = useState<{
    hostname: string;
    overallScore: number;
    url: string;
    branding: string;
    payload: {
      dimensions?: Array<{ label: string; score: number; notes: string[] }>;
      recommendations?: string[];
    };
  } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/public/score/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("missing");
        return r.json();
      })
      .then((json) => {
        setData({
          hostname: json.score.hostname,
          overallScore: json.score.overallScore,
          url: json.score.url,
          branding: json.score.branding,
          payload: json.score.payload ?? {},
        });
      })
      .catch(() => setError(true));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909] text-zinc-500">
        Score not found.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909]">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090909] px-4 py-12 text-zinc-200">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.08] bg-[#0c0c0c] p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
          Intelligence Score
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-50">{data.hostname}</h1>
        <p className="mt-4 font-mono text-5xl text-cyan-200">{data.overallScore}</p>
        <div className="mt-6 space-y-3">
          {(data.payload.dimensions ?? []).map((d) => (
            <div key={d.label} className="rounded-xl border border-white/[0.06] p-3">
              <div className="flex justify-between text-sm">
                <span>{d.label}</span>
                <span className="font-mono text-cyan-200">{d.score}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/score"
            className="inline-flex min-h-11 items-center rounded-full border border-cyan-400/30 bg-cyan-500/15 px-5 text-sm text-cyan-100"
          >
            Analyze your website
          </Link>
          <p className="mt-3 text-[11px] text-zinc-600">{data.branding}</p>
        </div>
      </div>
    </div>
  );
}
