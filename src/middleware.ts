import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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

/** Anonymous marketing HTML — skip Clerk work so CDN can cache (TTFB). */
const isCdnMarketingGet = createRouteMatcher([
  "/",
  "/score",
  "/monitored-by",
  "/robots.txt",
  "/sitemap.xml",
]);

const CDN_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

function hasClerkSessionCookie(request: NextRequest): boolean {
  return Boolean(
    request.cookies.get("__session")?.value ||
      request.cookies.get("__client_uat")?.value ||
      request.cookies.get("__clerk_db_jwt")?.value
  );
}

function withMarketingCache(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", CDN_CACHE_CONTROL);
  response.headers.set("CDN-Cache-Control", CDN_CACHE_CONTROL);
  response.headers.set("Vercel-CDN-Cache-Control", CDN_CACHE_CONTROL);
  response.headers.set("Vary", "Cookie");
  return response;
}

const hasClerk =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder");

if (!hasClerk && process.env.NODE_ENV !== "production") {
  console.warn(
    "[middleware] Clerk is not configured — protected routes are open in development only"
  );
}

const clerkHandler = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  if (
    request.method === "GET" &&
    (pathname === "/" ||
      pathname === "/robots.txt" ||
      pathname === "/sitemap.xml" ||
      pathname === "/score" ||
      pathname === "/monitored-by") &&
    !hasClerkSessionCookie(request)
  ) {
    return withMarketingCache(response);
  }

  return response;
});

export default hasClerk
  ? function middleware(request: NextRequest, event: NextFetchEvent) {
      if (
        request.method === "GET" &&
        isCdnMarketingGet(request) &&
        !hasClerkSessionCookie(request)
      ) {
        return withMarketingCache(NextResponse.next());
      }
      return clerkHandler(request, event);
    }
  : function middleware(request: NextRequest) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Authentication is not configured" },
          { status: 503 }
        );
      }
      if (request.method === "GET" && isCdnMarketingGet(request)) {
        return withMarketingCache(NextResponse.next());
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
