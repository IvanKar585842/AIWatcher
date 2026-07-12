import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { defaultMetadata, structuredData, viewport as siteViewport } from "@/lib/seo";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ClerkThemeProvider } from "@/components/providers/clerk-provider";
import { GrowthCapture } from "@/components/growth/growth-capture";
import "./globals.css";

export const metadata: Metadata = defaultMetadata;
export const viewport = siteViewport;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
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
