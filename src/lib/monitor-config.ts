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
  ignoreSelectors?: string;
  archived?: boolean;
  monitorTypeId?: string;
  minImportance?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  notificationFrequency?: "INSTANT" | "HOURLY" | "DAILY";
}

export const DEFAULT_MONITOR_CONFIG: Required<
  Omit<MonitorConfig, "monitorTypeId" | "ignoreSelectors">
> & { ignoreSelectors: string } = {
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
  recommended?: boolean;
  tooltip?: string;
  primary?: boolean;
}

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
    mode: "VISUAL_CHANGES",
    label: "Visual Changes Monitoring",
    description: "Detect layout, design, and visual structure shifts.",
    tooltip: "Best when appearance matters more than text.",
    icon: Eye,
    primary: true,
  },
  {
    mode: "TEXT_CHANGES",
    label: "Text Changes Monitoring",
    description: "Focus on readable text updates and ignore most HTML noise.",
    tooltip: "Ideal for articles, announcements, and copy changes.",
    icon: Type,
    primary: true,
  },
  {
    mode: "CSS_SELECTOR",
    label: "Specific Element Monitoring",
    description: "Watch one section or element using a CSS selector.",
    tooltip: "Requires a CSS selector for the exact element.",
    icon: Code,
    requiresSelector: true,
    primary: true,
  },
  {
    mode: "PRICE_DETECTION",
    label: "Price Monitoring",
    description: "Track price drops and increases on product pages.",
    tooltip: "Best for product and pricing pages.",
    icon: Target,
    primary: true,
  },
  {
    mode: "KEYWORD_DETECTION",
    label: "Keyword Monitoring",
    description: "Alert when specific keywords appear or disappear.",
    tooltip: "Enter the words you want to watch for.",
    icon: Hash,
    requiresKeywords: true,
    primary: true,
  },
  {
    mode: "API_RESPONSE",
    label: "API Monitoring",
    description: "Monitor JSON or XML API endpoint responses.",
    tooltip: "Point at an API URL to detect response changes.",
    icon: Code,
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
  { mode: "XPATH", label: "XPath Selector", description: "Monitor a specific element by XPath", icon: Search, requiresSelector: true },
  { mode: "TABLE_DETECTION", label: "Table Monitoring", description: "Track changes in HTML tables", icon: Table },
  { mode: "PRODUCT_AVAILABILITY", label: "Product Availability", description: "Detect in-stock / out-of-stock changes", icon: Package },
  { mode: "JOB_LISTINGS", label: "Job Listings", description: "Monitor career pages for new positions", icon: List },
  { mode: "DOCUMENTATION_CHANGES", label: "Documentation Changes", description: "Track docs, changelogs, and guides", icon: FileText },
  { mode: "RSS_FEED", label: "RSS Feed", description: "Track new items in RSS/Atom feeds", icon: Rss },
  { mode: "HTML_DIFF", label: "HTML Diff", description: "Precise HTML structure comparison", icon: Diff },
  { mode: "SCREENSHOT_DIFF", label: "Screenshot Diff", description: "Visual pixel-level comparison", icon: Image },
];

export const CREATE_MONITORING_MODES: ModeDefinition[] = MONITORING_MODES.filter((m) => m.primary);

export const PRIMARY_MONITORING_MODES = CREATE_MONITORING_MODES;
export const ADVANCED_MONITORING_MODES = MONITORING_MODES.filter((m) => !m.primary);

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
