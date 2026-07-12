import type { Metadata, Viewport } from "next";

/** Always production domain for SEO unless explicitly overridden */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://watchflowing.com"
).replace("http://localhost:3000", "https://watchflowing.com");

export const siteConfig = {
  name: "WatchFlowing",
  shortName: "WatchFlowing",
  productName: "WatchFlowing",
  tagline: "AI Website Monitoring & Intelligence Platform",
  description:
    "WatchFlowing uses AI to monitor websites, detect important changes, analyze updates and deliver intelligent alerts.",
  url: SITE_URL,
  ogImage: "/og-image.png",
  locale: "en_US",
  keywords: [
    "AI website monitoring",
    "website change detection",
    "AI website tracker",
    "website monitoring tool",
    "competitor monitoring",
    "website alerts",
    "SEO monitoring tool",
    "website intelligence platform",
    "AI monitoring assistant",
    "page change alerts",
    "website tracker",
  ],
  links: {
    twitter: "https://twitter.com/watchflowing",
    github: "https://github.com/watchflowing",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090909" },
    { media: "(prefers-color-scheme: light)", color: "#090909" },
  ],
  colorScheme: "dark",
};

export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  applicationName: siteConfig.name,
  category: "technology",
  alternates: {
    canonical: siteConfig.url,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.svg"],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "WatchFlowing — AI website monitoring and intelligence platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    creator: "@watchflowing",
    site: "@watchflowing",
    images: [
      {
        url: siteConfig.ogImage,
        alt: "WatchFlowing — AI website monitoring and intelligence platform",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "msapplication-TileColor": "#090909",
  },
};

export const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "WatchFlowing",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Website Monitoring",
  operatingSystem: "Web",
  url: siteConfig.url,
  image: `${siteConfig.url}${siteConfig.ogImage}`,
  description:
    "AI-powered website monitoring and intelligence platform. Detect website changes, track competitors, and get intelligent alerts.",
  keywords: siteConfig.keywords.join(", "),
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "49",
    priceCurrency: "USD",
    offerCount: "3",
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "19",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Business",
        price: "49",
        priceCurrency: "USD",
      },
    ],
  },
  featureList: [
    "AI website monitoring",
    "Website change detection",
    "Competitor monitoring",
    "Intelligent alerts",
    "AI monitoring assistant",
  ],
  publisher: {
    "@type": "Organization",
    name: "WatchFlowing",
    url: siteConfig.url,
    logo: `${siteConfig.url}/icons/icon-512.png`,
  },
};
