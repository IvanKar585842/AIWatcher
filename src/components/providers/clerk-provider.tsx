"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const MARKETING_PATHS = new Set(["/", "/score", "/monitored-by"]);

function isMarketingPath(pathname: string | null) {
  if (!pathname) return false;
  if (MARKETING_PATHS.has(pathname)) return true;
  return pathname.startsWith("/status/") || pathname.startsWith("/report/");
}

/**
 * On marketing pages, defer mounting Clerk until idle so its JS
 * does not compete with LCP (hero H1 / chrome). App routes mount Clerk immediately.
 */
export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const marketing = isMarketingPath(pathname);
  const [deferredReady, setDeferredReady] = useState(false);
  const clerkReady = !marketing || deferredReady;

  useEffect(() => {
    if (!marketing) return;

    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const enable = () => setDeferredReady(true);

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(enable, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(enable, 800);
    }

    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [marketing]);

  if (!publishableKey || publishableKey.includes("placeholder")) {
    return <>{children}</>;
  }

  if (!clerkReady) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#2563eb",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
