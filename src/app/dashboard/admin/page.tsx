"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Crown,
  DollarSign,
  Radio,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";

interface AdminStats {
  totalUsers: number;
  adminUsers: number;
  totalMonitors: number;
  activeMonitors: number;
  errorMonitors: number;
  changesToday: number;
  pendingAnalyses: number;
  recentUsers: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    createdAt: string;
    subscription: { plan: string } | null;
    _count: { monitors: number };
  }>;
  recentErrors: Array<{
    id: string;
    name: string;
    url: string;
    errorMessage: string | null;
    errorCount: number;
    user: { email: string };
  }>;
}

interface AiStats {
  totalRequests: number;
  cachedRequests: number;
  cacheHitRate: number;
  requestsToday: number;
  totalTokens: number;
  avgTokensPerRequest: number;
  avgCompletionTokens: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
  avgCostPerUser: number;
  cacheEntries: number;
  expensiveUsers: Array<{
    email: string;
    name: string | null;
    costUsd: number;
    tokens: number;
    requests: number;
  }>;
  requestsByModel: Array<{
    model: string;
    requests: number;
    tokens: number;
    costUsd: number;
  }>;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{value}</p>
          {sub && <p className="mt-1 text-xs text-zinc-600">{sub}</p>}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-gradient-to-br ${accent}`}
        >
          <Icon className="h-5 w-5 text-cyan-300" />
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [aiStats, setAiStats] = useState<AiStats | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats"),
      fetch("/api/admin/ai-stats"),
    ])
      .then(async ([statsRes, aiRes]) => {
        if (statsRes.status === 403) {
          setDenied(true);
          return;
        }
        const statsJson = await statsRes.json();
        const aiJson = aiRes.ok ? await aiRes.json() : null;
        if (statsJson.data) setStats(statsJson.data);
        if (aiJson?.data) setAiStats(aiJson.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-white/[0.05]" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="text-center">
          <Shield className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-4 text-zinc-400">Admin access required</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Admin"
        title="Control Panel"
        description="Platform overview, users, and system health."
      />

      <div className="mb-2 flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-400" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400/80">
          Full access · Unlimited plan
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={stats.totalUsers} icon={Users} accent="from-cyan-500/10 to-blue-500/5" />
        <StatCard label="Monitors" value={stats.totalMonitors} icon={Radio} accent="from-violet-500/10 to-purple-500/5" />
        <StatCard label="Changes today" value={stats.changesToday} icon={Zap} accent="from-emerald-500/10 to-cyan-500/5" />
        <StatCard label="Errors" value={stats.errorMonitors} icon={AlertTriangle} accent="from-red-500/10 to-orange-500/5" />
      </div>

      {aiStats && (
        <>
          <h2 className="mb-4 mt-10 flex items-center gap-2 text-sm font-medium text-zinc-200">
            <Bot className="h-4 w-4 text-cyan-400" />
            AI Assistant analytics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="AI requests"
              value={aiStats.totalRequests}
              sub={`${aiStats.requestsToday} today`}
              icon={Bot}
              accent="from-cyan-500/10 to-teal-500/5"
            />
            <StatCard
              label="Cache hit rate"
              value={`${aiStats.cacheHitRate}%`}
              sub={`${aiStats.cachedRequests} cached · ${aiStats.cacheEntries} entries`}
              icon={Zap}
              accent="from-emerald-500/10 to-green-500/5"
            />
            <StatCard
              label="Total tokens"
              value={aiStats.totalTokens.toLocaleString()}
              sub={`~${aiStats.avgTokensPerRequest} avg/request`}
              icon={Radio}
              accent="from-violet-500/10 to-indigo-500/5"
            />
            <StatCard
              label="Est. AI cost"
              value={`$${aiStats.totalCostUsd.toFixed(4)}`}
              sub={`$${aiStats.avgCostPerUser.toFixed(4)} avg/user`}
              icon={DollarSign}
              accent="from-amber-500/10 to-orange-500/5"
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-medium text-zinc-200">Most expensive users</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Avg response: {aiStats.avgCompletionTokens} completion tokens
              </p>
              <div className="mt-4 space-y-2">
                {aiStats.expensiveUsers.length === 0 && (
                  <p className="py-6 text-center text-xs text-zinc-600">No usage yet</p>
                )}
                {aiStats.expensiveUsers.map((u, i) => (
                  <div
                    key={u.email}
                    className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-black/20 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-200">{u.name ?? u.email}</p>
                      <p className="truncate text-xs text-zinc-600">{u.email}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-zinc-500">
                      <p className="text-amber-300/90">${u.costUsd.toFixed(4)}</p>
                      <p>{u.requests} req · {u.tokens.toLocaleString()} tok</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-medium text-zinc-200">Requests by model</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Avg cost/request: ${aiStats.avgCostPerRequest.toFixed(6)}
              </p>
              <div className="mt-4 space-y-2">
                {aiStats.requestsByModel.map((m) => (
                  <div
                    key={m.model}
                    className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-black/20 px-4 py-3"
                  >
                    <p className="font-mono text-sm text-zinc-300">{m.model}</p>
                    <div className="text-right text-xs text-zinc-500">
                      <p>{m.requests} requests</p>
                      <p>{m.tokens.toLocaleString()} tok · ${m.costUsd.toFixed(4)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium text-zinc-200">Recent users</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {stats.adminUsers} admin{stats.adminUsers !== 1 ? "s" : ""} · {stats.activeMonitors} active monitors
          </p>
          <div className="mt-4 space-y-2">
            {stats.recentUsers.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-black/20 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-200">
                    {u.name ?? u.email}
                    {u.role === "ADMIN" && (
                      <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-amber-300">
                        Admin
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-zinc-600">{u.email}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-500">
                  <p>{u.subscription?.plan ?? "FREE"}</p>
                  <p>{u._count.monitors} monitors</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium text-zinc-200">Monitor errors</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {stats.pendingAnalyses} pending AI analyses
          </p>
          <div className="mt-4 space-y-2">
            {stats.recentErrors.length === 0 && (
              <p className="py-8 text-center text-xs text-zinc-600">No errors</p>
            )}
            {stats.recentErrors.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-red-500/10 bg-red-500/[0.03] px-4 py-3"
              >
                <p className="text-sm font-medium text-zinc-200">{m.name}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-600">{m.url}</p>
                <p className="mt-2 line-clamp-2 text-xs text-red-300/80">
                  {m.errorMessage ?? "Unknown error"}
                </p>
                <p className="mt-1 text-[10px] text-zinc-600">
                  {m.user.email} · {m.errorCount} failures
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
