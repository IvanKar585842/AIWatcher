import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { siteConfig } from "@/lib/seo";

/** ISR — keep landing warm on the CDN edge, cut cold TTFB for anonymous visitors. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: `${siteConfig.name} — ${siteConfig.tagline}`,
  },
  description: siteConfig.description,
  alternates: {
    canonical: siteConfig.url,
  },
};

export default function HomePage() {
  return <LandingPage />;
}
