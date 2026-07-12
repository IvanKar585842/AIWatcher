import Link from "next/link";
import { Activity, Shield } from "lucide-react";

export default async function MonitoredByPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
}) {
  const { u } = await searchParams;
  const username = u?.trim().toLowerCase();

  return (
    <div className="min-h-screen bg-[#090909] text-zinc-200">
      <div className="mx-auto max-w-2xl px-4 py-14">
        <Link href="/" className="text-xs text-zinc-500 hover:text-cyan-300">
          WatchFlowing
        </Link>

        <div className="mt-8 flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/10">
            <Shield className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-500/70">
              Trust signal
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-50">
              Monitored by WatchFlowing AI
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              {username
                ? `This site is associated with @${username}'s WatchFlowing monitoring.`
                : "Websites displaying this badge use WatchFlowing to detect meaningful changes and surface AI explanations."}
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Activity className="h-4 w-4 text-cyan-400" />
            Continuous change detection
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            WatchFlowing checks pages on a schedule, filters noise, and explains important updates —
            pricing, content, SEO signals, and more — so teams do not miss silent regressions.
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/sign-up?from=badge"
            className="inline-flex min-h-11 items-center rounded-full border border-cyan-400/30 bg-cyan-500/20 px-5 text-sm font-medium text-cyan-50"
          >
            Start monitoring your website
          </Link>
          <p className="mt-3 text-[11px] text-zinc-600">
            Optional badge · no popups · value-first growth
          </p>
        </div>
      </div>
    </div>
  );
}
