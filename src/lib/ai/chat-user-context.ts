import { ChangeImportance, NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { truncateToChars } from "./chat-tokens";

/** Hard cap so we never dump the database into the prompt */
export const USER_CONTEXT_MAX_CHARS = 1600;

const PERSONAL_DATA_PATTERNS = [
  /\b(today|yesterday|this week|my |mine|our )\b/i,
  /\b(what changed|which (sites?|websites?|monitors?|changes?)|need attention|important)\b/i,
  /\b(why did i|received|this (alert|notification|change)|status|error|paused)\b/i,
  /\b(ai analysis|detection|summary)\b/i,
  /(сегодня|вчера|изменил|мои? |наш|уведомлен|важн|вниман|почему|статус|ошибк|анализ)/i,
];

/**
 * Questions that need live account data — skip shared FAQ cache.
 */
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

/**
 * Compact, privacy-scoped snapshot of the user's monitoring world.
 * Only summaries — never full HTML snapshots.
 * Cached briefly in-process to avoid 5 DB queries on every chat turn.
 */
const contextCache = new Map<string, { at: number; value: string }>();
const CONTEXT_TTL_MS = 45_000;

export async function buildUserMonitoringContext(userId: string): Promise<string> {
  const hit = contextCache.get(userId);
  if (hit && Date.now() - hit.at < CONTEXT_TTL_MS) {
    return hit.value;
  }

  const value = await buildUserMonitoringContextUncached(userId);
  contextCache.set(userId, { at: Date.now(), value });
  if (contextCache.size > 500) {
    const oldest = contextCache.keys().next().value;
    if (oldest) contextCache.delete(oldest);
  }
  return value;
}

async function buildUserMonitoringContextUncached(userId: string): Promise<string> {
  const today = startOfUtcDay();
  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);

  const [monitors, changesToday, importantChanges, recentNotifications, pendingAnalyses] =
    await Promise.all([
      prisma.monitor.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          name: true,
          status: true,
          url: true,
          lastCheckedAt: true,
          lastChangedAt: true,
          errorMessage: true,
          _count: { select: { changes: true } },
        },
      }),
      prisma.change.findMany({
        where: {
          createdAt: { gte: today },
          monitor: { userId },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          summary: true,
          importance: true,
          emoji: true,
          analysisStatus: true,
          createdAt: true,
          monitor: { select: { name: true } },
        },
      }),
      prisma.change.findMany({
        where: {
          createdAt: { gte: since7d },
          importance: { in: [ChangeImportance.HIGH, ChangeImportance.CRITICAL] },
          monitor: { userId },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          summary: true,
          importance: true,
          emoji: true,
          createdAt: true,
          monitor: { select: { name: true } },
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
        take: 6,
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
      prisma.change.count({
        where: {
          analysisStatus: "PENDING",
          monitor: { userId },
        },
      }),
    ]);

  const lines: string[] = [
    "USER_MONITORING_SNAPSHOT (private — only this user; answer from this data when asked about their account):",
    `Monitors: ${monitors.length} listed (cap 12). Pending AI analyses: ${pendingAnalyses}.`,
  ];

  if (monitors.length === 0) {
    lines.push("No monitors yet. Suggest creating one from Monitors → Create Monitor.");
  } else {
    lines.push("Monitors:");
    for (const m of monitors) {
      const domain = (() => {
        try {
          return new URL(m.url).hostname;
        } catch {
          return m.url.slice(0, 40);
        }
      })();
      const err = m.errorMessage ? ` err=${truncateToChars(m.errorMessage, 60)}` : "";
      lines.push(
        `- ${m.name} (${domain}) status=${m.status} changes=${m._count.changes}${err}`
      );
    }
  }

  lines.push(`Changes today (UTC): ${changesToday.length}`);
  for (const c of changesToday) {
    lines.push(
      `- [${c.importance}] ${c.emoji} ${c.monitor.name}: ${truncateToChars(c.summary || "No summary", 120)} (${c.analysisStatus})`
    );
  }

  if (importantChanges.length > 0) {
    lines.push("Important (7d HIGH/CRITICAL):");
    for (const c of importantChanges) {
      lines.push(
        `- [${c.importance}] ${c.emoji} ${c.monitor.name}: ${truncateToChars(c.summary || "No summary", 100)}`
      );
    }
  }

  if (recentNotifications.length > 0) {
    lines.push("Recent notifications (7d):");
    for (const n of recentNotifications) {
      const mon = n.change?.monitor.name ?? "unknown";
      const sum = truncateToChars(n.change?.summary || "", 80);
      lines.push(
        `- ${n.channel}/${n.status} ${mon}: ${sum} [${n.change?.importance ?? "?"}]`
      );
    }
  }

  const needsAttention = monitors.filter((m) => m.status === "ERROR" || m.status === "PAUSED");
  if (needsAttention.length > 0) {
    lines.push("Needs attention:");
    for (const m of needsAttention) {
      lines.push(`- ${m.name}: ${m.status}${m.errorMessage ? ` — ${truncateToChars(m.errorMessage, 80)}` : ""}`);
    }
  }

  return truncateToChars(lines.join("\n"), USER_CONTEXT_MAX_CHARS);
}
