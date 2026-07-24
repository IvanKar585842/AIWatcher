import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/**
 * Anonymous marketing HTML — skip Clerk middleware entirely (TTFB / CDN).
 * NOTE: Clerk sets `__client_uat=0` for signed-out users. Treating any
 * `__client_uat` as a session previously forced every visitor through Clerk
 * and defeated CDN Cache-Control.
 */
const CDN_MARKETING_PATHS = new Set([
  "/",
  "/score",
  "/monitored-by",
  "/robots.txt",
  "/sitemap.xml",
]);

/** Public auth shells — skip Clerk middleware cold start (auth is client-side). */
const CDN_AUTH_SHELL_PATHS = new Set(["/sign-in", "/sign-up"]);

const CDN_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";
const AUTH_SHELL_CACHE = "public, s-maxage=60, stale-while-revalidate=600";

const PUBLIC_PATH_MATCHERS = [
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
];

function hasRealClerkSession(request: NextRequest): boolean {
  if (request.cookies.get("__session")?.value) return true;
  if (request.cookies.get("__clerk_db_jwt")?.value) return true;
  const uat = request.cookies.get("__client_uat")?.value;
  // Signed-out Clerk clients use "0" — not a session
  return Boolean(uat && uat !== "0");
}

function withMarketingCache(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", CDN_CACHE_CONTROL);
  response.headers.set("CDN-Cache-Control", CDN_CACHE_CONTROL);
  response.headers.set("Vercel-CDN-Cache-Control", CDN_CACHE_CONTROL);
  response.headers.set("Vary", "Cookie");
  return response;
}

function withAuthShellCache(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", AUTH_SHELL_CACHE);
  response.headers.set("CDN-Cache-Control", AUTH_SHELL_CACHE);
  response.headers.set("Vercel-CDN-Cache-Control", AUTH_SHELL_CACHE);
  response.headers.set("Vary", "Cookie");
  return response;
}

function isCdnMarketingGet(request: NextRequest): boolean {
  return (
    request.method === "GET" && CDN_MARKETING_PATHS.has(request.nextUrl.pathname)
  );
}

function isAuthShellGet(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  const path = request.nextUrl.pathname;
  if (CDN_AUTH_SHELL_PATHS.has(path)) return true;
  return path.startsWith("/sign-in/") || path.startsWith("/sign-up/");
}

const hasClerk =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder");

if (!hasClerk && process.env.NODE_ENV !== "production") {
  console.warn(
    "[middleware] Clerk is not configured — protected routes are open in development only"
  );
}

type ClerkHandler = (req: NextRequest, evt: NextFetchEvent) => Response | Promise<Response>;

let clerkHandlerPromise: Promise<ClerkHandler> | null = null;

function loadClerkHandler(): Promise<ClerkHandler> {
  if (!clerkHandlerPromise) {
    clerkHandlerPromise = import("@clerk/nextjs/server").then(
      ({ clerkMiddleware, createRouteMatcher }) => {
        const isPublicRoute = createRouteMatcher(PUBLIC_PATH_MATCHERS);

        return clerkMiddleware(async (auth, request) => {
          if (!isPublicRoute(request)) {
            await auth.protect();
          }

          const response = NextResponse.next();
          if (isCdnMarketingGet(request) && !hasRealClerkSession(request)) {
            return withMarketingCache(response);
          }
          return response;
        }) as ClerkHandler;
      }
    );
  }
  return clerkHandlerPromise;
}

export default hasClerk
  ? async function middleware(request: NextRequest, event: NextFetchEvent) {
      // Fast path: no Clerk module load for anonymous marketing HTML
      if (isCdnMarketingGet(request) && !hasRealClerkSession(request)) {
        return withMarketingCache(NextResponse.next());
      }

      // Fast path: auth page shells are public + client-auth — skip Clerk edge cold start
      if (isAuthShellGet(request) && !hasRealClerkSession(request)) {
        return withAuthShellCache(NextResponse.next());
      }

      const handler = await loadClerkHandler();
      return handler(request, event);
    }
  : function middleware(request: NextRequest) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Authentication is not configured" },
          { status: 503 }
        );
      }
      if (isCdnMarketingGet(request)) {
        return withMarketingCache(NextResponse.next());
      }
      if (isAuthShellGet(request)) {
        return withAuthShellCache(NextResponse.next());
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
