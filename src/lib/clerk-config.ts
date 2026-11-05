/** True when a real Clerk publishable key is present. Safe on server and client. */
export function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  return key.length > 0 && !key.includes("placeholder");
}

/**
 * Local dashboard session used only by `next dev` when Clerk keys are absent.
 * Production without Clerk stays closed (middleware returns 503).
 */
export function isLocalDevSession(): boolean {
  return process.env.NODE_ENV !== "production" && !isClerkConfigured();
}
