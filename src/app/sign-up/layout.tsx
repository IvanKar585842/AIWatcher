import type { Metadata } from "next";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Start free AI website monitoring with WatchFlowing. Detect changes, get intelligent alerts, and track competitors.",
  alternates: { canonical: `${siteConfig.url}/sign-up` },
};

/** No AppProviders — widget bundles its own ClerkProvider (faster first paint). */
export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
