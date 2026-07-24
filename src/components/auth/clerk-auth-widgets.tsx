"use client";

import dynamic from "next/dynamic";

const SignIn = dynamic(() => import("@clerk/nextjs").then((m) => m.SignIn), {
  ssr: false,
  loading: () => <AuthWidgetSkeleton label="Loading sign in" />,
});

const SignUp = dynamic(() => import("@clerk/nextjs").then((m) => m.SignUp), {
  ssr: false,
  loading: () => <AuthWidgetSkeleton label="Loading sign up" />,
});

function AuthWidgetSkeleton({ label }: { label: string }) {
  return (
    <div
      className="flex h-[420px] w-full max-w-md items-center justify-center rounded-xl border border-white/[0.06] bg-black/40"
      aria-label={label}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/25 border-t-cyan-400" />
    </div>
  );
}

export function ClerkSignInWidget() {
  return <SignIn />;
}

export function ClerkSignUpWidget() {
  return <SignUp />;
}
