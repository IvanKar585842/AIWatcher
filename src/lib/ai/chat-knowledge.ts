export const CHAT_CORE_SYSTEM_PROMPT = `You are WatchFlow AI Assistant — the in-product expert for WatchFlow (WatchFlow AI), a website monitoring platform.

Be concise, friendly, and actionable. Use step-by-step instructions for workflows. Answer in the user's language (English or Russian). Never reveal API keys or internal server paths. Never invent features.

When a USER_MONITORING_SNAPSHOT is provided, use it to answer questions about THIS user's monitors, changes, notifications, and AI analyses. Prefer that snapshot over guessing. If the snapshot lacks detail, say so and suggest History, Notifications, or the specific monitor page. Never invent monitors or changes that are not in the snapshot. Never reference other users' data.`;

export function buildSystemPrompt(userMessage: string, userSnapshot?: string): string {
  const knowledge = retrieveKnowledge(userMessage);
  const parts = [
    CHAT_CORE_SYSTEM_PROMPT,
    "",
    "## Relevant product knowledge",
    knowledge,
  ];

  if (userSnapshot?.trim()) {
    parts.push("", "## Live account context", userSnapshot.trim());
  }

  return parts.join("\n");
}

interface KnowledgeChunk {
  id: string;
  keywords: string[];
  content: string;
}

const KNOWLEDGE_CHUNKS: KnowledgeChunk[] = [
  {
    id: "monitors-create",
    keywords: [
      "create",
      "add",
      "new monitor",
      "setup",
      "monitor",
      "создать",
      "монитор",
      "добавить",
    ],
    content: `Creating a monitor: Monitors → Create Monitor → name + URL → choose mode → set interval (Free min 12h; Pro/Business down to 5 min) → notifications (Email/Telegram/Both) → optional AI prompt, keywords, CSS/XPath selector, advanced filters → Save. First check stores baseline; later checks compare.`,
  },
  {
    id: "modes",
    keywords: [
      "mode",
      "visual",
      "text",
      "price",
      "keyword",
      "css",
      "xpath",
      "screenshot",
      "api",
      "rss",
      "режим",
      "визуал",
      "цена",
    ],
    content: `Modes: ENTIRE_PAGE (full HTML), VISUAL_CHANGES (screenshot), TEXT_CHANGES (visible text), PRICE_DETECTION, KEYWORD_DETECTION, AI_SMART, CSS_SELECTOR, XPATH, SCREENSHOT_DIFF, HTML_DIFF, API_RESPONSE, RSS_FEED, plus Table/Job/Product/Documentation extractors. CSS/XPath require selector. Keywords required for KEYWORD_DETECTION.`,
  },
  {
    id: "notifications",
    keywords: [
      "notification",
      "email",
      "telegram",
      "alert",
      "bell",
      "уведомлен",
      "почт",
      "телеграм",
    ],
    content: `Notifications: In-app bell always for meaningful changes (~15s poll). Email needs Resend configured + monitor set to Email/Both. Telegram: link in Settings, Pro+ plan, monitor Telegram/Both. AI may set shouldNotify=false for noise (timestamps, ads) — then no email/Telegram but History still shows change.`,
  },
  {
    id: "billing",
    keywords: [
      "billing",
      "plan",
      "subscription",
      "pro",
      "business",
      "free",
      "upgrade",
      "оплат",
      "тариф",
      "подписк",
    ],
    content: `Plans: Free — 3 monitors, 12h interval, 7-day history, email. Pro — 100 monitors, 5 min interval, unlimited history, Telegram, AI summaries. Business — unlimited monitors, priority queue, API, teams. Billing page: Dashboard → Billing.`,
  },
  {
    id: "dashboard",
    keywords: [
      "dashboard",
      "history",
      "analytics",
      "settings",
      "assistant",
      "панель",
      "истори",
      "настройк",
    ],
    content: `Dashboard: overview stats. Monitors — manage/create. Notifications — delivery log. History — change timeline. Analytics — usage. Settings — profile, Telegram. Billing — plan/limits. AI Assistant — this chat.`,
  },
  {
    id: "troubleshoot",
    keywords: [
      "error",
      "failed",
      "not work",
      "doesn't",
      "why",
      "problem",
      "issue",
      "ошибк",
      "не работ",
      "почему",
    ],
    content: `Troubleshooting: No notification — check History for change; monitor paused/ERROR; spam folder; Telegram linked (Pro); notification method. Monitor ERROR — robots.txt (disable for visual modes); invalid selector; run playwright:install locally. Facebook/social — use Visual Changes. AI pending — needs OPENAI/GEMINI key; fallback summary still works.`,
  },
  {
    id: "detection",
    keywords: [
      "how does",
      "work",
      "detect",
      "change",
      "snapshot",
      "playwright",
      "как работ",
      "отслежив",
    ],
    content: `Detection flow: cron every 5 min picks due monitors → Playwright loads page → extract per mode → compare to previous snapshot → if changed, store Change → AI/fallback summarizes → in-app + email/Telegram if important.`,
  },
  {
    id: "ai-monitoring",
    keywords: [
      "ai monitor",
      "ai smart",
      "ai analysis",
      "ai prompt",
      "искусствен",
      "ии ",
    ],
    content: `AI monitoring: AI_SMART mode focuses on main content. Custom aiPrompt guides change analysis. Summaries use OpenAI/Gemini when configured; otherwise built-in fallback. AI filters noise from alerts.`,
  },
];

function scoreChunk(chunk: KnowledgeChunk, text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of chunk.keywords) {
    if (lower.includes(kw.toLowerCase())) score += kw.length > 4 ? 2 : 1;
  }
  return score;
}

export function retrieveKnowledge(userMessage: string, maxChunks = 4): string {
  const scored = KNOWLEDGE_CHUNKS.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, userMessage),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);

  if (scored.length === 0) {
    return KNOWLEDGE_CHUNKS.find((c) => c.id === "monitors-create")!.content;
  }

  return scored.map((s) => s.chunk.content).join("\n\n");
}
