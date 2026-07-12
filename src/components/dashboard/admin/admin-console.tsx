"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Crown,
  DollarSign,
  Radio,
  Search,
  Server,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import { CommandPageHeader } from "@/components/dashboard/command/command-page-header";
import { OsInput } from "@/components/dashboard/os/os-primitives";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";

type Tab = "dashboard" | "users" | "system";

interface AdminStats {
  totalUsers: number;
  adminUsers: number;
  totalMonitors: number;
  activeMonitors: number;
  activeSubscriptions: number;
  errorMonitors: number;
  totalChecks: number;
  checksToday: number;
  aiRequests: number;
  aiRequestsToday: number;
  emailNotifications: number;
  emailsToday: number;
  telegramNotifications: number;
  errors: number;
  failedChecks: number;
  apiErrors: number;
  failedNotifications: number;
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

interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  subscription: { plan: string; status: string } | null;
  _count: { monitors: number; notifications: number };
}

interface UserDetail {
  user: AdminUserRow & {
    onboardingCompleted?: boolean;
    telegramChatId?: string | null;
    monitors: Array<{
      id: string;
      name: string;
      url: string;
      status: string;
      mode: string;
      lastCheckedAt: string | null;
      lastChangedAt: string | null;
      errorCount: number;
      errorMessage: string | null;
      _count: { changes: number };
    }>;
  };
  usage: {
    monitors: number;
    aiRequests: number;
    monitoringChecks: number;
    notificationsSent: number;
    emailSent: number;
    telegramSent: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    durationMs: number | null;
    createdAt: string;
  }>;
}

interface SystemData {
  failedMonitors: Array<{
    id: string;
    name: string;
    url: string;
    errorMessage: string | null;
    errorCount: number;
    updatedAt: string;
    user: { id: string; email: string };
  }>;
  failedNotifications: Array<{
    id: string;
    channel: string;
    error: string | null;
    createdAt: string;
    user: { email: string };
    change: { id: string; summary: string; monitor: { name: string } } | null;
  }>;
  failedChecks: Array<{
    id: string;
    userId: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
  apiErrors: Array<{
    id: string;
    userId: string | null;
    metadata: unknown;
    createdAt: string;
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

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [aiStats, setAiStats] = useState<AiStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [system, setSystem] = useState<SystemData | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    const [statsRes, aiRes] = await Promise.all([
      fetch("/api/admin/stats"),
      fetch("/api/admin/ai-stats"),
    ]);
    if (statsRes.status === 403) {
      setDenied(true);
      return;
    }
    const statsJson = await statsRes.json();
    const aiJson = aiRes.ok ? await aiRes.json() : null;
    if (statsJson.data) setStats(statsJson.data);
    if (aiJson?.data) setAiStats(aiJson.data);
  }, []);

  const loadUsers = useCallback(async (q: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/users?${params}`);
    if (!res.ok) return;
    const json = await res.json();
    if (json.data?.users) setUsers(json.data.users);
  }, []);

  const loadUserDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const json = await res.json();
    if (json.data) setUserDetail(json.data as UserDetail);
  }, []);

  const loadSystem = useCallback(async () => {
    const res = await fetch("/api/admin/system");
    if (!res.ok) return;
    const json = await res.json();
    if (json.data) setSystem(json.data);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadDashboard().finally(() => setLoading(false));
  }, [loadDashboard]);

  useEffect(() => {
    if (tab !== "users") return;
    const t = setTimeout(() => loadUsers(userQuery), 250);
    return () => clearTimeout(t);
  }, [tab, userQuery, loadUsers]);

  useEffect(() => {
    if (tab !== "users" || !selectedUserId) {
      setUserDetail(null);
      return;
    }
    loadUserDetail(selectedUserId);
  }, [tab, selectedUserId, loadUserDetail]);

  useEffect(() => {
    if (tab === "system") loadSystem();
  }, [tab, loadSystem]);

  if (loading && !stats) {
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "users", label: "Users" },
    { id: "system", label: "System" },
  ];

  return (
    <div className="p-4 lg:p-6">
      <CommandPageHeader
        label="Admin"
        title="Control Panel"
        description="Platform usage, users, and system health."
      />

      <div className="mb-4 flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-400" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400/80">
          Full access · Unlimited plan
        </span>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm transition-colors",
              tab === t.id
                ? "bg-cyan-500/15 text-cyan-100"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Total users"
              value={stats.totalUsers}
              sub={`${stats.adminUsers} admins`}
              icon={Users}
              accent="from-cyan-500/10 to-blue-500/5"
            />
            <StatCard
              label="Active monitors"
              value={stats.activeMonitors}
              sub={`${stats.totalMonitors} total`}
              icon={Radio}
              accent="from-violet-500/10 to-purple-500/5"
            />
            <StatCard
              label="Active subscriptions"
              value={stats.activeSubscriptions ?? 0}
              sub="Paid plans · active"
              icon={Crown}
              accent="from-emerald-500/10 to-cyan-500/5"
            />
            <StatCard
              label="AI requests"
              value={stats.aiRequests}
              sub={`${stats.aiRequestsToday} today`}
              icon={Bot}
              accent="from-cyan-500/10 to-teal-500/5"
            />
            <StatCard
              label="Checks"
              value={stats.totalChecks}
              sub={`${stats.checksToday} today`}
              icon={Zap}
              accent="from-amber-500/10 to-orange-500/5"
            />
            <StatCard
              label="Errors"
              value={stats.errors}
              sub={`${stats.errorMonitors} monitors · ${stats.apiErrors} API`}
              icon={AlertTriangle}
              accent="from-red-500/10 to-orange-500/5"
            />
          </div>

          {aiStats && (
            <>
              <h2 className="mb-4 mt-10 flex items-center gap-2 text-sm font-medium text-zinc-200">
                <Bot className="h-4 w-4 text-cyan-400" />
                AI Assistant analytics
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Chat requests"
                  value={aiStats.totalRequests}
                  sub={`${aiStats.requestsToday} today`}
                  icon={Bot}
                  accent="from-cyan-500/10 to-teal-500/5"
                />
                <StatCard
                  label="Cache hit rate"
                  value={`${aiStats.cacheHitRate}%`}
                  sub={`${aiStats.cachedRequests} cached`}
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
            </>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h2 className="text-sm font-medium text-zinc-200">Recent users</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {stats.changesToday} changes today · {stats.pendingAnalyses} pending analyses
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
        </>
      )}

      {tab === "users" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <OsInput
                placeholder="Search users by email or name..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-y-auto">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                    selectedUserId === u.id
                      ? "border-cyan-500/30 bg-cyan-500/[0.08]"
                      : "border-white/[0.04] bg-black/20 hover:border-white/[0.08]"
                  )}
                >
                  <p className="truncate text-sm text-zinc-200">{u.name ?? u.email}</p>
                  <p className="truncate text-xs text-zinc-600">{u.email}</p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">
                    {u.subscription?.plan ?? "FREE"} · {u._count.monitors} monitors
                  </p>
                </button>
              ))}
              {users.length === 0 && (
                <p className="py-8 text-center text-xs text-zinc-600">No users found</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            {!selectedUserId && (
              <p className="py-16 text-center text-sm text-zinc-500">
                Select a user to view activity and monitors
              </p>
            )}
            {selectedUserId && !userDetail && (
              <div className="space-y-3 py-8">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-white/[0.03]" />
                ))}
              </div>
            )}
            {userDetail && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-medium text-zinc-100">
                    {userDetail.user.name ?? userDetail.user.email}
                  </h2>
                  <p className="text-sm text-zinc-500">{userDetail.user.email}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    {userDetail.user.role} · {userDetail.user.subscription?.plan ?? "FREE"} · joined{" "}
                    {formatDate(userDetail.user.createdAt)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Monitors", userDetail.usage.monitors],
                    ["AI requests", userDetail.usage.aiRequests],
                    ["Checks", userDetail.usage.monitoringChecks],
                    ["Notifications", userDetail.usage.notificationsSent],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border border-white/[0.04] bg-black/20 px-3 py-3"
                    >
                      <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
                        {label}
                      </p>
                      <p className="mt-1 text-xl font-semibold text-zinc-100">{value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-200">Monitors</h3>
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                    {userDetail.user.monitors.length === 0 && (
                      <p className="text-xs text-zinc-600">No monitors</p>
                    )}
                    {userDetail.user.monitors.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-xl border border-white/[0.04] bg-black/20 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm text-zinc-200">{m.name}</p>
                          <span
                            className={cn(
                              "font-mono text-[9px] uppercase",
                              m.status === "ERROR" ? "text-red-400" : "text-zinc-500"
                            )}
                          >
                            {m.status}
                          </span>
                        </div>
                        <p className="truncate text-xs text-zinc-600">{m.url}</p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                          {m._count.changes} changes
                          {m.lastCheckedAt
                            ? ` · checked ${formatRelativeTime(m.lastCheckedAt)}`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-zinc-200">Recent activity</h3>
                  <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
                    {userDetail.recentActivity.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between gap-3 border-b border-white/[0.03] py-2 text-xs"
                      >
                        <span className="font-mono text-zinc-400">{e.type}</span>
                        <span className="text-zinc-600">{formatRelativeTime(e.createdAt)}</span>
                      </div>
                    ))}
                    {userDetail.recentActivity.length === 0 && (
                      <p className="text-xs text-zinc-600">No tracked activity yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "system" && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Server className="h-4 w-4 text-cyan-400" />
            Failed checks, notification failures, and API errors (last 30 days)
          </div>

          {!system && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/[0.03]" />
              ))}
            </div>
          )}

          {system && (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="text-sm font-medium text-zinc-200">Failed monitors</h2>
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                  {system.failedMonitors.length === 0 && (
                    <p className="py-6 text-center text-xs text-zinc-600">None</p>
                  )}
                  {system.failedMonitors.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-red-500/10 bg-red-500/[0.03] px-4 py-3"
                    >
                      <p className="text-sm text-zinc-200">{m.name}</p>
                      <p className="truncate text-xs text-zinc-600">{m.url}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-red-300/80">
                        {m.errorMessage ?? "Unknown"}
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {m.user.email} · {m.errorCount} failures
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="text-sm font-medium text-zinc-200">Failed notifications</h2>
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                  {system.failedNotifications.length === 0 && (
                    <p className="py-6 text-center text-xs text-zinc-600">None</p>
                  )}
                  {system.failedNotifications.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border border-white/[0.04] bg-black/20 px-4 py-3"
                    >
                      <p className="text-sm text-zinc-200">
                        {n.channel} · {n.change?.monitor.name ?? "Unknown monitor"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-red-300/80">
                        {n.error ?? "Delivery failed"}
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-600">
                        {n.user.email} · {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="text-sm font-medium text-zinc-200">Failed checks</h2>
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                  {system.failedChecks.length === 0 && (
                    <p className="py-6 text-center text-xs text-zinc-600">None</p>
                  )}
                  {system.failedChecks.map((e) => {
                    const meta =
                      e.metadata && typeof e.metadata === "object"
                        ? (e.metadata as Record<string, unknown>)
                        : {};
                    return (
                      <div
                        key={e.id}
                        className="rounded-xl border border-white/[0.04] bg-black/20 px-4 py-3"
                      >
                        <p className="font-mono text-xs text-zinc-300">
                          {String(meta.monitorId ?? "monitor")} ·{" "}
                          {String(meta.message ?? "check failed")}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                          {formatRelativeTime(e.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="text-sm font-medium text-zinc-200">API errors</h2>
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                  {system.apiErrors.length === 0 && (
                    <p className="py-6 text-center text-xs text-zinc-600">None</p>
                  )}
                  {system.apiErrors.map((e) => {
                    const meta =
                      e.metadata && typeof e.metadata === "object"
                        ? (e.metadata as Record<string, unknown>)
                        : {};
                    return (
                      <div
                        key={e.id}
                        className="rounded-xl border border-white/[0.04] bg-black/20 px-4 py-3"
                      >
                        <p className="font-mono text-xs text-zinc-300">
                          {String(meta.name ?? "Error")}
                        </p>
                        <p className="mt-1 text-[10px] text-zinc-600">
                          {formatRelativeTime(e.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
