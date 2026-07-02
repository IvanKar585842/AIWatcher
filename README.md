# WatchFlow AI

AI-powered web monitoring SaaS. Monitor any webpage and get intelligent explanations of **what changed** and **why it matters**.

## Features

- **8 Monitoring Modes**: Entire page, CSS selector, XPath, price detection, keyword detection, table detection, job listings, AI smart mode
- **AI Summaries**: OpenAI, Claude, or Gemini — switchable via `AI_PROVIDER` env var
- **Smart Diff**: Strips ads, tracking, timestamps, cookies, and random IDs before comparing
- **Notifications**: Email (Resend) and Telegram bot with full command support
- **Dashboard**: Monitors, change history, diff viewer, search, and widgets
- **Billing**: Stripe subscriptions (Free / Pro / Business)
- **Scheduling**: Trigger.dev cron jobs with API cron fallback

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, TailwindCSS, shadcn/ui |
| Backend | Next.js API Routes, Prisma |
| Database | PostgreSQL (Supabase) |
| Auth | Clerk |
| Payments | Stripe |
| Email | Resend |
| Monitoring | Playwright |
| Scheduling | Trigger.dev |
| AI | OpenAI / Claude / Gemini |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (Supabase recommended)
- Accounts: Clerk, Stripe, Resend, and at least one AI provider

### Installation

```bash
# Clone and install
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in all required values

# Set up database
npx prisma db push

# Install Playwright browsers
npx playwright install chromium

# Start development server
npm run dev
```

### Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

- `DATABASE_URL` / `DIRECT_URL` — Supabase PostgreSQL connection strings
- `AI_PROVIDER` — `openai`, `claude`, or `gemini`
- `CLERK_*` — Clerk authentication keys
- `STRIPE_*` — Stripe payment keys and price IDs
- `TELEGRAM_BOT_TOKEN` — Telegram bot for notifications
- `RESEND_API_KEY` — Email delivery
- `TRIGGER_SECRET_KEY` — Trigger.dev scheduling

### Database Setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Settings → Database and copy the connection strings
3. Use the **pooled** connection for `DATABASE_URL` and **direct** for `DIRECT_URL`
4. Run `npx prisma db push` to create tables

### Trigger.dev Setup

```bash
# Link project and start dev worker
npm run trigger:dev

# Deploy tasks to production
npm run trigger:deploy
```

### Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`
3. Set webhook: `POST https://api.telegram.org/bot<TOKEN>/setWebhook` with `url` pointing to `/api/telegram/webhook`

### Stripe Setup

1. Create products and prices for Pro ($19/mo) and Business ($49/mo)
2. Set `STRIPE_PRO_PRICE_ID` and `STRIPE_BUSINESS_PRICE_ID`
3. Configure webhook endpoint: `/api/webhooks/stripe`
4. Listen for: `checkout.session.completed`, `customer.subscription.*`

### Cron Fallback

If not using Trigger.dev, set up a cron job to hit:

```
POST /api/cron/monitoring
Authorization: Bearer <CRON_SECRET>
```

Recommended interval: every 5 minutes.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages & API
│   ├── api/                # REST API endpoints
│   ├── dashboard/          # Protected dashboard pages
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── landing/            # Marketing page sections
│   └── dashboard/          # Dashboard components
├── lib/
│   ├── ai/                 # AI provider abstraction
│   ├── monitoring/         # Playwright fetcher, diff, processor
│   ├── notifications/      # Email & Telegram
│   └── telegram/           # Bot command handler
└── trigger/                # Trigger.dev scheduled tasks
prisma/
└── schema.prisma           # Database schema
```

## Pricing Plans

| Feature | Free | Pro ($19/mo) | Business ($49/mo) |
|---------|------|-------------|-------------------|
| Monitors | 3 | 100 | Unlimited |
| Min Interval | 12 hours | 5 minutes | 5 minutes |
| History | 7 days | Unlimited | Unlimited |
| Telegram | ✗ | ✓ | ✓ |
| AI Summaries | ✗ | ✓ | ✓ |
| Teams & API | ✗ | ✗ | ✓ |

## License

MIT
