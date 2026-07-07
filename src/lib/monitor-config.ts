import type { MonitoringMode } from "@prisma/client";
import {
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Code,
  Diff,
  Eye,
  FileText,
  Globe,
  GraduationCap,
  Hash,
  Image,
  Landmark,
  List,
  Newspaper,
  Package,
  Rss,
  Search,
  ShoppingCart,
  Table,
  Tag,
  Target,
  Type,
  type LucideIcon,
} from "lucide-react";

export interface MonitorConfig {
  retryAttempts?: number;
  timeout?: number;
  ignoreCookies?: boolean;
  ignoreTimestamps?: boolean;
  ignoreAds?: boolean;
  ignoreRandomIds?: boolean;
  ignoreDynamicContent?: boolean;
  archived?: boolean;
}

export const DEFAULT_MONITOR_CONFIG: Required<MonitorConfig> = {
  retryAttempts: 3,
  timeout: 30000,
  ignoreCookies: true,
  ignoreTimestamps: true,
  ignoreAds: true,
  ignoreRandomIds: true,
  ignoreDynamicContent: true,
  archived: false,
};

export const MONITOR_CATEGORIES = [
  "E-commerce",
  "Jobs & Careers",
  "News & Media",
  "Documentation",
  "Pricing",
  "Government",
  "Education",
  "Scholarships",
  "Products",
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
  { id: "E-commerce", label: "E-commerce", description: "Prices, stock, and product pages", icon: ShoppingCart, accent: "emerald" },
  { id: "Jobs & Careers", label: "Jobs & Careers", description: "Hiring pages and role listings", icon: Briefcase, accent: "blue" },
  { id: "News & Media", label: "News & Media", description: "Headlines, articles, and feeds", icon: Newspaper, accent: "rose" },
  { id: "Documentation", label: "Documentation", description: "Docs, APIs, and changelogs", icon: BookOpen, accent: "sky" },
  { id: "Pricing", label: "Pricing", description: "Plans, tiers, and billing pages", icon: Tag, accent: "amber" },
  { id: "Government", label: "Government", description: "Official portals and regulations", icon: Landmark, accent: "cyan" },
  { id: "Education", label: "Education", description: "Courses, admissions, and programs", icon: Building2, accent: "violet" },
  { id: "Scholarships", label: "Scholarships", description: "Grants, deadlines, and eligibility", icon: GraduationCap, accent: "emerald" },
  { id: "Products", label: "Products", description: "SaaS, hardware, and launches", icon: Package, accent: "orange" },
  { id: "Other", label: "Other", description: "General-purpose monitoring", icon: Globe, accent: "cyan" },
];

export interface ModeDefinition {
  mode: MonitoringMode;
  label: string;
  description: string;
  icon: LucideIcon;
  requiresSelector?: boolean;
  requiresKeywords?: boolean;
  requiresAiPrompt?: boolean;
}

export const MONITORING_MODES: ModeDefinition[] = [
  { mode: "ENTIRE_PAGE", label: "Entire Website", description: "Monitor the full page for any changes", icon: Globe },
  { mode: "VISUAL_CHANGES", label: "Visual Changes", description: "Detect layout and visual structure changes", icon: Eye },
  { mode: "TEXT_CHANGES", label: "Text Changes", description: "Focus on textual content changes only", icon: Type },
  { mode: "PRICE_DETECTION", label: "Price Tracking", description: "Track price drops and increases", icon: Target },
  { mode: "KEYWORD_DETECTION", label: "Keyword Tracking", description: "Alert when specific keywords appear", icon: Hash },
  { mode: "CSS_SELECTOR", label: "CSS Selector", description: "Monitor a specific element by CSS selector", icon: Code, requiresSelector: true },
  { mode: "XPATH", label: "XPath Selector", description: "Monitor a specific element by XPath", icon: Search, requiresSelector: true },
  { mode: "TABLE_DETECTION", label: "Table Monitoring", description: "Track changes in HTML tables", icon: Table },
  { mode: "PRODUCT_AVAILABILITY", label: "Product Availability", description: "Detect in-stock / out-of-stock changes", icon: Package },
  { mode: "JOB_LISTINGS", label: "Job Listings", description: "Monitor career pages for new positions", icon: List },
  { mode: "DOCUMENTATION_CHANGES", label: "Documentation Changes", description: "Track docs, changelogs, and guides", icon: FileText },
  { mode: "API_RESPONSE", label: "API Response Monitoring", description: "Monitor JSON/XML API endpoint responses", icon: Code },
  { mode: "RSS_FEED", label: "RSS Feed", description: "Track new items in RSS/Atom feeds", icon: Rss },
  { mode: "HTML_DIFF", label: "HTML Diff", description: "Precise HTML structure comparison", icon: Diff },
  { mode: "SCREENSHOT_DIFF", label: "Screenshot Diff", description: "Visual pixel-level comparison", icon: Image },
  { mode: "AI_SMART", label: "AI Smart Monitoring", description: "Natural language instructions for the AI", icon: Brain, requiresAiPrompt: true },
];

export const CREATE_MONITORING_MODES: ModeDefinition[] = MONITORING_MODES.filter((m) =>
  [
    "ENTIRE_PAGE",
    "TEXT_CHANGES",
    "VISUAL_CHANGES",
    "PRICE_DETECTION",
    "KEYWORD_DETECTION",
    "CSS_SELECTOR",
    "XPATH",
    "TABLE_DETECTION",
    "JOB_LISTINGS",
    "PRODUCT_AVAILABILITY",
    "RSS_FEED",
    "API_RESPONSE",
    "HTML_DIFF",
    "SCREENSHOT_DIFF",
    "AI_SMART",
  ].includes(m.mode)
).map((m) =>
  m.mode === "API_RESPONSE" ? { ...m, label: "API Monitoring" } : m
);

export const CREATE_AI_PROMPT_EXAMPLES = [
  "Notify me only when the price drops below €700.",
  "Ignore advertisements.",
  "Ignore layout changes.",
  "Notify only if scholarship information changes.",
  "Notify when a new Frontend Developer job appears.",
  "Notify when RTX 5090 becomes available.",
  "Notify only when important information changes.",
];

export const AI_PROMPT_EXAMPLES = [
  "Notify me only if the price drops below €700.",
  "Notify when a new Frontend Developer job appears.",
  "Ignore layout changes.",
  "Ignore advertisements.",
  "Only notify if scholarship information changes.",
  "Notify when product becomes available.",
];

export function parseMonitorConfig(raw: unknown): MonitorConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MONITOR_CONFIG };
  return { ...DEFAULT_MONITOR_CONFIG, ...(raw as MonitorConfig) };
}
