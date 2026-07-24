"use client";

import { ClerkProvider } from "@clerk/nextjs";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * App/admin only (never on marketing `/`).
 * Must wrap children that call useUser / UserButton / useAuth —
 * rendering them before ClerkProvider causes a client-side exception.
 */
export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  if (!publishableKey || publishableKey.includes("placeholder")) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
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
