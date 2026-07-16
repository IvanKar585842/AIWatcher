import type { MetadataRoute } from "next";
import { SITEMAP_BASE_URL } from "@/lib/public-sitemap";

/**
 * robots.txt for Google Search Console.
 * Sitemap is always the production canonical URL.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Authenticated app
          "/dashboard",
          "/dashboard/",
          "/admin",
          "/admin/",
          // APIs (not for indexing)
          "/api",
          "/api/",
          // Auth UI (noindex) + private tokenized shares
          "/sign-in",
          "/sign-in/",
          "/report/",
          "/score/",
        ],
      },
    ],
    sitemap: "https://watchflowing.com/sitemap.xml",
    host: SITEMAP_BASE_URL,
  };
}
