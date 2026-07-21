import type { MonitoringMode } from "@prisma/client";
import {
  BookOpen,
  Brain,
  Briefcase,
  Code,
  Diff,
  Eye,
  FileText,
  Globe,
  Hash,
  Image,
  Megaphone,
  Newspaper,
  Package,
  Rss,
  Search,
  Sparkles,
  Table,
  Target,
  Type,
  type LucideIcon,
} from "lucide-react";

/** Page readiness strategy for browser-based checks. */
export type WaitStrategy = "dom" | "load" | "networkidle" | "stabilize";

export type SessionStatus = "none" | "active" | "expired";

export interface MonitorConfig {
  retryAttempts?: number;
  timeout?: number;
  ignoreCookies?: boolean;
  ignoreTimestamps?: boolean;
  ignoreAds?: boolean;
  ignoreRandomIds?: boolean;
  ignoreDynamicContent?: boolean;
  ignoreSelectors?: string;
  archived?: boolean;
  monitorTypeId?: string;
  minImportance?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  notificationFrequency?: "INSTANT" | "HOURLY" | "DAILY";
  /** How long to wait for the page to become usable before extraction. */
  waitStrategy?: WaitStrategy;
  /** Extra settle delay (ms) after the chosen wait strategy. */
  stabilizeMs?: number;
  /** Scroll to trigger lazy-loaded content (default true). */
  scrollForLazyLoad?: boolean;
  /** Max scroll depth in px when lazy-load scrolling is enabled. */
  scrollDepthPx?: number;
  /** Adaptive wait: continue when this CSS selector appears. */
  waitForSelector?: string | null;
  /** Comma-separated CSS selectors to expand/click before capture (accordions, “show more”). */
  expandSelectors?: string;
  /**
   * Write-only: plaintext JSON cookie array from the settings UI.
   * Encrypted server-side into encryptedSession — never persisted as plain text.
   */
  sessionCookiesPlain?: string;
  /** AES-GCM sealed Playwright cookies (server-only; never send to client). */
  encryptedSession?: string;
  /** Client hint after sanitization — true when a session is stored. */
  hasSession?: boolean;
  sessionStatus?: SessionStatus;
  /** ISO expiry; when past, monitoring asks the user to reconnect. */
  sessionExpiresAt?: string | null;
  /** Write-only flag to wipe stored session cookies. */
  clearSession?: boolean;
}

export const DEFAULT_MONITOR_CONFIG: Required<
  Omit<
    MonitorConfig,
    | "monitorTypeId"
    | "ignoreSelectors"
    | "waitForSelector"
    | "expandSelectors"
    | "sessionCookiesPlain"
    | "encryptedSession"
    | "hasSession"
    | "sessionStatus"
    | "sessionExpiresAt"
    | "clearSession"
  >
> & { ignoreSelectors: string; expandSelectors: string } = {
  retryAttempts: 3,
  timeout: 30000,
  ignoreCookies: true,
  ignoreTimestamps: true,
  ignoreAds: true,
  ignoreRandomIds: true,
  ignoreDynamicContent: true,
  ignoreSelectors: "",
  archived: false,
  minImportance: "MEDIUM",
  notificationFrequency: "INSTANT",
  waitStrategy: "stabilize",
  stabilizeMs: 700,
  scrollForLazyLoad: true,
  scrollDepthPx: 2400,
  expandSelectors: "",
};

export const WAIT_STRATEGY_OPTIONS: Array<{
  id: WaitStrategy;
  label: string;
  description: string;
}> = [
  {
    id: "dom",
    label: "DOM ready",
    description: "Fastest — wait until the HTML document is parsed",
  },
  {
    id: "load",
    label: "Full load",
    description: "Wait for the window load event",
  },
  {
    id: "networkidle",
    label: "Network idle",
    description: "Wait until network activity settles (good for APIs)",
  },
  {
    id: "stabilize",
    label: "Stabilize (recommended)",
    description: "Best for SPAs — idle network, content heuristics, soft settle",
  },
];

/** Soft organization tags for monitors (create + settings) */
export const MONITOR_CATEGORIES = [
  "Website Monitoring",
  "Competitor Intelligence",
  "Developer Monitoring",
  "SEO Monitoring",
  "Business Monitoring",
  "Other",
] as const;

export interface CategoryDefinition {
  id: (typeof MONITOR_CATEGORIES)[number];
  label: string;
  description: string;
  icon: LucideIcon;
  accent: "cyan" | "blue" | "violet" | "emerald" | "amber" | "rose" | "orange" | "sky";
}

export const MONITOR_CATEGORY_DEFS: CategoryDefinition[] = [
  {
    id: "Website Monitoring",
    label: "Website Monitoring",
    description: "Public pages, sections, text, images, and links",
    icon: Globe,
    accent: "cyan",
  },
  {
    id: "Competitor Intelligence",
    label: "Competitor Intelligence",
    description: "Pricing, features, products, landers, announcements",
    icon: Megaphone,
    accent: "amber",
  },
  {
    id: "Developer Monitoring",
    label: "Developer Monitoring",
    description: "Releases, docs, and API references",
    icon: Code,
    accent: "violet",
  },
  {
    id: "SEO Monitoring",
    label: "SEO Monitoring",
    description: "Titles, meta, headings, and content",
    icon: Sparkles,
    accent: "sky",
  },
  {
    id: "Business Monitoring",
    label: "Business Monitoring",
    description: "News, blogs, and public announcements",
    icon: Newspaper,
    accent: "rose",
  },
  {
    id: "Other",
    label: "Other",
    description: "General-purpose monitoring",
    icon: BookOpen,
    accent: "blue",
  },
];

export interface ModeDefinition {
  mode: MonitoringMode;
  label: string;
  description: string;
  icon: LucideIcon;
  requiresSelector?: boolean;
  requiresKeywords?: boolean;
  requiresAiPrompt?: boolean;
  recommended?: boolean;
  tooltip?: string;
  primary?: boolean;
  /** When false, hide from create/settings pickers (existing monitors still work). */
  selectable?: boolean;
}

/**
 * Engine modes available in product UX.
 * Marketplace / private-page oriented modes stay in the enum for existing monitors
 * but are not selectable for new setups.
 */
export const MONITORING_MODES: ModeDefinition[] = [
  {
    mode: "ENTIRE_PAGE",
    label: "Full Page Monitoring",
    description: "Monitor the entire page and detect important changes automatically.",
    tooltip: "Recommended for most users. Watches the whole page and filters noise.",
    icon: Globe,
    recommended: true,
    primary: true,
  },
  {
    mode: "CSS_SELECTOR",
    label: "Specific Section Monitoring",
    description: "Watch one section or element using a CSS selector.",
    tooltip: "Requires a CSS selector for the exact element.",
    icon: Code,
    requiresSelector: true,
    primary: true,
  },
  {
    mode: "TEXT_CHANGES",
    label: "Text Change Monitoring",
    description: "Focus on readable text updates and ignore most HTML noise.",
    tooltip: "Ideal for articles, announcements, and copy changes.",
    icon: Type,
    primary: true,
  },
  {
    mode: "VISUAL_CHANGES",
    label: "Image Change Monitoring",
    description: "Detect layout, design, and visual / image shifts.",
    tooltip: "Best when appearance or imagery matters more than text.",
    icon: Eye,
    primary: true,
  },
  {
    mode: "PRICE_DETECTION",
    label: "Pricing Page Monitoring",
    description: "Track price and plan wording on public company pricing pages.",
    tooltip: "For SaaS / company plan pages — not Amazon, eBay, or other marketplaces.",
    icon: Target,
    primary: true,
  },
  {
    mode: "DOCUMENTATION_CHANGES",
    label: "Documentation Monitoring",
    description: "Track docs, changelogs, and API reference pages.",
    tooltip: "Ideal for developer documentation.",
    icon: FileText,
    primary: true,
  },
  {
    mode: "AI_SMART",
    label: "AI Monitoring",
    description: "Describe what matters in plain language and let AI decide.",
    tooltip: "Write natural-language instructions for the AI.",
    icon: Brain,
    requiresAiPrompt: true,
    primary: true,
  },
  {
    mode: "KEYWORD_DETECTION",
    label: "Keyword Monitoring",
    description: "Alert when specific keywords appear or disappear.",
    tooltip: "Enter the words you want to watch for.",
    icon: Hash,
    requiresKeywords: true,
  },
  {
    mode: "API_RESPONSE",
    label: "API Monitoring",
    description: "Monitor JSON or XML API endpoint responses.",
    tooltip: "Point at a public API URL to detect response changes.",
    icon: Code,
  },
  {
    mode: "RSS_FEED",
    label: "RSS Feed",
    description: "Track new items in RSS/Atom feeds.",
    icon: Rss,
  },
  {
    mode: "XPATH",
    label: "XPath Selector",
    description: "Monitor a specific element by XPath.",
    icon: Search,
    requiresSelector: true,
  },
  {
    mode: "TABLE_DETECTION",
    label: "Table Monitoring",
    description: "Track changes in HTML tables.",
    icon: Table,
  },
  {
    mode: "HTML_DIFF",
    label: "HTML Diff",
    description: "Precise HTML structure comparison.",
    icon: Diff,
  },
  {
    mode: "SCREENSHOT_DIFF",
    label: "Screenshot Diff",
    description: "Visual pixel-level comparison.",
    icon: Image,
  },
  // Kept for existing monitors only — not offered in create UX
  {
    mode: "PRODUCT_AVAILABILITY",
    label: "Product Availability",
    description: "Detect in-stock / out-of-stock changes (legacy).",
    icon: Package,
    selectable: false,
  },
  {
    mode: "JOB_LISTINGS",
    label: "Job Listings",
    description: "Monitor career pages for new positions (legacy).",
    icon: Briefcase,
    selectable: false,
  },
];

export const CREATE_MONITORING_MODES: ModeDefinition[] = MONITORING_MODES.filter(
  (m) => m.primary && m.selectable !== false
);

export const PRIMARY_MONITORING_MODES = CREATE_MONITORING_MODES;
export const ADVANCED_MONITORING_MODES = MONITORING_MODES.filter(
  (m) => !m.primary && m.selectable !== false
);

/** Modes shown in settings pickers, plus current mode if legacy */
export function getSelectableMonitoringModes(
  currentMode?: MonitoringMode
): ModeDefinition[] {
  const selectable = MONITORING_MODES.filter((m) => m.selectable !== false);
  if (currentMode && !selectable.some((m) => m.mode === currentMode)) {
    const legacy = MONITORING_MODES.find((m) => m.mode === currentMode);
    if (legacy) return [...selectable, legacy];
  }
  return selectable;
}

export const CREATE_AI_PROMPT_EXAMPLES = [
  "Notify me when documentation or API examples change.",
  "Notify when the page title or headings change.",
  "Ignore advertisements and cookie banners.",
  "Ignore layout and styling-only changes.",
  "Notify when Terms of Service or Privacy Policy text changes.",
  "Notify only when important information changes.",
];

export const AI_PROMPT_EXAMPLES = [
  "Notify when documentation pages are updated.",
  "Notify when Terms of Service or Privacy Policy text changes.",
  "Ignore layout changes.",
  "Ignore advertisements.",
  "Notify when the page title or headings change.",
  "Notify only when important information changes.",
];

export function parseMonitorConfig(raw: unknown): MonitorConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MONITOR_CONFIG };
  return { ...DEFAULT_MONITOR_CONFIG, ...(raw as MonitorConfig) };
}
