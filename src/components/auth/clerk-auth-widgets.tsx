"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

type ClerkProviderComponent = ComponentType<{
  children: ReactNode;
  publishableKey?: string;
  appearance?: { variables?: Record<string, string> };
}>;

type SignComponent = ComponentType<Record<string, never>>;

function AuthWidgetSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex h-[420px] w-full max-w-md flex-col justify-center gap-3 rounded-xl border border-white/[0.06] bg-black/40 px-6"
      aria-label={label}
    >
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/25 border-t-cyan-400" />
      <div className="mx-auto h-3 w-40 animate-pulse rounded bg-white/[0.06]" />
      <div className="mx-auto h-10 w-full max-w-xs animate-pulse rounded-md bg-white/[0.04]" />
      <div className="mx-auto h-10 w-full max-w-xs animate-pulse rounded-md bg-white/[0.04]" />
      <div className="mx-auto h-10 w-full max-w-xs animate-pulse rounded-full bg-cyan-500/10" />
    </div>
  );
}

/**
 * Single dynamic import: ClerkProvider + SignUp/SignIn together.
 * Avoids "missing ClerkProvider" while still keeping SSR page chrome (H1) for LCP.
 */
function useClerkAuthModules() {
  const [mods, setMods] = useState<{
    ClerkProvider: ClerkProviderComponent;
    SignIn: SignComponent;
    SignUp: SignComponent;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("@clerk/nextjs")
      .then((m) => {
        if (cancelled) return;
        setMods({
          ClerkProvider: m.ClerkProvider,
          SignIn: m.SignIn,
          SignUp: m.SignUp,
        });
      })
      .catch(() => {
        /* skeleton remains */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return mods;
}

export function ClerkSignInWidget() {
  const mods = useClerkAuthModules();
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!mods || !key || key.includes("placeholder")) {
    return <AuthWidgetSkeleton label="Loading sign in" />;
  }
  const { ClerkProvider, SignIn } = mods;
  return (
    <div className="w-full max-w-md">
      <ClerkProvider publishableKey={key} appearance={{ variables: { colorPrimary: "#22d3ee" } }}>
        <SignIn />
      </ClerkProvider>
    </div>
  );
}

export function ClerkSignUpWidget() {
  const mods = useClerkAuthModules();
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!mods || !key || key.includes("placeholder")) {
    return <AuthWidgetSkeleton label="Loading sign up" />;
  }
  const { ClerkProvider, SignUp } = mods;
  return (
    <div className="w-full max-w-md">
      <ClerkProvider publishableKey={key} appearance={{ variables: { colorPrimary: "#22d3ee" } }}>
        {/* Clerk invisible CAPTCHA / Turnstile mount point */}
        <div id="clerk-captcha" />
        <SignUp />
      </ClerkProvider>
    </div>
  );
}
