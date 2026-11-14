/**
 * Shared positioning copy — real WatchFlowing capabilities only.
 * UI / marketing text source of truth (no backend behavior).
 */

export const ANTIBOT_DISCLAIMER =
  "WatchFlowing does not bypass protection on a site. If your own site blocks an automated check, verify the domain or install the site script.";

export const FULLY_SUPPORTED_SITES = [
  "Your homepage",
  "Your docs and help center",
  "Your pricing page",
  "Your blog and newsroom",
  "Your careers page",
  "Your changelog",
  "WordPress, Webflow, Wix, Squarespace sites you own",
] as const;

export const PARTIALLY_SUPPORTED_SITES = [
  "A Shopify store you operate",
  "A Notion page you published",
  "A Google Site you own",
  "A store you operate, when the page loads without a challenge",
] as const;

export const UNSUPPORTED_OR_UNSTABLE_SITES = [
  "A page on your site that asks for a login",
  "A challenge or CAPTCHA on your own site",
  "A page that stays empty until a bot check finishes",
] as const;

/** Landing + help: realistic monitoring scenarios */
export const REAL_USE_CASES = [
  { id: "text", label: "Your page text", description: "Wording changes on a page your company owns." },
  { id: "section", label: "One section", description: "A header, price, or block you choose." },
  { id: "docs", label: "Your docs", description: "Guides and API pages you publish." },
  { id: "news", label: "Your newsroom", description: "Posts and press updates on your site." },
  { id: "blog", label: "Your blog", description: "New or edited posts you published." },
  { id: "changelog", label: "Your changelog", description: "Release notes on your own product site." },
  { id: "corp", label: "Your homepage", description: "Home, about, and product pages you operate." },
  { id: "jobs", label: "Your careers page", description: "Roles you add or remove." },
  { id: "docs-public", label: "Your policies", description: "Terms, privacy, and notices you host." },
  { id: "pricing", label: "Your pricing page", description: "Plans and prices on your own site." },
  { id: "ai", label: "A plain explanation", description: "What changed on your site, and why it matters." },
] as const;

export const CANNOT_MONITOR_REASONS = [
  {
    label: "A login on your site",
    detail: "Add a page that loads without signing in. A private dashboard is not checked.",
  },
  {
    label: "A challenge on your site",
    detail: "If your site blocks the check, the last good snapshot stays. Verification and the site script do not bypass that.",
  },
  {
    label: "A page that never finishes loading",
    detail: "If the HTML stays empty until heavy scripts run, the check can be incomplete.",
  },
] as const;

export const POPULAR_MONITORING_EXAMPLES = [
  "Your homepage",
  "Your docs",
  "Your pricing page",
  "Your changelog",
  "Your blog",
  "Your careers page",
  "Your privacy policy",
] as const;

export const BEST_SUPPORTED_SUMMARY = [
  "Pages your company owns",
  "Your docs, blog, and changelog",
  "Your pricing and careers pages",
  "Sites you built on WordPress, Webflow, Wix, or Squarespace",
] as const;
