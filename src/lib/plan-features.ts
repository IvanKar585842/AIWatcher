import { MonitoringInterval, MonitoringMode, Plan } from "@prisma/client";

/**
 * Central feature registry — single source of truth for plan entitlements.
 * Add new features here; do not hardcode limits in random call sites.
 */
export type PlanFeatureName =
  | "AI_ANALYSIS"
  | "VISUAL_MONITORING"
  | "TELEGRAM_NOTIFICATIONS"
  | "API_ACCESS"
  | "TEAM_MEMBERS"
  | "WEBHOOKS"
  | "ADVANCED_SELECTORS"
  | "KEYWORD_MONITORING"
  | "PRIORITY_PROCESSING"
  | "EXPORT_DATA"
  | "CUSTOM_NOTIFICATION_RULES"
  | "SMART_IMPORTANCE"
  | "LONGER_HISTORY"
  | "FASTER_INTERVALS"
  | "SHARED_MONITORS"
  | "ADVANCED_REPORTS";

export type PlanFeatureDef = {
  enabled: boolean;
  /** null = unlimited when enabled; ignored when disabled */
  limit: number | null;
};

export type PlanEntitlements = {
  maxMonitors: number;
  minInterval: MonitoringInterval;
  historyDays: number | null;
  chatDailyMessages: number;
  aiAnalysesPerMonth: number | null;
  notificationsPerMonth: number | null;
  storageMb: number | null;
  maxVisualMonitors: number;
  teamMembers: number;
  /** Legacy boolean mirrors used across the app */
  telegram: boolean;
  aiSummaries: boolean;
  teams: boolean;
  api: boolean;
  priority: boolean;
  features: Record<PlanFeatureName, PlanFeatureDef>;
};

function feature(enabled: boolean, limit: number | null = null): PlanFeatureDef {
  return { enabled, limit };
}

export const PLAN_ENTITLEMENTS: Record<Plan, PlanEntitlements> = {
  FREE: {
    maxMonitors: 3,
    minInterval: MonitoringInterval.TWELVE_HOURS,
    historyDays: 7,
    chatDailyMessages: 20,
    aiAnalysesPerMonth: 5,
    notificationsPerMonth: 100,
    storageMb: 50,
    maxVisualMonitors: 0,
    teamMembers: 1,
    telegram: false,
    aiSummaries: false,
    teams: false,
    api: false,
    priority: false,
    features: {
      AI_ANALYSIS: feature(true, 5),
      VISUAL_MONITORING: feature(false),
      TELEGRAM_NOTIFICATIONS: feature(false),
      API_ACCESS: feature(false),
      TEAM_MEMBERS: feature(false, 1),
      WEBHOOKS: feature(false),
      ADVANCED_SELECTORS: feature(false),
      KEYWORD_MONITORING: feature(false),
      PRIORITY_PROCESSING: feature(false),
      EXPORT_DATA: feature(false),
      CUSTOM_NOTIFICATION_RULES: feature(false),
      SMART_IMPORTANCE: feature(false),
      LONGER_HISTORY: feature(false, 7),
      FASTER_INTERVALS: feature(false),
      SHARED_MONITORS: feature(false),
      ADVANCED_REPORTS: feature(false),
    },
  },
  PRO: {
    maxMonitors: 100,
    minInterval: MonitoringInterval.FIVE_MIN,
    historyDays: null,
    chatDailyMessages: 200,
    aiAnalysesPerMonth: 2000,
    notificationsPerMonth: 10000,
    storageMb: 5000,
    maxVisualMonitors: 25,
    teamMembers: 1,
    telegram: true,
    aiSummaries: true,
    teams: false,
    api: false,
    priority: false,
    features: {
      AI_ANALYSIS: feature(true, 2000),
      VISUAL_MONITORING: feature(true, 25),
      TELEGRAM_NOTIFICATIONS: feature(true),
      API_ACCESS: feature(false),
      TEAM_MEMBERS: feature(false, 1),
      WEBHOOKS: feature(false),
      ADVANCED_SELECTORS: feature(true),
      KEYWORD_MONITORING: feature(true),
      PRIORITY_PROCESSING: feature(false),
      EXPORT_DATA: feature(true),
      CUSTOM_NOTIFICATION_RULES: feature(false),
      SMART_IMPORTANCE: feature(true),
      LONGER_HISTORY: feature(true, null),
      FASTER_INTERVALS: feature(true),
      SHARED_MONITORS: feature(false),
      ADVANCED_REPORTS: feature(false),
    },
  },
  BUSINESS: {
    maxMonitors: Infinity,
    minInterval: MonitoringInterval.FIVE_MIN,
    historyDays: null,
    chatDailyMessages: 1000,
    aiAnalysesPerMonth: null,
    notificationsPerMonth: null,
    storageMb: null,
    maxVisualMonitors: Infinity,
    teamMembers: 25,
    telegram: true,
    aiSummaries: true,
    teams: true,
    api: true,
    priority: true,
    features: {
      AI_ANALYSIS: feature(true, null),
      VISUAL_MONITORING: feature(true, null),
      TELEGRAM_NOTIFICATIONS: feature(true),
      API_ACCESS: feature(true),
      TEAM_MEMBERS: feature(true, 25),
      WEBHOOKS: feature(true),
      ADVANCED_SELECTORS: feature(true),
      KEYWORD_MONITORING: feature(true),
      PRIORITY_PROCESSING: feature(true),
      EXPORT_DATA: feature(true),
      CUSTOM_NOTIFICATION_RULES: feature(true),
      SMART_IMPORTANCE: feature(true),
      LONGER_HISTORY: feature(true, null),
      FASTER_INTERVALS: feature(true),
      SHARED_MONITORS: feature(true),
      ADVANCED_REPORTS: feature(true),
    },
  },
};

/** Human-facing upgrade copy — value-first, not "limit reached". */
export const FEATURE_UPGRADE_COPY: Record<
  PlanFeatureName,
  { title: string; description: string; minPlan: Plan }
> = {
  AI_ANALYSIS: {
    title: "AI analysis is available in Pro",
    description:
      "Upgrade to automatically understand which changes are important — and skip the noise.",
    minPlan: Plan.PRO,
  },
  VISUAL_MONITORING: {
    title: "Visual monitoring is a Pro feature",
    description:
      "Catch design and layout changes with screenshot comparison — ideal for landing pages and dashboards.",
    minPlan: Plan.PRO,
  },
  TELEGRAM_NOTIFICATIONS: {
    title: "Instant Telegram alerts on Pro",
    description: "Get important changes on your phone the moment they matter.",
    minPlan: Plan.PRO,
  },
  API_ACCESS: {
    title: "API access is included with Business",
    description: "Connect WatchFlow to your internal tools and automate workflows.",
    minPlan: Plan.BUSINESS,
  },
  TEAM_MEMBERS: {
    title: "Collaborate with your team on Business",
    description: "Invite teammates, share monitors, and keep everyone aligned.",
    minPlan: Plan.BUSINESS,
  },
  WEBHOOKS: {
    title: "Webhooks unlock custom workflows",
    description: "Push change events into Slack, Discord, or your own systems.",
    minPlan: Plan.BUSINESS,
  },
  ADVANCED_SELECTORS: {
    title: "Advanced selectors are on Pro",
    description: "Monitor a precise CSS or XPath element instead of the whole page.",
    minPlan: Plan.PRO,
  },
  KEYWORD_MONITORING: {
    title: "Keyword monitoring is on Pro",
    description: "Get notified only when specific words or phrases appear or change.",
    minPlan: Plan.PRO,
  },
  PRIORITY_PROCESSING: {
    title: "Priority processing for Business",
    description: "Your checks jump the queue when speed matters most.",
    minPlan: Plan.BUSINESS,
  },
  EXPORT_DATA: {
    title: "Export your history on Pro",
    description: "Download change history for audits, reports, and compliance.",
    minPlan: Plan.PRO,
  },
  CUSTOM_NOTIFICATION_RULES: {
    title: "Custom notification rules on Business",
    description: "Route alerts by importance, monitor, or team — on your terms.",
    minPlan: Plan.BUSINESS,
  },
  SMART_IMPORTANCE: {
    title: "Smart importance detection on Pro",
    description: "AI rates each change so you only act on what matters.",
    minPlan: Plan.PRO,
  },
  LONGER_HISTORY: {
    title: "Longer history on Pro",
    description: "Keep months of change history for trends and investigations.",
    minPlan: Plan.PRO,
  },
  FASTER_INTERVALS: {
    title: "Faster checks on Pro",
    description: "Monitor as often as every 5 minutes when timing is critical.",
    minPlan: Plan.PRO,
  },
  SHARED_MONITORS: {
    title: "Shared monitors on Business",
    description: "One workspace for your whole team — no more siloed alerts.",
    minPlan: Plan.BUSINESS,
  },
  ADVANCED_REPORTS: {
    title: "Advanced reports on Business",
    description: "Executive-ready summaries of monitoring health across sites.",
    minPlan: Plan.BUSINESS,
  },
};

export const FEATURE_COMPARISON_ROWS: Array<{
  feature: PlanFeatureName;
  label: string;
  free: string;
  pro: string;
  business: string;
}> = [
  {
    feature: "AI_ANALYSIS",
    label: "AI change analysis",
    free: "5 / month",
    pro: "2,000 / month",
    business: "Unlimited",
  },
  {
    feature: "SMART_IMPORTANCE",
    label: "Smart importance detection",
    free: "—",
    pro: "Included",
    business: "Included",
  },
  {
    feature: "FASTER_INTERVALS",
    label: "Check frequency",
    free: "Every 12h+",
    pro: "From 5 min",
    business: "From 5 min",
  },
  {
    feature: "VISUAL_MONITORING",
    label: "Visual / screenshot monitoring",
    free: "—",
    pro: "Up to 25",
    business: "Unlimited",
  },
  {
    feature: "TELEGRAM_NOTIFICATIONS",
    label: "Telegram alerts",
    free: "—",
    pro: "Included",
    business: "Included",
  },
  {
    feature: "LONGER_HISTORY",
    label: "Change history",
    free: "7 days",
    pro: "Unlimited",
    business: "Unlimited",
  },
  {
    feature: "KEYWORD_MONITORING",
    label: "Keyword & selector modes",
    free: "—",
    pro: "Included",
    business: "Included",
  },
  {
    feature: "API_ACCESS",
    label: "API & webhooks",
    free: "—",
    pro: "—",
    business: "Included",
  },
  {
    feature: "TEAM_MEMBERS",
    label: "Team collaboration",
    free: "—",
    pro: "—",
    business: "Up to 25",
  },
  {
    feature: "PRIORITY_PROCESSING",
    label: "Priority processing",
    free: "—",
    pro: "—",
    business: "Included",
  },
];

export function getPlanEntitlements(plan: Plan): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan];
}

export function isFeatureEnabled(plan: Plan, feature: PlanFeatureName): boolean {
  return PLAN_ENTITLEMENTS[plan].features[feature].enabled;
}

export function getFeatureLimit(plan: Plan, feature: PlanFeatureName): number | null {
  const def = PLAN_ENTITLEMENTS[plan].features[feature];
  if (!def.enabled) return 0;
  return def.limit;
}

export function getUpgradeCopy(feature: PlanFeatureName) {
  return FEATURE_UPGRADE_COPY[feature];
}

export function listActiveFeatures(plan: Plan): Array<{ name: PlanFeatureName; label: string }> {
  const labels: Partial<Record<PlanFeatureName, string>> = {
    AI_ANALYSIS: "AI change analysis",
    SMART_IMPORTANCE: "Smart importance detection",
    FASTER_INTERVALS: "Fast monitoring intervals",
    VISUAL_MONITORING: "Visual monitoring",
    TELEGRAM_NOTIFICATIONS: "Telegram notifications",
    LONGER_HISTORY: "Extended history",
    ADVANCED_SELECTORS: "Advanced selectors",
    KEYWORD_MONITORING: "Keyword monitoring",
    EXPORT_DATA: "Data export",
    API_ACCESS: "API access",
    WEBHOOKS: "Webhooks",
    TEAM_MEMBERS: "Team members",
    SHARED_MONITORS: "Shared monitors",
    PRIORITY_PROCESSING: "Priority processing",
    CUSTOM_NOTIFICATION_RULES: "Custom notification rules",
    ADVANCED_REPORTS: "Advanced reports",
  };

  return (Object.keys(PLAN_ENTITLEMENTS[plan].features) as PlanFeatureName[])
    .filter((name) => PLAN_ENTITLEMENTS[plan].features[name].enabled)
    .map((name) => ({ name, label: labels[name] ?? name }));
}

const VISUAL_MODES: MonitoringMode[] = [
  MonitoringMode.VISUAL_CHANGES,
  MonitoringMode.SCREENSHOT_DIFF,
];

const ADVANCED_SELECTOR_MODES: MonitoringMode[] = [
  MonitoringMode.CSS_SELECTOR,
  MonitoringMode.XPATH,
];

const KEYWORD_MODES: MonitoringMode[] = [MonitoringMode.KEYWORD_DETECTION];

export function requiredFeatureForMode(mode: MonitoringMode): PlanFeatureName | null {
  if (VISUAL_MODES.includes(mode)) return "VISUAL_MONITORING";
  if (ADVANCED_SELECTOR_MODES.includes(mode)) return "ADVANCED_SELECTORS";
  if (KEYWORD_MODES.includes(mode)) return "KEYWORD_MONITORING";
  return null;
}

export function planAllowsInterval(plan: Plan, interval: MonitoringInterval): boolean {
  const order: MonitoringInterval[] = [
    MonitoringInterval.FIVE_MIN,
    MonitoringInterval.FIFTEEN_MIN,
    MonitoringInterval.THIRTY_MIN,
    MonitoringInterval.ONE_HOUR,
    MonitoringInterval.SIX_HOURS,
    MonitoringInterval.TWELVE_HOURS,
    MonitoringInterval.TWENTY_FOUR_HOURS,
  ];
  const entitlements = getPlanEntitlements(plan);
  const minIndex = order.indexOf(entitlements.minInterval);
  const requestedIndex = order.indexOf(interval);
  return requestedIndex >= minIndex;
}
