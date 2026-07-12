import { siteConfig } from "@/lib/seo";

export default function sitemap() {
  const baseUrl = siteConfig.url;

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 1 },
    { url: `${baseUrl}/score`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${baseUrl}/sign-in`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${baseUrl}/sign-up`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.5 },
  ];
}
