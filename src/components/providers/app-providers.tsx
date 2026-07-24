"use client";

import { ClerkThemeProvider } from "@/components/providers/clerk-provider";
import { GrowthCapture } from "@/components/growth/growth-capture";

/**
 * App/auth shell providers — intentionally NOT on marketing routes.
 * Marketing root layout stays free of next-themes / Clerk / GrowthCapture
 * so Lighthouse FCP/LCP are not blocked by provider hydration.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkThemeProvider>
      <GrowthCapture />
      {children}
    </ClerkThemeProvider>
  );
}
