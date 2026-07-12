import type { Metadata } from "next";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Website Intelligence Score",
  description:
    "Scan any website for health, SEO signals, performance hints, and risk factors — powered by WatchFlowing AI website monitoring.",
  alternates: {
    canonical: `${siteConfig.url}/score`,
  },
  openGraph: {
    title: "Website Intelligence Score | WatchFlowing",
    description:
      "Free website intelligence scan — SEO monitoring signals, risks, and recommendations.",
    url: `${siteConfig.url}/score`,
  },
};

export default function ScoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
