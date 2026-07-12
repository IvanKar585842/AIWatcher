import { siteConfig } from "@/lib/seo";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/score", "/sign-in", "/sign-up", "/monitored-by"],
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/admin",
          "/admin/",
          "/api/",
          "/settings",
          // Private app surfaces (nested under dashboard but listed for clarity)
          "/dashboard/settings",
          "/dashboard/billing",
          "/dashboard/assistant",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
