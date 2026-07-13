import type { Metadata } from "next";
import { Syne, IBM_Plex_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { defaultMetadata, structuredData, viewport as siteViewport } from "@/lib/seo";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ClerkThemeProvider } from "@/components/providers/clerk-provider";
import { GrowthCapture } from "@/components/growth/growth-capture";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  preload: true,
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-os-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = defaultMetadata;
export const viewport = siteViewport;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-screen font-[family-name:var(--font-syne)] antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ClerkThemeProvider>
            <GrowthCapture />
            {children}
          </ClerkThemeProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
