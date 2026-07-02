"use client";

import { ClerkProvider } from "@clerk/nextjs";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  if (!publishableKey || publishableKey.includes("placeholder")) {
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
