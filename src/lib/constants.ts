import {
  MonitoringInterval,
  Plan,
  type MonitoringMode,
  type NotificationMethod,
} from "@prisma/client";

/**
 * Legacy limit shape used across existing call sites.
 * Keep in sync with PLAN_ENTITLEMENTS in plan-features.ts.
 */
export const PLAN_LIMITS = {
  FREE: {
    maxMonitors: 3,
    minInterval: MonitoringInterval.TWENTY_FOUR_HOURS,
    historyDays: 7 as number | null,
    telegram: false,
    aiSummaries: false,
    teams: false,
    api: false,
    priority: false,
  },
  PRO: {
    maxMonitors: 100,
    minInterval: MonitoringInterval.THIRTY_MIN,
    historyDays: null as number | null,
    telegram: true,
    aiSummaries: true,
    teams: false,
    api: false,
    priority: false,
  },
  BUSINESS: {
    maxMonitors: Infinity,
    minInterval: MonitoringInterval.ONE_MIN,
    historyDays: null as number | null,
    telegram: true,
    aiSummaries: true,
    teams: true,
    api: true,
    priority: true,
  },
} as const;

export const INTERVAL_LABELS: Record<MonitoringInterval, string> = {
  ONE_MIN: "1 minute",
  FIVE_MIN: "5 minutes",
  FIFTEEN_MIN: "15 minutes",
  THIRTY_MIN: "30 minutes",
  ONE_HOUR: "1 hour",
  SIX_HOURS: "6 hours",
  TWELVE_HOURS: "12 hours",
  TWENTY_FOUR_HOURS: "24 hours",
};

export const INTERVAL_MINUTES: Record<MonitoringInterval, number> = {
  ONE_MIN: 1,
  FIVE_MIN: 5,
  FIFTEEN_MIN: 15,
  THIRTY_MIN: 30,
  ONE_HOUR: 60,
  SIX_HOURS: 360,
  TWELVE_HOURS: 720,
  TWENTY_FOUR_HOURS: 1440,
};

export const INTERVAL_ORDER: MonitoringInterval[] = [
  MonitoringInterval.ONE_MIN,
  MonitoringInterval.FIVE_MIN,
  MonitoringInterval.FIFTEEN_MIN,
  MonitoringInterval.THIRTY_MIN,
  MonitoringInterval.ONE_HOUR,
  MonitoringInterval.SIX_HOURS,
  MonitoringInterval.TWELVE_HOURS,
  MonitoringInterval.TWENTY_FOUR_HOURS,
];

export const MODE_LABELS: Record<MonitoringMode, string> = {
  ENTIRE_PAGE: "Full Page Monitoring",
  VISUAL_CHANGES: "Image Change Monitoring",
  TEXT_CHANGES: "Text Change Monitoring",
  CSS_SELECTOR: "Specific Section Monitoring",
  XPATH: "XPath Selector",
  PRICE_DETECTION: "Pricing Page Monitoring",
  KEYWORD_DETECTION: "Keyword Monitoring",
  TABLE_DETECTION: "Table Monitoring",
  PRODUCT_AVAILABILITY: "Product Availability",
  JOB_LISTINGS: "Job Listings",
  DOCUMENTATION_CHANGES: "Documentation Monitoring",
  API_RESPONSE: "API Monitoring",
  RSS_FEED: "RSS Feed",
  HTML_DIFF: "HTML Diff",
  SCREENSHOT_DIFF: "Screenshot Diff",
  AI_SMART: "AI Monitoring",
};

export const NOTIFICATION_LABELS: Record<NotificationMethod, string> = {
  TELEGRAM: "Telegram",
  EMAIL: "Email",
  BOTH: "Telegram & Email",
};

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan];
}

export function isIntervalAllowed(plan: Plan, interval: MonitoringInterval): boolean {
  const limits = getPlanLimits(plan);
  const minIndex = INTERVAL_ORDER.indexOf(limits.minInterval);
  const requestedIndex = INTERVAL_ORDER.indexOf(interval);
  return requestedIndex >= minIndex;
}

export function getAllowedIntervals(plan: Plan): MonitoringInterval[] {
  const limits = getPlanLimits(plan);
  const minIndex = INTERVAL_ORDER.indexOf(limits.minInterval);
  return INTERVAL_ORDER.slice(minIndex);
}

/**
 * Clamp a stored monitor interval to what the user's plan actually allows.
 * Prevents faster-than-plan checks after downgrades.
 */
export function resolveEffectiveInterval(
  plan: Plan,
  interval: MonitoringInterval
): MonitoringInterval {
  if (isIntervalAllowed(plan, interval)) return interval;
  return getPlanLimits(plan).minInterval;
}

export function intervalToMs(interval: MonitoringInterval): number {
  return INTERVAL_MINUTES[interval] * 60 * 1000;
}

export const PRICING_PLANS = [
  {
    id: "free" as const,
    plan: Plan.FREE,
    name: "Free",
    price: 0,
    description: "Try WatchFlowing and see how monitoring feels in practice.",
    features: [
      "Basic website monitoring (3 sites)",
      "Checks every 24 hours",
      "7-day change history",
      "Email notifications",
      "Basic change detection",
      "5 AI analyses / month to experience the magic",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    id: "pro" as const,
    plan: Plan.PRO,
    name: "Pro",
    price: 19,
    description: "For owners and developers who need clarity, not just alerts.",
    features: [
      "Up to 100 monitors",
      "Checks as often as every 30 minutes",
      "AI-powered change analysis",
      "Smart importance detection",
      "Visual & screenshot comparison",
      "Keyword and selector monitoring",
      "Telegram alerts",
      "Unlimited history",
    ],
    cta: "Start Pro",
    popular: true,
  },
  {
    id: "business" as const,
    plan: Plan.BUSINESS,
    name: "Business",
    price: 49,
    description: "For teams that need shared visibility and automation.",
    features: [
      "Unlimited monitors",
      "Team members & shared monitors",
      "API access & webhooks",
      "Unlimited AI analysis",
      "Checks as often as every 1 minute",
      "Priority check processing",
      "Custom notification rules",
      "Advanced reports & export",
      "Priority support",
    ],
    cta: "Upgrade to Business",
    popular: false,
  },
];

export const STRIPE_PRICE_IDS = {
  get PRO_MONTHLY() {
    return process.env.STRIPE_PRO_PRICE_ID?.trim() ?? "";
  },
  get BUSINESS_MONTHLY() {
    return process.env.STRIPE_BUSINESS_PRICE_ID?.trim() ?? "";
  },
};
