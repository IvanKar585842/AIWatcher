import { ClerkSignUpWidget } from "@/components/auth/clerk-auth-widgets";
import Link from "next/link";

/**
 * SSR chrome paints immediately (FCP/LCP text).
 * Clerk SignUp hydrates into the card — no full-page blank wait.
 */
export default function SignUpPage() {
  const hasClerk =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder");

  if (!hasClerk) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-zinc-500">
          Configure NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in your environment to enable sign-up.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#090909] px-4 py-10">
      <Link
        href="/"
        className="mb-8 text-sm text-zinc-500 transition-colors hover:text-cyan-300"
      >
        ← WatchFlowing
      </Link>
      <h1 className="mb-2 text-center text-2xl font-light tracking-tight text-zinc-100">
        Create your account
      </h1>
      <p className="mb-8 max-w-sm text-center text-sm text-zinc-500">
        Start free AI website monitoring in under a minute.
      </p>
      <ClerkSignUpWidget />
    </div>
  );
}
