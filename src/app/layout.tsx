import type { Metadata } from "next";
import { Syne, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { defaultMetadata, structuredData, viewport as siteViewport } from "@/lib/seo";
import "./globals.css";

const CLARITY_PROJECT_ID = "xrhyodo94i";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-os-mono",
  display: "optional",
  preload: false,
  adjustFontFallback: true,
});

export const metadata: Metadata = defaultMetadata;
export const viewport = siteViewport;

/**
 * Minimal root shell for marketing + app.
 * - Static `dark` class (product is dark-only) — no next-themes on critical path
 * - Clerk / GrowthCapture / SpeedInsights live in AppProviders (dashboard/auth only)
 * - Clarity stays lazyOnload (after LCP)
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${mono.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-screen bg-[#090909] font-[family-name:var(--font-syne)] antialiased">
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
      </body>
    </html>
  );
}
