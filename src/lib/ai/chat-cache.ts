import { createHash } from "crypto";
import { prisma } from "@/lib/db";

export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashQuestion(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

interface FaqEntry {
  patterns: RegExp[];
  answer: string;
}

const STATIC_FAQ: FaqEntry[] = [
  {
    patterns: [
      /how (do|can) i create (a )?monitor/i,
      /create (a )?monitor/i,
      /как создать монитор/i,
      /как добавить монитор/i,
    ],
    answer: `To create a monitor in WatchFlow:

1. Go to **Monitors** in the sidebar (or use the dashboard empty state).
2. Click **Create Monitor**.
3. Enter a **name** and the **URL** you want to watch.
4. Choose a **monitoring mode** (e.g. Entire Website, Visual Changes, Price Tracking).
5. Set the **check interval** (Free plan: minimum 12 hours; Pro/Business: down to 5 minutes).
6. Pick **notifications**: Email, Telegram, or Both.
7. Optionally add an AI prompt, keywords, or a CSS/XPath selector.
8. Click **Save**.

The first check stores a baseline snapshot. Later checks compare against it and alert you when something meaningful changes.`,
  },
  {
    patterns: [
      /how does billing work/i,
      /subscription plan/i,
      /what (plans|pricing)/i,
      /как работает оплата/i,
      /тариф/i,
    ],
    answer: `WatchFlow has three plans:

**Free** — 3 monitors, 12-hour minimum interval, 7-day history, email notifications.

**Pro** — 100 monitors, 5-minute intervals, unlimited history, Telegram, AI summaries.

**Business** — unlimited monitors, priority queue, API access, team features.

Open **Dashboard → Billing** to see your current plan, usage limits, and upgrade options. Payments are handled securely via Stripe.`,
  },
  {
    patterns: [
      /how does ai monitoring work/i,
      /what is ai smart/i,
      /ai monitor/i,
      /как работает ai/i,
      /ии мониторинг/i,
    ],
    answer: `AI monitoring in WatchFlow works in two ways:

**AI Smart mode** — When creating a monitor, choose AI Smart to focus on the main content area instead of noisy page chrome.

**Change analysis** — After any detected change, WatchFlow sends old vs. new content to AI (OpenAI or Gemini) with your optional custom prompt. The AI writes a human-readable summary and decides if the change is important enough to notify you.

If no AI API key is configured, a built-in fallback still produces a useful text summary. Noise like timestamps and ads is typically filtered out.`,
  },
  {
    patterns: [
      /why didn'?t i (get|receive) (a )?notification/i,
      /no notification/i,
      /не пришло уведомление/i,
      /не получил уведомление/i,
    ],
    answer: `If you didn't receive a notification, check these common causes:

1. **Was a change actually detected?** Open **History** — if nothing is listed, the page may not have changed meaningfully.
2. **AI filtered it as noise** — Minor formatting or timestamps may set shouldNotify=false (no email/Telegram, but in-app bell may still show it).
3. **Monitor paused or in ERROR** — Check the monitor card status on the Monitors page.
4. **Email** — Check spam; server needs Resend configured; monitor must use Email or Both.
5. **Telegram** — Link your account in Settings (Pro+ required); monitor must use Telegram or Both.
6. **Wrong notification method** — Edit the monitor and confirm Email/Telegram settings.`,
  },
  {
    patterns: [
      /what monitoring mode/i,
      /which mode should/i,
      /какой режим/i,
    ],
    answer: `Choose a monitoring mode based on your goal:

- **General website changes** → Entire Website or Text Changes
- **Layout/design shifts** → Visual Changes or Screenshot Diff
- **Price drops** → Price Tracking
- **Specific words appearing** → Keyword Tracking
- **One element on the page** → CSS Selector or XPath
- **API endpoint** → API Response
- **Main article/content focus** → AI Smart

For social sites like Facebook, use **Visual Changes** (robots.txt is skipped for visual modes).`,
  },
  {
    patterns: [
      /how (do|can) i monitor price/i,
      /price tracking/i,
      /price change/i,
      /отслеживать цену/i,
    ],
    answer: `To monitor price changes:

1. Go to **Monitors → Create Monitor**.
2. Enter the product page URL.
3. Select **Price Tracking** as the monitoring mode.
4. Set your preferred check interval and notifications.
5. Save the monitor.

WatchFlow extracts price-like content from the page and alerts you when it changes. For a single price element, you can also use **CSS Selector** mode with a selector pointing to the price element.`,
  },
];

export function findStaticFaqAnswer(question: string): string | null {
  const trimmed = question.trim();
  for (const entry of STATIC_FAQ) {
    if (entry.patterns.some((p) => p.test(trimmed))) {
      return entry.answer;
    }
  }
  return null;
}

export async function findCachedAnswer(question: string): Promise<string | null> {
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;

  const cached = await prisma.chatAnswerCache.findUnique({
    where: { normalizedQuestion: normalized },
  });

  if (!cached) return null;

  await prisma.chatAnswerCache.update({
    where: { id: cached.id },
    data: { hitCount: { increment: 1 } },
  });

  return cached.answer;
}

async function storeCachedAnswer(question: string, answer: string): Promise<void> {
  const normalized = normalizeQuestion(question);
  if (!normalized || answer.length < 20) return;

  const questionHash = hashQuestion(normalized);

  await prisma.chatAnswerCache.upsert({
    where: { normalizedQuestion: normalized },
    create: { normalizedQuestion: normalized, questionHash, answer },
    update: { answer },
  });
}

export async function storeCachedAnswerIfWorthwhile(
  question: string,
  answer: string
): Promise<void> {
  const trimmed = question.trim();
  if (trimmed.length > 200 || answer.length > 4000) return;

  const { isAccountSpecificQuestion } = await import("./chat-user-context");
  if (isAccountSpecificQuestion(trimmed)) return;

  const isFaqLike = findStaticFaqAnswer(trimmed) !== null || trimmed.length <= 120;
  if (!isFaqLike) return;

  await storeCachedAnswer(trimmed, answer);
}

export async function resolveCachedAnswer(question: string): Promise<{
  answer: string;
  source: "static" | "database";
} | null> {
  // Never serve shared FAQ cache for account-specific questions
  const { isAccountSpecificQuestion } = await import("./chat-user-context");
  if (isAccountSpecificQuestion(question)) {
    return null;
  }

  const staticAnswer = findStaticFaqAnswer(question);
  if (staticAnswer) {
    return { answer: staticAnswer, source: "static" };
  }

  const dbAnswer = await findCachedAnswer(question);
  if (dbAnswer) {
    return { answer: dbAnswer, source: "database" };
  }

  return null;
}
