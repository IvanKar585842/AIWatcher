import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";

/** SVG badge: /api/public/badge/[username] */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: raw } = await params;
  const username = raw.replace(/\.svg$/i, "").trim().toLowerCase();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anon";

  return withRateLimit(
    `badge:${username || "x"}:${ip}`,
    async () => {
      const user = await prisma.user.findFirst({
        where: {
          username,
          badgeEnabled: true,
        },
        select: { id: true, username: true },
      });

      const label = user ? "Monitored by WatchFlowing AI" : "WatchFlowing AI";
      const sub = user ? `@${username}` : "website intelligence";

      // Soft analytics — don't await failures
      if (user) {
        void trackEvent({
          type: "badge_installed",
          userId: user.id,
          metadata: { username, referer: request.headers.get("referer") },
        });
      }

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="44" viewBox="0 0 220 44" role="img" aria-label="${label}">
  <rect width="220" height="44" rx="8" fill="#0a0a0a" stroke="#1f2937"/>
  <circle cx="22" cy="22" r="6" fill="#22d3ee"/>
  <circle cx="22" cy="22" r="10" fill="none" stroke="#22d3ee" stroke-opacity="0.35"/>
  <text x="38" y="20" fill="#f4f4f5" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11" font-weight="600">${label}</text>
  <text x="38" y="34" fill="#71717a" font-family="ui-monospace,monospace" font-size="9">${sub}</text>
</svg>`;

      return new NextResponse(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        },
      });
    },
    null,
    "public"
  );
}
