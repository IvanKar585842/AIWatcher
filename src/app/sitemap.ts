import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import {
  PUBLIC_SITEMAP_ROUTES,
  absoluteSitemapUrl,
} from "@/lib/public-sitemap";

/** Rebuild periodically so public status pages stay fresh after deploy. */
export const revalidate = 3600;

/**
 * Automatic sitemap.xml for Google Search Console.
 * Served at /sitemap.xml by the Next.js App Router.
 * Regenerates on deploy and every `revalidate` seconds.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_SITEMAP_ROUTES.map(
    (route) => ({
      url: absoluteSitemapUrl(route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })
  );

  let statusEntries: MetadataRoute.Sitemap = [];

  try {
    const publicProfiles = await prisma.user.findMany({
      where: {
        statusPageEnabled: true,
        username: { not: null },
      },
      select: {
        username: true,
        updatedAt: true,
      },
      take: 5000,
      orderBy: { updatedAt: "desc" },
    });

    statusEntries = publicProfiles
      .filter((u): u is { username: string; updatedAt: Date } =>
        Boolean(u.username?.trim())
      )
      .map((u) => ({
        url: absoluteSitemapUrl(`/status/${encodeURIComponent(u.username.trim().toLowerCase())}`),
        lastModified: u.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.5,
      }));
  } catch {
    // Build / preview without DB should still emit the static public sitemap.
    statusEntries = [];
  }

  return [...staticEntries, ...statusEntries];
}
