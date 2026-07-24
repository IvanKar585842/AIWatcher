"use client";

import Script from "next/script";
import { ClerkThemeProvider } from "@/components/providers/clerk-provider";
import { GrowthCapture } from "@/components/growth/growth-capture";

const CLARITY_PROJECT_ID = "xrhyodo94i";

/**
 * App/auth shell providers — never mounted on marketing `/`.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
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
