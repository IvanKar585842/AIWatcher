import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { securityLog } from "@/lib/security/log";

export type RateLimitTier =
  | "api"
  | "strict"
  | "sensitive"
  | "ai"
  | "public"
  | "admin"
  | "email";

const TIER_CONFIG: Record<
  RateLimitTier,
  { requests: number; window: `${number} ${"s" | "m" | "h" | "d"}`; prefix: string }
> = {
  /** General authenticated API */
  api: { requests: 60, window: "1 m", prefix: "rl:api" },
  /** Monitor creation — prevent mass create */
  strict: { requests: 10, window: "1 m", prefix: "rl:strict" },
  /** Updates, manual checks, billing mutations */
  sensitive: { requests: 20, window: "1 m", prefix: "rl:sensitive" },
  /** AI chat / analysis triggers */
  ai: { requests: 20, window: "1 m", prefix: "rl:ai" },
  /** Public status pages */
  public: { requests: 30, window: "1 m", prefix: "rl:public" },
  /** Admin panel */
  admin: { requests: 30, window: "1 m", prefix: "rl:admin" },
  /** Outbound email / notification bursts */
  email: { requests: 30, window: "1 h", prefix: "rl:email" },
};

const limiters = new Map<RateLimitTier, Ratelimit>();
let warnedMissingRedis = false;

/** Process-local sliding window when Upstash is unavailable (fail closed, not open). */
type MemoryBucket = { timestamps: number[] };
const memoryBuckets = new Map<string, MemoryBucket>();

function windowMsFromConfig(window: string): number {
  const match = window.match(/^(\d+)\s*([smhd])$/);
  if (!match) return 60_000;
  const n = Number(match[1]);
  const unit = match[2];
  if (unit === "s") return n * 1000;
  if (unit === "m") return n * 60_000;
  if (unit === "h") return n * 3_600_000;
  return n * 86_400_000;
}

function checkMemoryRateLimit(
  identifier: string,
  tier: RateLimitTier
): { success: boolean; remaining: number; reset: number } {
  const cfg = TIER_CONFIG[tier];
  const windowMs = windowMsFromConfig(cfg.window);
  const now = Date.now();
  const key = `${tier}:${identifier}`;
  let bucket = memoryBuckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    memoryBuckets.set(key, bucket);
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= cfg.requests) {
    const oldest = bucket.timestamps[0] ?? now;
    return {
      success: false,
      remaining: 0,
      reset: oldest + windowMs,
    };
  }
  bucket.timestamps.push(now);
  // Bound map growth in long-lived processes
  if (memoryBuckets.size > 10_000) {
    const firstKey = memoryBuckets.keys().next().value;
    if (firstKey) memoryBuckets.delete(firstKey);
  }
  return {
    success: true,
    remaining: Math.max(0, cfg.requests - bucket.timestamps.length),
    reset: now + windowMs,
  };
}

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    if (!warnedMissingRedis) {
      warnedMissingRedis = true;
      console.warn(
        "[rate-limit] Upstash Redis is not configured — using in-memory rate limits (per instance)"
      );
    }
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function getLimiter(tier: RateLimitTier): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  let existing = limiters.get(tier);
  if (!existing) {
    const cfg = TIER_CONFIG[tier];
    existing = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.requests, cfg.window),
      analytics: true,
      prefix: cfg.prefix,
    });
    limiters.set(tier, existing);
  }
  return existing;
}

export function rateLimitKey(route: string, userId?: string | null): string {
  return userId ? `${route}:user:${userId}` : route;
}

export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = "api"
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const rl = getLimiter(tier);
  if (!rl) {
    return checkMemoryRateLimit(identifier, tier);
  }

  const result = await rl.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/** @deprecated Prefer checkRateLimit(id, "ai") — kept for chat routes */
export async function checkChatRateLimit(
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  return checkRateLimit(identifier, "ai");
}

function rateLimitResponse(
  remaining: number,
  reset: number,
  message = "Too many requests. Please try again later."
): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 429,
      headers: {
        "X-RateLimit-Remaining": String(remaining),
        "Retry-After": String(retryAfter),
      },
    }
  );
}

export async function withRateLimit(
  identifier: string,
  handler: () => Promise<NextResponse>,
  userId?: string | null,
  tier: RateLimitTier = "api"
): Promise<NextResponse> {
  const key = userId ? rateLimitKey(identifier, userId) : identifier;
  const { success, remaining, reset } = await checkRateLimit(key, tier);

  if (!success) {
    securityLog({
      type: "rate_limit.exceeded",
      message: "Rate limit exceeded",
      userId,
      route: identifier,
      metadata: { tier, remaining, reset },
    });
    return rateLimitResponse(remaining, reset);
  }

  try {
    const response = await handler();
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (error) {
    const { apiFailureFromError } = await import("@/lib/api-response");
    return apiFailureFromError(error);
  }
}

export async function withChatRateLimit(
  userId: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const key = rateLimitKey("chat-send", userId);
  const { success, remaining, reset } = await checkRateLimit(key, "ai");

  if (!success) {
    securityLog({
      type: "rate_limit.exceeded",
      message: "AI chat rate limit exceeded",
      userId,
      route: "chat-send",
      metadata: { tier: "ai" },
    });
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return new Response(
      JSON.stringify({ success: false, error: "Too many messages. Please wait a moment." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(remaining),
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  const response = await handler();
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

/**
 * Internal email/notification burst protection (call before sending).
 */
export async function assertEmailRateLimit(userId: string): Promise<boolean> {
  const { success } = await checkRateLimit(rateLimitKey("email-send", userId), "email");
  if (!success) {
    securityLog({
      type: "rate_limit.exceeded",
      message: "Email send rate limit exceeded",
      userId,
      route: "email-send",
      metadata: { tier: "email" },
    });
  }
  return success;
}
