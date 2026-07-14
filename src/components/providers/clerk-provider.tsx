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

/** Routes that must not render without Clerk context (SignIn/SignUp/UserButton). */
function requiresClerkContext(pathname: string | null) {
  if (!pathname) return true;
  return (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin")
  );
}

type ClerkProviderComponent = ComponentType<{
  children: ReactNode;
  appearance?: { variables?: Record<string, string> };
}>;

/**
 * Truly code-splits @clerk/nextjs so marketing LCP is not blocked by Clerk parse/download.
 * App/auth routes wait for ClerkProvider before rendering children that need its context.
 */
export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const marketing = isMarketingPath(pathname);
  const needsClerk = requiresClerkContext(pathname);
  const [ClerkProvider, setClerkProvider] = useState<ClerkProviderComponent | null>(null);

  useEffect(() => {
    if (!publishableKey || publishableKey.includes("placeholder")) return;

    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      void import("@clerk/nextjs")
        .then((mod) => {
          if (!cancelled) setClerkProvider(() => mod.ClerkProvider);
        })
        .catch(() => {
          // Keep waiting UI — do not crash the tree
        });
    };

    if (!marketing || needsClerk) {
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
  }, [marketing, needsClerk]);

  if (!publishableKey || publishableKey.includes("placeholder")) {
    return <>{children}</>;
  }

  // Auth/app pages: never mount SignIn/dashboard without ClerkProvider (avoids client crash)
  if (!ClerkProvider) {
    if (needsClerk) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#090909]">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/25 border-t-cyan-400"
            aria-label="Loading"
          />
        </div>
      );
    }
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
