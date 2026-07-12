import type { Metadata } from "next";
import { siteConfig } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Start free AI website monitoring with WatchFlowing. Detect changes, get intelligent alerts, and track competitors.",
  alternates: { canonical: `${siteConfig.url}/sign-up` },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
