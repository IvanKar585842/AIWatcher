import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/status(.*)",
  "/report(.*)",
  "/score(.*)",
  "/monitored-by(.*)",
  "/api/status(.*)",
  "/api/public(.*)",
  "/api/health",
  "/api/health/live",
  "/api/webhooks(.*)",
  "/api/stripe/webhook",
  "/api/telegram/webhook",
  "/api/cron(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sitemap.xml",
  "/robots.txt",
]);

// Auth UI (/sign-in, /sign-up) is rate-limited by Clerk. API abuse is handled in withRateLimit.

const hasClerk =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder");

if (!hasClerk && process.env.NODE_ENV !== "production") {
  console.warn(
    "[middleware] Clerk is not configured — protected routes are open in development only"
  );
}

export default hasClerk
  ? clerkMiddleware(async (auth, request) => {
      if (!isPublicRoute(request)) {
        await auth.protect();
      }

      const response = NextResponse.next();
      const { pathname } = request.nextUrl;

      // CDN-friendly caching for anonymous marketing HTML (TTFB)
      if (
        request.method === "GET" &&
        (pathname === "/" ||
          pathname === "/robots.txt" ||
          pathname === "/sitemap.xml" ||
          pathname === "/score" ||
          pathname === "/monitored-by")
      ) {
        response.headers.set(
          "Cache-Control",
          "public, s-maxage=300, stale-while-revalidate=3600"
        );
      }

      return response;
    })
  : function middleware(request: Request) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Authentication is not configured" },
          { status: 503 }
        );
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
