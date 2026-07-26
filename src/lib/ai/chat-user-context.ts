import {
  ChangeImportance,
  NotificationChannel,
  NotificationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { monitorErrorSummary } from "@/lib/monitoring/error-messages";
import { truncateToChars } from "./chat-tokens";

/** Hard cap so we never dump the database into the prompt */
export const USER_CONTEXT_MAX_CHARS = 3800;

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

export type AccountBriefing = {
  snapshotText: string;
  insights: AssistantInsight[];
  recommendations: AssistantRecommendation[];
  suggestedQuestions: string[];
  hasMonitors: boolean;
};

/**
 * Questions that need live account data — skip shared FAQ cache.
 */
const PERSONAL_DATA_PATTERNS = [
  /\b(today|yesterday|this week|my |mine|our |me\b|i have|do i)\b/i,
  /\b(what changed|which (sites?|websites?|monitors?|changes?|alerts?)|need attention|important|priority|critical)\b/i,
  /\b(why did i|received|this (alert|notification|change)|status|error|paused|active|fail|failed)\b/i,
  /\b(ai analysis|detection|summary|summarize|history|notification|telegram|email|plan|subscription)\b/i,
  /\b(how many|count|most|highest|lowest|recent|last (change|check|alert))\b/i,
  /\b(monitors?|urls?|dashboard|account|profile|map|inactive|failing)\b/i,
  /(сегодня|вчера|изменил|мои? |наш|уведомлен|важн|вниман|почему|статус|ошибк|анализ|монитор|телеграм|почт|тариф|сколько|приоритет)/i,
];

export function isAccountSpecificQuestion(question: string): boolean {
  const q = question.trim();
  if (!q) return false;
  return PERSONAL_DATA_PATTERNS.some((p) => p.test(q));
}

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function fmtUtc(d: Date | null | undefined): string {
  if (!d) return "never";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function daysSince(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.hostname.toLowerCase()}${path.toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

const briefingCache = new Map<string, { at: number; value: AccountBriefing }>();
const CONTEXT_TTL_MS = 45_000;

export function invalidateUserMonitoringContext(userId: string): void {
  briefingCache.delete(userId);
}

export async function getAccountBriefing(userId: string): Promise<AccountBriefing> {
  const hit = briefingCache.get(userId);
  if (hit && Date.now() - hit.at < CONTEXT_TTL_MS) {
    return hit.value;
  }

  const value = await buildAccountBriefingUncached(userId);
  briefingCache.set(userId, { at: Date.now(), value });
  if (briefingCache.size > 500) {
    const oldest = briefingCache.keys().next().value;
    if (oldest) briefingCache.delete(oldest);
  }
  return value;
}

export async function buildUserMonitoringContext(userId: string): Promise<string> {
  const briefing = await getAccountBriefing(userId);
  return briefing.snapshotText;
}

async function buildAccountBriefingUncached(userId: string): Promise<AccountBriefing> {
  const today = startOfUtcDay();
  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);

  const [
    user,
    monitors,
    statusGroups,
    changesTodayCount,
    changesToday,
    recentChanges,
    importantChanges,
    criticalToday,
    recentNotifications,
    failedNotifications,
    pendingAnalyses,
    notificationRows,
    changesThisWeekByMonitor,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        telegramConnected: true,
        telegramUsername: true,
        telegramChatId: true,
        telegramNotificationsEnabled: true,
        emailNotificationsEnabled: true,
        subscription: { select: { plan: true, status: true } },
      },
    }),
    prisma.monitor.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        status: true,
        url: true,
        mode: true,
        interval: true,
        notificationMethod: true,
        lastCheckedAt: true,
        lastChangedAt: true,
        errorMessage: true,
        errorCount: true,
        _count: { select: { changes: true } },
      },
    }),
    prisma.monitor.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.change.count({
      where: { createdAt: { gte: today }, monitor: { userId } },
    }),
    prisma.change.findMany({
      where: { createdAt: { gte: today }, monitor: { userId } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        summary: true,
        importance: true,
        emoji: true,
        analysisStatus: true,
        bulletPoints: true,
        createdAt: true,
        monitor: { select: { name: true, url: true } },
      },
    }),
    prisma.change.findMany({
      where: { monitor: { userId } },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        summary: true,
        importance: true,
        emoji: true,
        category: true,
        analysisStatus: true,
        bulletPoints: true,
        createdAt: true,
        monitor: { select: { name: true, url: true } },
      },
    }),
    prisma.change.findMany({
      where: {
        createdAt: { gte: since7d },
        importance: { in: [ChangeImportance.HIGH, ChangeImportance.CRITICAL] },
        monitor: { userId },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        summary: true,
        importance: true,
        emoji: true,
        createdAt: true,
        monitor: { select: { name: true } },
      },
    }),
    prisma.change.count({
      where: {
        createdAt: { gte: today },
        importance: ChangeImportance.CRITICAL,
        monitor: { userId },
      },
    }),
    prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: since7d },
        channel: {
          in: [
            NotificationChannel.IN_APP,
            NotificationChannel.EMAIL,
            NotificationChannel.TELEGRAM,
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        channel: true,
        status: true,
        createdAt: true,
        change: {
          select: {
            summary: true,
            importance: true,
            monitor: { select: { name: true } },
          },
        },
      },
    }),
    prisma.notification.findMany({
      where: {
        userId,
        status: NotificationStatus.FAILED,
        createdAt: { gte: since7d },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        channel: true,
        error: true,
        createdAt: true,
        change: { select: { monitor: { select: { name: true } } } },
      },
    }),
    prisma.change.count({
      where: { analysisStatus: "PENDING", monitor: { userId } },
    }),
    prisma.notification.findMany({
      where: { userId, createdAt: { gte: since7d } },
      select: {
        channel: true,
        status: true,
        change: { select: { monitor: { select: { id: true, name: true } } } },
      },
      take: 400,
    }),
    prisma.change.groupBy({
      by: ["monitorId"],
      where: { createdAt: { gte: since7d }, monitor: { userId } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  if (!user) {
    return {
      snapshotText: truncateToChars(
        [
          "USER_MONITORING_SNAPSHOT:",
          "Account not found for this session. Do not invent monitors or changes.",
        ].join("\n"),
        USER_CONTEXT_MAX_CHARS
      ),
      insights: [
        {
          id: "no-account",
          text: "Could not load your account data. Please refresh and try again.",
          tone: "warn",
        },
      ],
      recommendations: [],
      suggestedQuestions: [],
      hasMonitors: false,
    };
  }

  const statusCounts: Record<string, number> = {};
  for (const g of statusGroups) {
    statusCounts[g.status] = g._count._all;
  }
  const totalMonitors = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const active = statusCounts.ACTIVE ?? 0;
  const paused = statusCounts.PAUSED ?? 0;
  const errored = statusCounts.ERROR ?? 0;

  const monitorById = new Map(monitors.map((m) => [m.id, m]));

  const notifByMonitor = new Map<string, { name: string; count: number }>();
  for (const row of notificationRows) {
    const mon = row.change?.monitor;
    if (!mon) continue;
    const prev = notifByMonitor.get(mon.id);
    if (prev) prev.count += 1;
    else notifByMonitor.set(mon.id, { name: mon.name, count: 1 });
  }
  const topNotifMonitors = [...notifByMonitor.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const weekChangeLeaders = changesThisWeekByMonitor
    .map((row) => {
      const m = monitorById.get(row.monitorId);
      return m ? { name: m.name, count: row._count.id } : null;
    })
    .filter((x): x is { name: string; count: number } => Boolean(x));

  const topByChanges = [...monitors]
    .sort((a, b) => b._count.changes - a._count.changes)
    .slice(0, 5);
  const topByErrors = [...monitors]
    .filter((m) => m.errorCount > 0)
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 5);

  const plan = user.subscription?.plan ?? "FREE";
  const planStatus = user.subscription?.status ?? "active";
  const telegramLinked = Boolean(user.telegramConnected || user.telegramChatId);

  const importantToday = changesToday.filter(
    (c) =>
      c.importance === ChangeImportance.HIGH || c.importance === ChangeImportance.CRITICAL
  ).length;

  const { insights, recommendations, suggestedQuestions } = deriveInsightsAndRecommendations({
    totalMonitors,
    active,
    paused,
    errored,
    changesTodayCount,
    importantToday,
    criticalToday,
    pendingAnalyses,
    telegramLinked,
    telegramNotificationsEnabled: user.telegramNotificationsEnabled,
    emailNotificationsEnabled: user.emailNotificationsEnabled,
    monitors,
    topNotifMonitors,
    weekChangeLeaders,
    topByErrors,
    failedNotifications,
    importantChanges,
  });

  const lines: string[] = [
    "USER_MONITORING_SNAPSHOT (private — only this authenticated user; answer ONLY from this data for account questions; never invent):",
    "",
    "Profile:",
    `- Name: ${user.name?.trim() || "not set"}`,
    `- Email: ${user.email}`,
    `- Plan: ${plan} (${planStatus})`,
    `- Email notifications: ${user.emailNotificationsEnabled ? "enabled" : "disabled"}`,
    `- Telegram: ${
      telegramLinked
        ? `linked${user.telegramUsername ? ` (@${user.telegramUsername})` : ""}; notifications ${
            user.telegramNotificationsEnabled ? "enabled" : "disabled"
          }`
        : "not linked"
    }`,
    "",
    "Dashboard stats:",
    `- Monitors: ${totalMonitors} total · ${active} active · ${paused} paused · ${errored} error`,
    `- Changes today (UTC): ${changesTodayCount} (${importantToday} HIGH/CRITICAL, ${criticalToday} CRITICAL)`,
    `- Pending AI analyses: ${pendingAnalyses}`,
    `- Notifications (7d sampled): ${notificationRows.length}`,
    `- Failed deliveries (7d): ${failedNotifications.length}`,
  ];

  if (weekChangeLeaders.length > 0) {
    lines.push(
      `- Most changes this week: ${weekChangeLeaders
        .slice(0, 5)
        .map((m) => `${m.name} (${m.count})`)
        .join("; ")}`
    );
  }
  if (topByChanges.length > 0) {
    lines.push(
      `- Most changes (all time): ${topByChanges
        .map((m) => `${m.name} (${m._count.changes})`)
        .join("; ")}`
    );
  }
  if (topByErrors.length > 0) {
    lines.push(
      `- Most failed checks: ${topByErrors
        .map((m) => `${m.name} (${m.errorCount})`)
        .join("; ")}`
    );
  }
  if (topNotifMonitors.length > 0) {
    lines.push(
      `- Most notifications (7d): ${topNotifMonitors
        .map((m) => `${m.name} (${m.count})`)
        .join("; ")}`
    );
  }

  lines.push("");

  if (totalMonitors === 0) {
    lines.push(
      "Monitors: none. User has no monitors yet — say so clearly; do not invent any. Suggest Monitors → Create Monitor."
    );
  } else {
    const listed = monitors.length;
    lines.push(
      `Monitors (${listed}${totalMonitors > listed ? ` of ${totalMonitors}` : ""}):`
    );
    for (const m of monitors) {
      const quietDays = daysSince(m.lastChangedAt);
      const err = m.errorMessage
        ? ` err=${truncateToChars(monitorErrorSummary(m.errorMessage) ?? m.errorMessage, 50)}`
        : "";
      lines.push(
        `- ${m.name} | ${m.url} | status=${m.status} mode=${m.mode} interval=${m.interval} notify=${m.notificationMethod} changes=${m._count.changes} errors=${m.errorCount} lastCheck=${fmtUtc(m.lastCheckedAt)} lastChange=${fmtUtc(m.lastChangedAt)}${quietDays != null ? ` quietDays=${quietDays}` : ""}${err}`
      );
    }

    lines.push("", "Global Monitor Map (nodes around AI Core):");
    for (const m of monitors.slice(0, 30)) {
      lines.push(`- ${m.name} (${hostnameOf(m.url)}) · ${m.status}`);
    }
  }

  lines.push("", `Changes today UTC (${changesToday.length} shown of ${changesTodayCount}):`);
  if (changesToday.length === 0) {
    lines.push("- None today.");
  } else {
    for (const c of changesToday) {
      const bullets =
        c.bulletPoints?.length > 0
          ? ` | ${c.bulletPoints
              .slice(0, 2)
              .map((b) => truncateToChars(b, 60))
              .join("; ")}`
          : "";
      lines.push(
        `- [${c.importance}] ${c.emoji} ${c.monitor.name}: ${truncateToChars(c.summary || "No summary", 140)} (${c.analysisStatus}, ${fmtUtc(c.createdAt)})${bullets}`
      );
    }
  }

  if (importantChanges.length > 0) {
    lines.push("", "Highest priority alerts (7d HIGH/CRITICAL):");
    for (const c of importantChanges) {
      lines.push(
        `- [${c.importance}] ${c.emoji} ${c.monitor.name}: ${truncateToChars(c.summary || "No summary", 120)} (${fmtUtc(c.createdAt)})`
      );
    }
  } else {
    lines.push("", "Highest priority alerts (7d HIGH/CRITICAL): none.");
  }

  lines.push("", "Recent change / detection history:");
  if (recentChanges.length === 0) {
    lines.push("- No change history yet.");
  } else {
    for (const c of recentChanges) {
      const bullets =
        c.bulletPoints?.length > 0
          ? ` | ${truncateToChars(c.bulletPoints[0] ?? "", 70)}`
          : "";
      lines.push(
        `- [${c.importance}/${c.category}] ${c.emoji} ${c.monitor.name}: ${truncateToChars(c.summary || "No summary", 120)} (${c.analysisStatus}, ${fmtUtc(c.createdAt)})${bullets}`
      );
    }
  }

  if (recentNotifications.length > 0) {
    lines.push("", "Recent notifications (7d):");
    for (const n of recentNotifications) {
      const mon = n.change?.monitor.name ?? "unknown";
      const sum = truncateToChars(n.change?.summary || "", 80);
      lines.push(
        `- ${n.channel}/${n.status} ${mon}: ${sum} [${n.change?.importance ?? "?"}] (${fmtUtc(n.createdAt)})`
      );
    }
  } else {
    lines.push("", "Recent notifications (7d): none.");
  }

  if (failedNotifications.length > 0) {
    lines.push("", "Failed notification deliveries (7d):");
    for (const n of failedNotifications) {
      const mon = n.change?.monitor.name ?? "unknown";
      lines.push(
        `- ${n.channel} ${mon}: ${truncateToChars(n.error || "failed", 80)} (${fmtUtc(n.createdAt)})`
      );
    }
  }

  const needsAttention = monitors.filter((m) => m.status === "ERROR" || m.status === "PAUSED");
  if (needsAttention.length > 0) {
    lines.push("", "Needs attention:");
    for (const m of needsAttention) {
      lines.push(
        `- ${m.name}: ${m.status}${
          m.errorMessage
            ? ` — ${truncateToChars(monitorErrorSummary(m.errorMessage) ?? "", 80)}`
            : ""
        }`
      );
    }
  }

  if (insights.length > 0) {
    lines.push("", "Proactive insights (grounded):");
    for (const i of insights) {
      lines.push(`- [${i.tone}] ${i.text}`);
    }
  }

  if (recommendations.length > 0) {
    lines.push("", "Smart recommendations (grounded):");
    for (const r of recommendations) {
      lines.push(`- ${r.text}`);
    }
  }

  return {
    snapshotText: truncateToChars(lines.join("\n"), USER_CONTEXT_MAX_CHARS),
    insights,
    recommendations,
    suggestedQuestions,
    hasMonitors: totalMonitors > 0,
  };
}

function deriveInsightsAndRecommendations(input: {
  totalMonitors: number;
  active: number;
  paused: number;
  errored: number;
  changesTodayCount: number;
  importantToday: number;
  criticalToday: number;
  pendingAnalyses: number;
  telegramLinked: boolean;
  telegramNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  monitors: Array<{
    id: string;
    name: string;
    url: string;
    status: string;
    errorCount: number;
    lastChangedAt: Date | null;
    lastCheckedAt: Date | null;
    _count: { changes: number };
  }>;
  topNotifMonitors: Array<{ name: string; count: number }>;
  weekChangeLeaders: Array<{ name: string; count: number }>;
  topByErrors: Array<{ name: string; errorCount: number }>;
  failedNotifications: Array<{
    channel: NotificationChannel;
    change: { monitor: { name: string } | null } | null;
  }>;
  importantChanges: Array<{ importance: ChangeImportance; monitor: { name: string } }>;
}): {
  insights: AssistantInsight[];
  recommendations: AssistantRecommendation[];
  suggestedQuestions: string[];
} {
  const insights: AssistantInsight[] = [];
  const recommendations: AssistantRecommendation[] = [];
  const suggestedQuestions: string[] = [];

  if (input.totalMonitors === 0) {
    insights.push({
      id: "empty",
      text: "You have no monitors yet. Create your first one to start detecting website changes.",
      tone: "info",
    });
    recommendations.push({
      id: "create-first",
      text: "Create a monitor for a page you care about (homepage, pricing, docs, or a competitor).",
    });
    suggestedQuestions.push(
      "How do I create a monitor?",
      "Which monitoring mode should I use?",
      "How do notifications work?"
    );
    return { insights, recommendations, suggestedQuestions };
  }

  if (input.importantToday > 0) {
    insights.push({
      id: "important-today",
      text: `${input.importantToday} important change${input.importantToday === 1 ? " was" : "s were"} detected today.`,
      tone: input.criticalToday > 0 ? "critical" : "warn",
    });
  } else if (input.changesTodayCount > 0) {
    insights.push({
      id: "changes-today",
      text: `${input.changesTodayCount} change${input.changesTodayCount === 1 ? "" : "s"} detected today.`,
      tone: "info",
    });
  } else {
    insights.push({
      id: "quiet-today",
      text: "No changes detected today across your monitors.",
      tone: "ok",
    });
  }

  if (input.criticalToday > 0) {
    insights.push({
      id: "critical-today",
      text: `${input.criticalToday} critical change${input.criticalToday === 1 ? "" : "s"} happened today.`,
      tone: "critical",
    });
  }

  const criticalUnreviewed = input.importantChanges.filter(
    (c) => c.importance === ChangeImportance.CRITICAL
  ).length;
  if (criticalUnreviewed > 0) {
    insights.push({
      id: "critical-week",
      text: `You have ${criticalUnreviewed} critical alert${criticalUnreviewed === 1 ? "" : "s"} from the last 7 days worth reviewing.`,
      tone: "critical",
    });
    recommendations.push({
      id: "review-critical",
      text: "Review critical alerts in History first — start with the most recent CRITICAL items.",
    });
  }

  if (input.topNotifMonitors[0] && input.topNotifMonitors[0].count >= 2) {
    const top = input.topNotifMonitors[0];
    insights.push({
      id: "top-notif",
      text: `Your ${top.name} monitor generated ${top.count} notifications in the last 7 days.`,
      tone: "info",
    });
  }

  if (input.weekChangeLeaders[0] && input.weekChangeLeaders[0].count >= 2) {
    const top = input.weekChangeLeaders[0];
    insights.push({
      id: "week-leader",
      text: `${top.name} changed the most this week (${top.count} detections).`,
      tone: "info",
    });
    recommendations.push({
      id: "priority-active",
      text: `Consider watching ${top.name} more closely — it is your most active page this week.`,
    });
  }

  for (const m of input.monitors) {
    const quiet = daysSince(m.lastChangedAt);
    if (quiet != null && quiet >= 14 && m.status === "ACTIVE" && insights.length < 8) {
      insights.push({
        id: `quiet-${m.id}`,
        text: `${m.name} hasn't changed in ${quiet} days.`,
        tone: "ok",
      });
      break;
    }
  }

  if (input.errored > 0) {
    const worst = input.topByErrors[0];
    insights.push({
      id: "failing",
      text: worst
        ? `${worst.name} is failing repeatedly (${worst.errorCount} errors). ${input.errored} monitor${input.errored === 1 ? "" : "s"} currently in ERROR.`
        : `${input.errored} monitor${input.errored === 1 ? " is" : "s are"} currently failing.`,
      tone: "warn",
    });
    recommendations.push({
      id: "fix-errors",
      text: "Open failing monitors and check the error message — often robots.txt, auth, or a selector issue.",
    });
  }

  if (input.paused > 0) {
    insights.push({
      id: "paused",
      text: `You have ${input.paused} inactive (paused) monitor${input.paused === 1 ? "" : "s"}.`,
      tone: "info",
    });
    recommendations.push({
      id: "review-paused",
      text: "Review paused monitors — resume ones you still need, or delete ones you no longer use.",
    });
  }

  if (input.telegramLinked && input.telegramNotificationsEnabled) {
    insights.push({
      id: "telegram-ok",
      text: "Your Telegram notifications are linked and enabled.",
      tone: "ok",
    });
  } else if (!input.telegramLinked) {
    recommendations.push({
      id: "link-telegram",
      text: "Link Telegram in Settings to get instant alerts on Pro+ plans.",
    });
  }

  if (!input.emailNotificationsEnabled) {
    insights.push({
      id: "email-off",
      text: "Email notifications are disabled on your account.",
      tone: "warn",
    });
  }

  const failedEmail = input.failedNotifications.find(
    (n) => n.channel === NotificationChannel.EMAIL
  );
  if (failedEmail) {
    const mon = failedEmail.change?.monitor?.name;
    insights.push({
      id: "email-failed",
      text: mon
        ? `Email notifications failed for ${mon}.`
        : "Email notification delivery failed for at least one alert.",
      tone: "warn",
    });
  }

  const failedTg = input.failedNotifications.find(
    (n) => n.channel === NotificationChannel.TELEGRAM
  );
  if (failedTg) {
    insights.push({
      id: "tg-failed",
      text: "A Telegram notification failed to deliver recently — check that the bot is still linked.",
      tone: "warn",
    });
  }

  if (input.pendingAnalyses > 0) {
    insights.push({
      id: "pending-ai",
      text: `${input.pendingAnalyses} change${input.pendingAnalyses === 1 ? "" : "s"} still waiting for AI analysis.`,
      tone: "info",
    });
  }

  // Duplicate monitors (same normalized URL)
  const byUrl = new Map<string, string[]>();
  for (const m of input.monitors) {
    const key = normalizeUrlKey(m.url);
    const list = byUrl.get(key) ?? [];
    list.push(m.name);
    byUrl.set(key, list);
  }
  for (const [, names] of byUrl) {
    if (names.length > 1) {
      recommendations.push({
        id: `dup-${names[0]}`,
        text: `Possible duplicate monitors: ${names.join(", ")} point at the same URL — consider keeping one.`,
      });
      break;
    }
  }

  // Suggest related pages for hosts that only monitor the root
  const byHost = new Map<string, typeof input.monitors>();
  for (const m of input.monitors) {
    const host = hostnameOf(m.url);
    const list = byHost.get(host) ?? [];
    list.push(m);
    byHost.set(host, list);
  }
  for (const [host, list] of byHost) {
    if (list.length !== 1) continue;
    const only = list[0]!;
    try {
      const path = new URL(only.url).pathname.replace(/\/+$/, "") || "/";
      if (path === "/") {
        recommendations.push({
          id: `expand-${host}`,
          text: `You only monitor the homepage of ${host} — consider adding /pricing, /changelog, or /blog if those pages matter.`,
        });
        break;
      }
    } catch {
      /* ignore */
    }
  }

  // Stale never-changed active monitors
  const neverChanged = input.monitors.filter(
    (m) => m.status === "ACTIVE" && !m.lastChangedAt && daysSince(m.lastCheckedAt) != null && (daysSince(m.lastCheckedAt) ?? 0) >= 7
  );
  if (neverChanged.length > 0) {
    recommendations.push({
      id: "never-changed",
      text: `${neverChanged[0]!.name}${neverChanged.length > 1 ? ` (+${neverChanged.length - 1} more)` : ""} has been checked for a week+ with no detections — verify the mode/selector still matches the page.`,
    });
  }

  suggestedQuestions.push(
    "Which monitor changed today?",
    "Show my most important alerts.",
    "Which monitors are currently failing?",
    "Summarize today's activity.",
    "Which monitor should I check first?"
  );

  return {
    insights: insights.slice(0, 8),
    recommendations: recommendations.slice(0, 6),
    suggestedQuestions: suggestedQuestions.slice(0, 5),
  };
}
