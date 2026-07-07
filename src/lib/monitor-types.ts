import type { MonitoringMode } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRightLeft,
  AtSign,
  BadgePercent,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Code,
  Cookie,
  Download,
  Eye,
  FileText,
  FormInput,
  Globe,
  GraduationCap,
  Hash,
  Image,
  Landmark,
  Layers,
  Lock,
  Mail,
  Megaphone,
  MousePointerClick,
  Newspaper,
  Package,
  Phone,
  Rss,
  Scale,
  Search,
  Server,
  Share2,
  Shield,
  ShoppingCart,
  Sparkles,
  Table,
  Target,
  Timer,
  Type,
  Zap,
} from "lucide-react";

export type MonitorTypeCategory =
  | "General"
  | "Visual"
  | "Content"
  | "E-commerce"
  | "Jobs & Education"
  | "Technical"
  | "Legal & Compliance"
  | "SEO & Meta"
  | "AI";

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
  requiresSelector?: boolean;
  requiresKeywords?: boolean;
  requiresAiPrompt?: boolean;
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
  "General",
  "Visual",
  "Content",
  "E-commerce",
  "Jobs & Education",
  "Technical",
  "Legal & Compliance",
  "SEO & Meta",
  "AI",
];

export const MONITOR_TYPE_CATALOG: MonitorTypeDefinition[] = [
  { id: "entire-website", label: "Entire Website", description: "Watch the full page for any meaningful change", icon: Globe, category: "General", accent: "cyan", mode: "ENTIRE_PAGE" },
  { id: "ai-smart", label: "AI Smart Monitoring", description: "Describe what matters in plain language", icon: Brain, category: "AI", accent: "violet", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "visual-changes", label: "Visual Changes", description: "Detect layout and visual structure shifts", icon: Eye, category: "Visual", accent: "blue", mode: "VISUAL_CHANGES" },
  { id: "screenshot-comparison", label: "Screenshot Comparison", description: "Pixel-level visual diff between captures", icon: Image, category: "Visual", accent: "sky", mode: "SCREENSHOT_DIFF" },
  { id: "html-changes", label: "HTML Changes", description: "Precise HTML structure comparison", icon: Code, category: "Visual", accent: "cyan", mode: "HTML_DIFF" },
  { id: "text-changes", label: "Text Changes", description: "Focus on textual content updates only", icon: Type, category: "Content", accent: "cyan", mode: "TEXT_CHANGES" },
  { id: "specific-section", label: "Specific Section", description: "Monitor one section by CSS selector", icon: Layers, category: "Content", accent: "blue", mode: "CSS_SELECTOR", requiresSelector: true },
  { id: "css-selector", label: "CSS Selector", description: "Target any element with a CSS selector", icon: MousePointerClick, category: "Content", accent: "cyan", mode: "CSS_SELECTOR", requiresSelector: true },
  { id: "xpath", label: "XPath", description: "Target elements using XPath expressions", icon: Search, category: "Content", accent: "violet", mode: "XPATH", requiresSelector: true },
  { id: "price-tracking", label: "Price Tracking", description: "Track price drops and increases", icon: Target, category: "E-commerce", accent: "emerald", mode: "PRICE_DETECTION" },
  { id: "discount-tracking", label: "Discount Tracking", description: "Alert when sales or discounts appear", icon: BadgePercent, category: "E-commerce", accent: "amber", mode: "PRICE_DETECTION" },
  { id: "stock-availability", label: "Stock Availability", description: "Detect in-stock and out-of-stock changes", icon: Package, category: "E-commerce", accent: "emerald", mode: "PRODUCT_AVAILABILITY" },
  { id: "product-availability", label: "Product Availability", description: "Know when products become purchasable", icon: ShoppingCart, category: "E-commerce", accent: "cyan", mode: "PRODUCT_AVAILABILITY" },
  { id: "keyword-detection", label: "Keyword Detection", description: "Alert when specific keywords appear", icon: Hash, category: "Content", accent: "amber", mode: "KEYWORD_DETECTION", requiresKeywords: true },
  { id: "table-changes", label: "Table Changes", description: "Track rows and cells in HTML tables", icon: Table, category: "Content", accent: "blue", mode: "TABLE_DETECTION" },
  { id: "news-detection", label: "News Detection", description: "Catch breaking news and headline updates", icon: Newspaper, category: "Content", accent: "rose", mode: "TEXT_CHANGES" },
  { id: "blog-updates", label: "Blog Updates", description: "Monitor blog posts and article feeds", icon: BookOpen, category: "Content", accent: "violet", mode: "TEXT_CHANGES" },
  { id: "documentation-updates", label: "Documentation Updates", description: "Track docs, changelogs, and guides", icon: FileText, category: "Content", accent: "sky", mode: "DOCUMENTATION_CHANGES" },
  { id: "api-response", label: "API Response Monitoring", description: "Watch JSON or XML API endpoint responses", icon: Server, category: "Technical", accent: "cyan", mode: "API_RESPONSE" },
  { id: "rss-feed", label: "RSS Feed", description: "Track new items in RSS and Atom feeds", icon: Rss, category: "Content", accent: "orange", mode: "RSS_FEED" },
  { id: "job-listings", label: "Job Listings", description: "Monitor career pages for new positions", icon: Briefcase, category: "Jobs & Education", accent: "blue", mode: "JOB_LISTINGS" },
  { id: "scholarships", label: "Scholarships", description: "Track scholarship deadlines and eligibility", icon: GraduationCap, category: "Jobs & Education", accent: "emerald", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "university-admissions", label: "University Admissions", description: "Watch admission requirements and dates", icon: Building2, category: "Jobs & Education", accent: "violet", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "government-changes", label: "Government Website Changes", description: "Monitor official portals and announcements", icon: Landmark, category: "Legal & Compliance", accent: "sky", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "legal-document-changes", label: "Legal Document Changes", description: "Track contracts, policies, and legal text", icon: Scale, category: "Legal & Compliance", accent: "rose", mode: "DOCUMENTATION_CHANGES" },
  { id: "competitor-monitoring", label: "Competitor Monitoring", description: "Watch competitor pages for strategic shifts", icon: Megaphone, category: "General", accent: "amber", mode: "ENTIRE_PAGE" },
  { id: "seo-metadata", label: "SEO Metadata Changes", description: "Detect SEO-related tag and meta updates", icon: Sparkles, category: "SEO & Meta", accent: "violet", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "title-changes", label: "Title Changes", description: "Alert when the page title changes", icon: Type, category: "SEO & Meta", accent: "cyan", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "meta-description", label: "Meta Description Changes", description: "Track meta description updates", icon: FileText, category: "SEO & Meta", accent: "blue", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "opengraph-changes", label: "OpenGraph Changes", description: "Monitor social preview metadata", icon: Share2, category: "SEO & Meta", accent: "sky", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "download-links", label: "Download Links", description: "Track new or changed download URLs", icon: Download, category: "Content", accent: "amber", mode: "KEYWORD_DETECTION", requiresKeywords: true },
  { id: "pdf-changes", label: "PDF Changes", description: "Detect when linked PDFs are updated", icon: FileText, category: "Content", accent: "rose", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "image-changes", label: "Image Changes", description: "Spot new or replaced images on the page", icon: Image, category: "Visual", accent: "violet", mode: "VISUAL_CHANGES" },
  { id: "form-changes", label: "Form Changes", description: "Monitor form fields and structure", icon: FormInput, category: "Content", accent: "cyan", mode: "CSS_SELECTOR", requiresSelector: true },
  { id: "button-changes", label: "Button Changes", description: "Track CTA and button label changes", icon: MousePointerClick, category: "Content", accent: "blue", mode: "CSS_SELECTOR", requiresSelector: true },
  { id: "contact-information", label: "Contact Information", description: "Watch addresses and contact blocks", icon: Mail, category: "Content", accent: "emerald", mode: "TEXT_CHANGES" },
  { id: "email-changes", label: "Email Changes", description: "Alert when email addresses change", icon: AtSign, category: "Content", accent: "sky", mode: "KEYWORD_DETECTION", requiresKeywords: true },
  { id: "phone-changes", label: "Phone Number Changes", description: "Track phone number updates", icon: Phone, category: "Content", accent: "cyan", mode: "KEYWORD_DETECTION", requiresKeywords: true },
  { id: "social-media-links", label: "Social Media Links", description: "Monitor social profile URL changes", icon: Share2, category: "Content", accent: "violet", mode: "KEYWORD_DETECTION", requiresKeywords: true },
  { id: "cookie-policy", label: "Cookie Policy", description: "Track cookie policy text changes", icon: Cookie, category: "Legal & Compliance", accent: "amber", mode: "DOCUMENTATION_CHANGES" },
  { id: "privacy-policy", label: "Privacy Policy", description: "Monitor privacy policy updates", icon: Shield, category: "Legal & Compliance", accent: "blue", mode: "DOCUMENTATION_CHANGES" },
  { id: "terms-of-service", label: "Terms of Service", description: "Watch terms and conditions changes", icon: Scale, category: "Legal & Compliance", accent: "rose", mode: "DOCUMENTATION_CHANGES" },
  { id: "custom-javascript", label: "Custom JavaScript Detection", description: "Use AI to interpret custom page behavior", icon: Code, category: "Technical", accent: "violet", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "redirect-detection", label: "Redirect Detection", description: "Detect unexpected URL redirects", icon: ArrowRightLeft, category: "Technical", accent: "orange", mode: "API_RESPONSE" },
  { id: "status-code", label: "Status Code Monitoring", description: "Alert on HTTP status code changes", icon: Activity, category: "Technical", accent: "rose", mode: "API_RESPONSE" },
  { id: "ssl-certificate", label: "SSL Certificate", description: "Monitor certificate expiry and changes", icon: Lock, category: "Technical", accent: "emerald", mode: "API_RESPONSE" },
  { id: "dns-changes", label: "DNS Changes", description: "Track DNS-related endpoint responses", icon: Globe, category: "Technical", accent: "sky", mode: "API_RESPONSE" },
  { id: "performance", label: "Performance Monitoring", description: "Watch page performance metrics shifts", icon: Zap, category: "Technical", accent: "amber", mode: "AI_SMART", requiresAiPrompt: true },
  { id: "response-time", label: "Response Time", description: "Alert when response time degrades", icon: Timer, category: "Technical", accent: "cyan", mode: "API_RESPONSE" },
  { id: "uptime", label: "Uptime", description: "Know immediately when a site goes down", icon: Activity, category: "Technical", accent: "emerald", mode: "API_RESPONSE" },
  { id: "custom-ai-prompt", label: "Custom AI Prompt", description: "Full control with a custom AI instruction", icon: Brain, category: "AI", accent: "violet", mode: "AI_SMART", requiresAiPrompt: true },
];

export function getMonitorTypeById(id: string): MonitorTypeDefinition | undefined {
  return MONITOR_TYPE_CATALOG.find((t) => t.id === id);
}

export function getMonitorTypesByCategory(category: MonitorTypeCategory | "All"): MonitorTypeDefinition[] {
  if (category === "All") return MONITOR_TYPE_CATALOG;
  return MONITOR_TYPE_CATALOG.filter((t) => t.category === category);
}
