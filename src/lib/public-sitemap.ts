import type { MetadataRoute } from "next";
import { CANONICAL_APP_URL } from "@/lib/app-url";

/**
 * Canonical origin for SEO artifacts (sitemap.xml / robots.txt).
 * Always the production brand domain — never localhost or Vercel aliases.
 */
export const SITEMAP_BASE_URL = CANONICAL_APP_URL;

/**
 * Static public pages that should appear in Google Search Console.
 * Add new marketing / public routes here — sitemap.ts picks them up automatically.
 *
 * Do NOT include:
 * - /dashboard, /dashboard/*
 * - /admin, /api/*
 * - Tokenized private shares (/report/[token], /score/[token])
 * - Auth pages marked noindex (e.g. /sign-in)
 */
export const PUBLIC_SITEMAP_ROUTES: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/score", changeFrequency: "weekly", priority: 0.9 },
  { path: "/sign-up", changeFrequency: "monthly", priority: 0.7 },
  { path: "/monitored-by", changeFrequency: "weekly", priority: 0.6 },
];

export function absoluteSitemapUrl(path: string): string {
  if (path === "/" || path === "") return SITEMAP_BASE_URL;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITEMAP_BASE_URL}${normalized}`;
}
