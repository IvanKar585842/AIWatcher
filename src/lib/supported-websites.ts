/**
 * Shared positioning copy — real WatchFlowing capabilities only.
 * UI / marketing text source of truth (no backend behavior).
 */

export const ANTIBOT_DISCLAIMER =
  "Some websites use protection against automated requests. In those cases, monitoring may be limited or unavailable.";

export const FULLY_SUPPORTED_SITES = [
  "Most regular websites",
  "WordPress",
  "Webflow",
  "Wix",
  "Squarespace",
  "GitHub",
  "GitLab",
  "Wikipedia",
  "Government sites",
  "University sites",
  "News sites",
  "Corporate sites",
  "Documentation",
  "Blogs",
  "Public HTML pages",
] as const;

export const PARTIALLY_SUPPORTED_SITES = [
  "Shopify",
  "Notion public pages",
  "Google Sites",
] as const;

export const UNSUPPORTED_OR_UNSTABLE_SITES = [
  "Amazon",
  "eBay",
  "AliExpress",
  "Temu",
  "Most marketplaces",
  "CAPTCHA-protected sites",
  "Pages behind login",
  "Cloudflare Bot Protection",
  "DataDome",
  "Akamai Bot Manager",
  "Other strong anti-bot protections",
] as const;

/** Landing + help: realistic monitoring scenarios */
export const REAL_USE_CASES = [
  { id: "text", label: "Page text changes", description: "Detect wording updates on public pages." },
  { id: "section", label: "HTML section or element", description: "Watch a CSS/XPath target area." },
  { id: "docs", label: "Documentation", description: "Track docs, guides, and API references." },
  { id: "news", label: "News & press", description: "Catch new articles and press updates." },
  { id: "gov", label: "Government sites", description: "Monitor public agency announcements." },
  { id: "uni", label: "University sites", description: "Follow aid, admissions, and campus updates." },
  { id: "blog", label: "Blogs", description: "See new or edited posts." },
  { id: "changelog", label: "Changelogs", description: "Watch product and release notes." },
  { id: "github", label: "GitHub README & Releases", description: "Track public repo release pages." },
  { id: "corp", label: "Corporate websites", description: "Homepage, about, and product pages." },
  { id: "jobs", label: "Job listings", description: "New roles and career page updates." },
  { id: "docs-public", label: "Public documents", description: "Policies, PDFs pages, and notices." },
  { id: "pricing", label: "Public pricing pages", description: "SaaS / company plan pages — not marketplaces." },
  { id: "tos", label: "Terms of use", description: "Legal page revisions." },
  { id: "privacy", label: "Privacy policies", description: "Policy wording changes." },
  { id: "schedule", label: "Schedules", description: "Timetables and calendar pages." },
  { id: "results", label: "Results & announcements", description: "Public boards and result pages." },
  { id: "ai", label: "AI change analysis", description: "Summaries of what changed and why it matters." },
] as const;

export const CANNOT_MONITOR_REASONS = [
  {
    label: "Marketplaces",
    detail: "Amazon, eBay, AliExpress, Temu and similar often block automated checks.",
  },
  {
    label: "Strong anti-bot protection",
    detail: "Cloudflare Bot Protection, DataDome, Akamai Bot Manager, and similar.",
  },
  {
    label: "Login & CAPTCHA pages",
    detail: "Private dashboards and CAPTCHA walls are not supported.",
  },
  {
    label: "Heavy client-only apps",
    detail: "Pages that only appear after complex JavaScript may be unreliable.",
  },
] as const;

export const POPULAR_MONITORING_EXAMPLES = [
  "Government updates",
  "Documentation",
  "Company news",
  "GitHub projects",
  "Public announcements",
  "Job listings",
  "University updates",
] as const;

export const BEST_SUPPORTED_SUMMARY = [
  "Corporate & government sites",
  "Docs, blogs & news",
  "GitHub / GitLab / Wikipedia",
  "WordPress, Webflow, Wix, Squarespace",
  "University & public HTML pages",
] as const;
