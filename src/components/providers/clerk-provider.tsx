"use client";

import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

type ClerkProviderComponent = ComponentType<{
  children: ReactNode;
  appearance?: { variables?: Record<string, string> };
}>;

/**
 * Loads ClerkProvider ASAP for auth/app routes without blanking the whole page.
 * Children (SSR chrome / skeletons) stay visible → better FCP/LCP on /sign-up.
 */
export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const [ClerkProvider, setClerkProvider] = useState<ClerkProviderComponent | null>(null);

  useEffect(() => {
    if (!publishableKey || publishableKey.includes("placeholder")) return;

    let cancelled = false;
    void import("@clerk/nextjs")
      .then((mod) => {
        if (!cancelled) setClerkProvider(() => mod.ClerkProvider);
      })
      .catch(() => {
        /* keep SSR chrome visible */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!publishableKey || publishableKey.includes("placeholder")) {
    return <>{children}</>;
  }

  if (!ClerkProvider) {
    // Do NOT replace the tree with a full-screen spinner — that kills FCP/LCP.
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#22d3ee",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
