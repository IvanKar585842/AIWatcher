import type { NextConfig } from "next";

const chromiumIncludes = [
  "./node_modules/@sparticuz/chromium/**/*",
  "./node_modules/@sparticuz/chromium-min/**/*",
];

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
    "@sparticuz/chromium",
    "@sparticuz/chromium-min",
  ],
  // Only attach Chromium binaries to routes that actually launch a browser
  outputFileTracingIncludes: {
    "/api/monitors/[id]/check": chromiumIncludes,
    "/api/cron/monitoring": chromiumIncludes,
  },
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
