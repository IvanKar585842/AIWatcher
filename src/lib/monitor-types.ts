import type { MonitoringMode } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Code2,
  Eye,
  FileText,
  GitBranch,
  Globe,
  Heading,
  Image,
  Layers,
  Link2,
  Megaphone,
  Newspaper,
  Package,
  Search,
  Sparkles,
  Target,
  Type,
} from "lucide-react";

export type MonitorTypeCategory =
  | "Website Monitoring"
  | "Competitor Intelligence"
  | "Developer Monitoring"
  | "SEO Monitoring"
  | "Business Monitoring";

export type AccentColor =
  | "cyan"
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "orange"
  | "sky";

export interface MonitorTypeDefinition {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: MonitorTypeCategory;
  accent: AccentColor;
  mode: MonitoringMode;
  /** Short concrete example shown in the create UI */
  exampleUsage: string;
  /** Who this option is best for */
  recommendedUsers: string;
  requiresSelector?: boolean;
  requiresKeywords?: boolean;
  requiresAiPrompt?: boolean;
  /** Prefill AI prompt when this type is selected */
  defaultAiPrompt?: string;
  recommended?: boolean;
  tooltip?: string;
}

export const ACCENT_STYLES: Record<
  AccentColor,
  { border: string; bg: string; text: string; glow: string }
> = {
  cyan: {
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    text: "text-cyan-300",
    glow: "shadow-[0_0_24px_-8px_rgba(34,211,238,0.45)]",
  },
  blue: {
    border: "border-blue-500/40",
    bg: "bg-blue-500/10",
    text: "text-blue-300",
    glow: "shadow-[0_0_24px_-8px_rgba(59,130,246,0.45)]",
  },
  violet: {
    border: "border-violet-500/40",
    bg: "bg-violet-500/10",
    text: "text-violet-300",
    glow: "shadow-[0_0_24px_-8px_rgba(139,92,246,0.45)]",
  },
  emerald: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    glow: "shadow-[0_0_24px_-8px_rgba(16,185,129,0.45)]",
  },
  amber: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    glow: "shadow-[0_0_24px_-8px_rgba(245,158,11,0.45)]",
  },
  rose: {
    border: "border-rose-500/40",
    bg: "bg-rose-500/10",
    text: "text-rose-300",
    glow: "shadow-[0_0_24px_-8px_rgba(244,63,94,0.45)]",
  },
  orange: {
    border: "border-orange-500/40",
    bg: "bg-orange-500/10",
    text: "text-orange-300",
    glow: "shadow-[0_0_24px_-8px_rgba(249,115,22,0.45)]",
  },
  sky: {
    border: "border-sky-500/40",
    bg: "bg-sky-500/10",
    text: "text-sky-300",
    glow: "shadow-[0_0_24px_-8px_rgba(14,165,233,0.45)]",
  },
};

export const MONITOR_TYPE_CATEGORIES: MonitorTypeCategory[] = [
  "Website Monitoring",
  "Competitor Intelligence",
  "Developer Monitoring",
  "SEO Monitoring",
  "Business Monitoring",
];

/** Recommended create-flow options — Website Monitoring first */
export const PRIMARY_MONITOR_TYPE_IDS = [
  "full-page",
  "specific-section",
  "text-changes",
  "image-changes",
  "link-changes",
] as const;

export const MONITOR_TYPE_CATALOG: MonitorTypeDefinition[] = [
  // —— Website Monitoring ——
  {
    id: "full-page",
    label: "Full Page Monitoring",
    description: "Watch the whole public page and surface meaningful changes automatically.",
    exampleUsage: "https://example.com/docs or /news",
    recommendedUsers: "Founders, marketers, site owners",
    tooltip: "Best default. Works on most public pages without selectors — not marketplaces.",
    icon: Globe,
    category: "Website Monitoring",
    accent: "cyan",
    mode: "ENTIRE_PAGE",
    recommended: true,
  },
  {
    id: "specific-section",
    label: "Specific Section Monitoring",
    description: "Track one block or element with a CSS selector.",
    exampleUsage: "main .announcements or #release-notes",
    recommendedUsers: "Operators watching a single widget or module",
    tooltip: "Paste a CSS selector for the exact section you care about.",
    icon: Layers,
    category: "Website Monitoring",
    accent: "blue",
    mode: "CSS_SELECTOR",
    requiresSelector: true,
  },
  {
    id: "text-changes",
    label: "Text Change Monitoring",
    description: "Focus on readable copy updates and ignore most HTML noise.",
    exampleUsage: "Blog posts, help articles, policy pages",
    recommendedUsers: "Content and communications teams",
    tooltip: "Ideal when wording matters more than layout.",
    icon: Type,
    category: "Website Monitoring",
    accent: "cyan",
    mode: "TEXT_CHANGES",
  },
  {
    id: "image-changes",
    label: "Image Change Monitoring",
    description: "Detect visual and image shifts such as banners, heroes, and media swaps.",
    exampleUsage: "Homepage hero, campaign banners, gallery pages",
    recommendedUsers: "Design and brand teams",
    tooltip: "Use when visual appearance is the signal.",
    icon: Image,
    category: "Website Monitoring",
    accent: "violet",
    mode: "VISUAL_CHANGES",
  },
  {
    id: "link-changes",
    label: "Link Change Monitoring",
    description: "Alert when important links, navigation, or destinations change.",
    exampleUsage: "Footer links, CTA destinations, download URLs",
    recommendedUsers: "SEO, growth, and web ops teams",
    tooltip: "AI focuses on href and navigation changes.",
    icon: Link2,
    category: "Website Monitoring",
    accent: "sky",
    mode: "AI_SMART",
    requiresAiPrompt: true,
    defaultAiPrompt:
      "Notify me when important links, navigation items, or href destinations change. Ignore cosmetic layout shifts.",
  },

  // —— Competitor Intelligence ——
  {
    id: "competitor-pricing",
    label: "Pricing Page",
    description: "Monitor a company’s public pricing or plans page for wording updates.",
    exampleUsage: "company.com/pricing (SaaS plans — not marketplaces)",
    recommendedUsers: "Product, sales, and pricing teams",
    tooltip: "For public plan pages. Amazon, eBay, and similar marketplaces are often blocked.",
    icon: Target,
    category: "Competitor Intelligence",
    accent: "emerald",
    mode: "PRICE_DETECTION",
  },
  {
    id: "competitor-features",
    label: "Features Page",
    description: "Watch feature lists and capability pages for competitive moves.",
    exampleUsage: "competitor.com/features",
    recommendedUsers: "Product managers and competitive intel",
    icon: Sparkles,
    category: "Competitor Intelligence",
    accent: "violet",
    mode: "TEXT_CHANGES",
  },
  {
    id: "competitor-product",
    label: "Product Page",
    description: "Track public product pages for positioning and messaging changes.",
    exampleUsage: "company.com/product/… (public marketing pages)",
    recommendedUsers: "Product marketing and founders",
    icon: Package,
    category: "Competitor Intelligence",
    accent: "amber",
    mode: "ENTIRE_PAGE",
  },
  {
    id: "competitor-landing",
    label: "Landing Page",
    description: "Detect messaging and offer changes on competitor landing pages.",
    exampleUsage: "competitor.com/ or campaign landers",
    recommendedUsers: "Growth and marketing teams",
    icon: Megaphone,
    category: "Competitor Intelligence",
    accent: "orange",
    mode: "ENTIRE_PAGE",
  },
  {
    id: "competitor-announcements",
    label: "Announcements",
    description: "Catch new competitor announcements, launches, and press updates.",
    exampleUsage: "competitor.com/blog or /news",
    recommendedUsers: "Strategy and competitive intel",
    icon: Newspaper,
    category: "Competitor Intelligence",
    accent: "rose",
    mode: "TEXT_CHANGES",
  },

  // —— Developer Monitoring ——
  {
    id: "github-releases",
    label: "GitHub Releases",
    description: "Monitor release pages or feeds for new versions and notes.",
    exampleUsage: "github.com/org/repo/releases",
    recommendedUsers: "Engineers and DevRel teams",
    icon: GitBranch,
    category: "Developer Monitoring",
    accent: "violet",
    mode: "TEXT_CHANGES",
  },
  {
    id: "documentation-updates",
    label: "Documentation Updates",
    description: "Track public docs, guides, and changelog pages.",
    exampleUsage: "docs.example.com/getting-started",
    recommendedUsers: "Developers and technical writers",
    icon: BookOpen,
    category: "Developer Monitoring",
    accent: "sky",
    mode: "DOCUMENTATION_CHANGES",
  },
  {
    id: "api-documentation",
    label: "API Documentation",
    description: "Watch public API reference pages for endpoint or schema changes.",
    exampleUsage: "docs.example.com/api or OpenAPI hubs",
    recommendedUsers: "API consumers and platform teams",
    icon: Code2,
    category: "Developer Monitoring",
    accent: "cyan",
    mode: "DOCUMENTATION_CHANGES",
  },

  // —— SEO Monitoring ——
  {
    id: "seo-title",
    label: "Title Changes",
    description: "Alert when the page title (or title tag content) changes.",
    exampleUsage: "Homepage and key landing URLs",
    recommendedUsers: "SEO specialists and content owners",
    icon: Type,
    category: "SEO Monitoring",
    accent: "cyan",
    mode: "AI_SMART",
    requiresAiPrompt: true,
    defaultAiPrompt:
      "Notify me only when the page title or <title> content changes in a meaningful way.",
  },
  {
    id: "seo-meta-description",
    label: "Meta Description Changes",
    description: "Track updates to meta description and related SEO snippets.",
    exampleUsage: "High-traffic marketing pages",
    recommendedUsers: "SEO and content teams",
    icon: FileText,
    category: "SEO Monitoring",
    accent: "blue",
    mode: "AI_SMART",
    requiresAiPrompt: true,
    defaultAiPrompt:
      "Notify me when the meta description or search snippet text changes. Ignore unrelated body copy.",
  },
  {
    id: "seo-headings",
    label: "Heading Changes",
    description: "Detect H1–H3 and outline structure changes that affect SEO.",
    exampleUsage: "Category and article pages",
    recommendedUsers: "SEO specialists",
    icon: Heading,
    category: "SEO Monitoring",
    accent: "violet",
    mode: "AI_SMART",
    requiresAiPrompt: true,
    defaultAiPrompt:
      "Notify me when H1, H2, or H3 headings change. Ignore navigation chrome and footer text.",
  },
  {
    id: "seo-content",
    label: "Content Changes",
    description: "Monitor primary on-page content for SEO-relevant rewrites.",
    exampleUsage: "Pillar pages and service descriptions",
    recommendedUsers: "SEO, content, and editorial teams",
    icon: Search,
    category: "SEO Monitoring",
    accent: "emerald",
    mode: "TEXT_CHANGES",
  },

  // —— Business Monitoring ——
  {
    id: "business-news",
    label: "News Pages",
    description: "Watch public news rooms and press pages for new stories.",
    exampleUsage: "company.com/news or /press",
    recommendedUsers: "PR, comms, and executives",
    icon: Newspaper,
    category: "Business Monitoring",
    accent: "rose",
    mode: "TEXT_CHANGES",
  },
  {
    id: "business-blog",
    label: "Blog Updates",
    description: "Detect new or updated public blog posts.",
    exampleUsage: "company.com/blog",
    recommendedUsers: "Content marketers and analysts",
    icon: BookOpen,
    category: "Business Monitoring",
    accent: "violet",
    mode: "TEXT_CHANGES",
  },
  {
    id: "business-announcements",
    label: "Public Announcements",
    description: "Track official announcement pages for company or product news.",
    exampleUsage: "company.com/announcements",
    recommendedUsers: "Business ops, founders, and partners",
    icon: Megaphone,
    category: "Business Monitoring",
    accent: "amber",
    mode: "TEXT_CHANGES",
  },
];

export function getPrimaryMonitorTypes(): MonitorTypeDefinition[] {
  return PRIMARY_MONITOR_TYPE_IDS.map(
    (id) => MONITOR_TYPE_CATALOG.find((t) => t.id === id)!
  ).filter(Boolean);
}

export function getAdvancedMonitorTypes(): MonitorTypeDefinition[] {
  const primary = new Set<string>(PRIMARY_MONITOR_TYPE_IDS);
  return MONITOR_TYPE_CATALOG.filter((t) => !primary.has(t.id));
}

export function getMonitorTypeById(id: string): MonitorTypeDefinition | undefined {
  return MONITOR_TYPE_CATALOG.find((t) => t.id === id);
}

export function getMonitorTypesByCategory(
  category: MonitorTypeCategory | "All"
): MonitorTypeDefinition[] {
  if (category === "All") return MONITOR_TYPE_CATALOG;
  return MONITOR_TYPE_CATALOG.filter((t) => t.category === category);
}

/** Hosts / patterns that commonly block automated monitoring */
const PROTECTED_HOST_PATTERNS = [
  /(^|\.)amazon\./i,
  /(^|\.)amzn\./i,
  /(^|\.)ebay\./i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)fb\.com$/i,
  /(^|\.)fbcdn\.net$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)linkedin\.com$/i,
  /(^|\.)threads\.net$/i,
  /(^|\.)snapchat\.com$/i,
  /(^|\.)pinterest\.com$/i,
  /(^|\.)reddit\.com$/i,
  /(^|\.)walmart\.com$/i,
  /(^|\.)aliexpress\./i,
  /(^|\.)alibaba\./i,
  /(^|\.)temu\.com$/i,
];

const PRIVATE_PATH_HINT =
  /\/(login|signin|sign-in|signup|sign-up|account|dashboard|app|portal|auth|oauth|checkout|cart)(\/|$)/i;

export const PROTECTED_SITE_WARNING =
  "This website may use anti-bot protection. Monitoring can be limited or unavailable — WatchFlowing works best on public HTML pages (docs, news, government, corporate sites), not marketplaces.";

/**
 * Returns a user-facing warning when the URL looks like a protected /
 * marketplace / social / private page. Does not block creation.
 */
export function getProtectedSiteWarning(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, "");
  if (PROTECTED_HOST_PATTERNS.some((re) => re.test(host))) {
    return PROTECTED_SITE_WARNING;
  }
  if (PRIVATE_PATH_HINT.test(parsed.pathname)) {
    return PROTECTED_SITE_WARNING;
  }
  return null;
}
