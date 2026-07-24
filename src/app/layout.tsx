import type { Metadata } from "next";
import { Syne, IBM_Plex_Mono } from "next/font/google";
import { defaultMetadata, structuredData, viewport as siteViewport } from "@/lib/seo";
import "./globals.css";

/**
 * Syne is the LCP text face — keep preload + swap.
 * Mono is non-critical (labels) — optional, no preload.
 */
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
 * Marketing-critical root shell:
 * - No Clerk / theme / Clarity / SpeedInsights here (those compete with FCP/LCP)
 * - Clarity is injected only under /dashboard and /sign-* via AppProviders
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
      <body className="min-h-screen bg-[#090909] font-[family-name:var(--font-syne)] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
