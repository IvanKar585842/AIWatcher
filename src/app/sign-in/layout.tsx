import type { Metadata } from "next";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to WatchFlow — your AI website monitoring dashboard.",
  robots: { index: false, follow: true },
  alternates: { canonical: `${siteConfig.url}/sign-in` },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
