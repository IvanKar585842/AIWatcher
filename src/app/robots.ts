import { siteConfig } from "@/lib/seo";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
