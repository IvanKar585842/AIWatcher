import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "www.google.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  // Keep Chromium / Playwright out of the webpack bundle so binaries are not relocated
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@sparticuz/chromium-min",
  ],
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
