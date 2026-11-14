import type { Metadata } from "next";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Check a site you own",
  description:
    "Check your company's own site for changes, broken pages, and the elements you care about.",
  alternates: {
    canonical: `${siteConfig.url}/score`,
  },
  openGraph: {
    title: "Check a site you own | WatchFlowing",
    description:
      "A check of a site your company owns — what changed, what looks risky, and what to review.",
    url: `${siteConfig.url}/score`,
  },
};

export default function ScoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
