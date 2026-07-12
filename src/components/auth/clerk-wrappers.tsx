"use client";

import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

const hasClerk =
  typeof window !== "undefined"
    ? !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes("placeholder") &&
      !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    : !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder");

export function AuthButtons({
  signUpClassName,
  signInClassName,
}: {
  signUpClassName?: string;
  signInClassName?: string;
}) {
  if (!hasClerk) {
    return (
      <>
        <Link href="/sign-in">
          <Button variant="ghost" size="sm" className={signInClassName}>
            Sign In
          </Button>
        </Link>
        <Link href="/sign-up">
          <Button size="sm" className={signUpClassName}>
            Get Started
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="ghost" size="sm" className={signInClassName}>
            Sign In
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button size="sm" className={signUpClassName}>
            Get Started
          </Button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className={signInClassName}>
            Dashboard
          </Button>
        </Link>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}

export function DashboardUserButton() {
  if (!hasClerk) {
    return (
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
        U
      </div>
    );
  }

  return <UserButton afterSignOutUrl="/" />;
}

export function SignUpCTA({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  /** Optional deep-link after auth (e.g. /dashboard/billing?plan=PRO) */
  href?: string;
}) {
  const signedOutHref = href
    ? `/sign-up?redirect_url=${encodeURIComponent(href)}`
    : "/sign-up";
  const signedInHref = href ?? "/dashboard";

  if (!hasClerk) {
    return (
      <Link href={signedOutHref}>
        <Button size="lg" className={className}>
          {children}
        </Button>
      </Link>
    );
  }

  return (
    <>
      <SignedIn>
        <Link href={signedInHref}>
          <Button size="lg" className={className}>
            {children}
          </Button>
        </Link>
      </SignedIn>
      <SignedOut>
        <Link href={signedOutHref}>
          <Button size="lg" className={className}>
            {children}
          </Button>
        </Link>
      </SignedOut>
    </>
  );
}

export function useHasClerk() {
  return hasClerk;
}
