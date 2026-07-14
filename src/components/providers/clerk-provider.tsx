"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const MARKETING_PATHS = new Set(["/", "/score", "/monitored-by"]);

function isMarketingPath(pathname: string | null) {
  if (!pathname) return false;
  if (MARKETING_PATHS.has(pathname)) return true;
  return pathname.startsWith("/status/") || pathname.startsWith("/report/");
}

type ClerkProviderComponent = ComponentType<{
  children: ReactNode;
  appearance?: { variables?: Record<string, string> };
}>;

/**
 * Truly code-splits @clerk/nextjs so marketing LCP is not blocked by Clerk parse/download.
 * App routes import Clerk immediately; marketing waits for idle after load.
 */
export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const marketing = isMarketingPath(pathname);
  const [ClerkProvider, setClerkProvider] = useState<ClerkProviderComponent | null>(null);

  useEffect(() => {
    if (!publishableKey || publishableKey.includes("placeholder")) return;

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      void import("@clerk/nextjs").then((mod) => {
        if (!cancelled) setClerkProvider(() => mod.ClerkProvider);
      });
    };

    if (!marketing) {
      load();
      return () => {
        cancelled = true;
      };
    }

    const schedule = () => {
      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(load, { timeout: 4000 });
      } else {
        timeoutId = setTimeout(load, 2000);
      }
    };

    if (document.readyState === "complete") {
      schedule();
    } else {
      window.addEventListener("load", schedule, { once: true });
      timeoutId = setTimeout(schedule, 3500);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [marketing]);

  if (!publishableKey || publishableKey.includes("placeholder") || !ClerkProvider) {
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
