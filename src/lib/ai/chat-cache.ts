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
    answer: `To add a site in WatchFlowing:

1. Open **Sites** in the sidebar.
2. Click **Add a site**.
3. Name the page and paste an address your company owns.
4. Choose what the assistant should watch: the whole page, the words, one section, or a plain description.
5. Set how often to look. Free is every 12 or 24 hours. Pro can be as often as every 30 minutes. Business can be as often as every minute.
6. Choose email, Telegram, or both.
7. Save.

The first check stores a baseline. Later checks explain what changed on that page.`,
  },
  {
    patterns: [
      /how does billing work/i,
      /subscription plan/i,
      /what (plans|pricing)/i,
      /как работает оплата/i,
      /тариф/i,
    ],
    answer: `WatchFlowing has three plans:

**Free** — 3 of your company's sites, checks every 12 or 24 hours, 7-day history, email.

**Pro** — up to 100 of your sites, checks as often as every 30 minutes, unlimited history, Telegram, explanations.

**Business** — unlimited sites, priority checks, API access, and a team.

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
    answer: `The assistant explains changes on a site your company owns.

**Say what matters** — when you add a page, describe the change you care about. The assistant looks for that.

**After a change** — WatchFlowing compares the page with the last snapshot and writes a short explanation. Noise such as timestamps and ads is filtered first.

If no AI key is configured, a built-in summary is still written.`,
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
3. **The page is paused or failing** — Open **Sites** and check that page.
4. **Email** — Check spam. The page must send email alerts.
5. **Telegram** — Link the account in Settings. The page must send Telegram alerts.
6. **Wrong notification method** — Edit the monitor and confirm Email/Telegram settings.`,
  },
  {
    patterns: [
      /what monitoring mode/i,
      /which mode should/i,
      /какой режим/i,
    ],
    answer: `On a page your company owns:

- **The whole page** — ordinary changes
- **The words** — wording only
- **The look** — layout and images
- **One section** — a header, price, or block you choose
- **Words you choose** — a phrase that should appear or disappear
- **Your API or feed** — a response or feed you publish
- **Say what matters** — describe the change in plain language

Start with **The whole page**. If your site blocks the check, verify the domain or install the site script.`,
  },
  {
    patterns: [
      /how (do|can) i monitor price/i,
      /price tracking/i,
      /price change/i,
      /отслеживать цену/i,
    ],
    answer: `To watch a price on a page your company owns:

1. Open **Sites** and click **Add a site**.
2. Paste the product page you publish.
3. Choose **One section** and point at the price, or choose **The whole page**.
4. Save.

The assistant tells you when that price changes.`,
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
