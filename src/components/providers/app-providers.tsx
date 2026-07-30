"use client";

import Script from "next/script";
import { ClerkThemeProvider } from "@/components/providers/clerk-provider";
import { GrowthCapture } from "@/components/growth/growth-capture";

const CLARITY_PROJECT_ID = "xrhyodo94i";
const clerkConfigured =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()) &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!.includes("placeholder");

/**
 * App/auth shell providers — never mounted on marketing `/`.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  if (!clerkConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090909] p-6 text-center">
        <div className="max-w-md rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
            Authentication unavailable
          </p>
          <h1 className="mt-2 text-lg font-medium text-zinc-100">
            Configure Clerk to open the dashboard
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Add the Clerk publishable and secret keys to your local environment, then restart the
            app. Production requests remain protected by middleware.
          </p>
        </div>
      </main>
    );
  }

  return (
    <ClerkThemeProvider>
      <GrowthCapture />
      {children}
      {process.env.NODE_ENV === "production" ? (
        <Script id="microsoft-clarity" strategy="lazyOnload">
          {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
        </Script>
      ) : null}
    </ClerkThemeProvider>
  );
}
