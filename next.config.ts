import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    optimizePackageImports: ["lucide-react", "framer-motion", "date-fns"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"],
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
