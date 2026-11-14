import type { Metadata } from "next";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to WatchFlowing — the assistant for websites your company owns.",
  robots: { index: false, follow: true },
  alternates: { canonical: `${siteConfig.url}/sign-in` },
};

/** No AppProviders — widget bundles its own ClerkProvider (faster first paint). */
export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
