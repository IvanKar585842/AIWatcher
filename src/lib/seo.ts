import { type Metadata } from "next";

export const siteConfig = {
  name: "WatchFlow AI",
  description:
    "Monitor any webpage and get AI-powered explanations of what changed and why it matters. Intelligent web monitoring for teams and individuals.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://watchflow.ai",
  ogImage: "/og-image.png",
  links: {
    twitter: "https://twitter.com/watchflowai",
    github: "https://github.com/watchflow-ai",
  },
};

export const defaultMetadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "web monitoring",
    "website change detection",
    "AI monitoring",
    "page change alerts",
    "price monitoring",
    "competitor tracking",
    "SaaS",
  ],
  authors: [{ name: "WatchFlow AI" }],
  creator: "WatchFlow AI",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    creator: "@watchflowai",
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
};

export const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "WatchFlow AI",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: siteConfig.description,
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "49",
    priceCurrency: "USD",
    offerCount: "3",
  },
};
