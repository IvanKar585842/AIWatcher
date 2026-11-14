import type { Metadata } from "next";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a free account and add a website your company owns.",
  alternates: { canonical: `${siteConfig.url}/sign-up` },
};

/** No AppProviders — widget bundles its own ClerkProvider (faster first paint). */
export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
