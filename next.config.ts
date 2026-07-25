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
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@clerk/nextjs",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-switch",
      "@radix-ui/react-scroll-area",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "www.google.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@sparticuz/chromium",
    "@sparticuz/chromium-min",
  ],
  outputFileTracingIncludes: {
    "/api/monitors/[id]/check": chromiumIncludes,
    "/api/cron/monitoring": chromiumIncludes,
  },
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(self)",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'none'",
          // Clerk CAPTCHA uses Cloudflare Turnstile — must allow challenges.cloudflare.com
          // and Clerk abuse protection (*.protect.clerk.com) or signup shows CAPTCHA failed.
          "form-action 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.watchflowing.com https://accounts.google.com",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://challenges.cloudflare.com",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.watchflowing.com https://*.protect.clerk.com https://challenges.cloudflare.com https://js.stripe.com https://www.clarity.ms https://scripts.clarity.ms https://*.vercel-scripts.com https://va.vercel-scripts.com",
          "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://clerk.watchflowing.com https://*.protect.clerk.com https://challenges.cloudflare.com https://api.stripe.com https://www.clarity.ms https://*.clarity.ms https://*.upstash.io https://*.vercel-insights.com https://vitals.vercel-insights.com wss: https:",
          "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.watchflowing.com https://*.protect.clerk.com https://challenges.cloudflare.com https://accounts.google.com",
          "worker-src 'self' blob:",
          "child-src 'self' blob: https://challenges.cloudflare.com",
        ].join("; "),
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/:path*(svg|jpg|jpeg|png|webp|avif|ico|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/score",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
      {
        source: "/monitored-by",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=3600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
