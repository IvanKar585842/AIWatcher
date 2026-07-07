import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/webhooks(.*)",
  "/api/telegram/webhook",
  "/api/cron(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sitemap.xml",
  "/robots.txt",
]);

const hasClerk =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder");

export default hasClerk
  ? clerkMiddleware(async (auth, request) => {
      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    })
  : function middleware() {
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
