import {
  MonitoringInterval,
  Plan,
  type MonitoringMode,
  type NotificationMethod,
} from "@prisma/client";

export const PLAN_LIMITS = {
  FREE: {
    maxMonitors: 3,
    minInterval: MonitoringInterval.TWELVE_HOURS,
    historyDays: 7,
    telegram: false,
    aiSummaries: false,
    teams: false,
    api: false,
    priority: false,
  },
  PRO: {
    maxMonitors: 100,
    minInterval: MonitoringInterval.FIVE_MIN,
    historyDays: null as number | null,
    telegram: true,
    aiSummaries: true,
    teams: false,
    api: false,
    priority: false,
  },
  BUSINESS: {
    maxMonitors: Infinity,
    minInterval: MonitoringInterval.FIVE_MIN,
    historyDays: null as number | null,
    telegram: true,
    aiSummaries: true,
    teams: true,
    api: true,
    priority: true,
  },
} as const;

export const INTERVAL_LABELS: Record<MonitoringInterval, string> = {
  FIVE_MIN: "5 minutes",
  FIFTEEN_MIN: "15 minutes",
  THIRTY_MIN: "30 minutes",
  ONE_HOUR: "1 hour",
  SIX_HOURS: "6 hours",
  TWELVE_HOURS: "12 hours",
  TWENTY_FOUR_HOURS: "24 hours",
};

export const INTERVAL_MINUTES: Record<MonitoringInterval, number> = {
  FIVE_MIN: 5,
  FIFTEEN_MIN: 15,
  THIRTY_MIN: 30,
  ONE_HOUR: 60,
  SIX_HOURS: 360,
  TWELVE_HOURS: 720,
  TWENTY_FOUR_HOURS: 1440,
};

export const INTERVAL_ORDER: MonitoringInterval[] = [
  MonitoringInterval.FIVE_MIN,
  MonitoringInterval.FIFTEEN_MIN,
  MonitoringInterval.THIRTY_MIN,
  MonitoringInterval.ONE_HOUR,
  MonitoringInterval.SIX_HOURS,
  MonitoringInterval.TWELVE_HOURS,
  MonitoringInterval.TWENTY_FOUR_HOURS,
];

export const MODE_LABELS: Record<MonitoringMode, string> = {
  ENTIRE_PAGE: "Entire Page",
  CSS_SELECTOR: "CSS Selector",
  XPATH: "XPath",
  PRICE_DETECTION: "Price Detection",
  KEYWORD_DETECTION: "Keyword Detection",
  TABLE_DETECTION: "Table Detection",
  JOB_LISTINGS: "Job Listings",
  AI_SMART: "AI Smart Mode",
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

export const PRICING_PLANS = [
  {
    id: "free" as const,
    plan: Plan.FREE,
    name: "Free",
    price: 0,
    description: "Perfect for trying out WatchFlow AI",
    features: [
      "3 monitors",
      "12 hour minimum interval",
      "7 day history",
      "Email notifications",
      "Basic change detection",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    id: "pro" as const,
    plan: Plan.PRO,
    name: "Pro",
    price: 19,
    description: "For power users who need real-time insights",
    features: [
      "100 monitors",
      "5 minute interval",
      "Unlimited history",
      "Telegram notifications",
      "AI-powered summaries",
      "All monitoring modes",
      "Diff viewer",
    ],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    id: "business" as const,
    plan: Plan.BUSINESS,
    name: "Business",
    price: 49,
    description: "For teams that need enterprise-grade monitoring",
    features: [
      "Unlimited monitors",
      "5 minute interval",
      "Unlimited history",
      "Team collaboration",
      "API access",
      "Priority monitoring",
      "Dedicated support",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export const STRIPE_PRICE_IDS = {
  PRO_MONTHLY: process.env.STRIPE_PRO_PRICE_ID ?? "",
  BUSINESS_MONTHLY: process.env.STRIPE_BUSINESS_PRICE_ID ?? "",
};
