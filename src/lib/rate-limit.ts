import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

let ratelimit: Ratelimit | null = null;
let chatRatelimit: Ratelimit | null = null;

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function getRatelimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      analytics: true,
      prefix: "rl:api",
    });
  }

  return ratelimit;
}

function getChatRatelimit(): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  if (!chatRatelimit) {
    chatRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: true,
      prefix: "rl:chat",
    });
  }

  return chatRatelimit;
}

export async function checkChatRateLimit(
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const rl = getChatRatelimit();
  if (!rl) {
    return { success: true, remaining: 30, reset: Date.now() + 60_000 };
  }

  const result = await rl.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export async function withChatRateLimit(
  userId: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const key = rateLimitKey("chat-send", userId);
  const { success, remaining, reset } = await checkChatRateLimit(key);

  if (!success) {
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

export async function checkRateLimit(
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const rl = getRatelimit();
  if (!rl) {
    return { success: true, remaining: 60, reset: Date.now() + 60_000 };
  }

  const result = await rl.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

export function rateLimitKey(route: string, userId?: string | null): string {
  return userId ? `${route}:user:${userId}` : route;
}

export async function withRateLimit(
  identifier: string,
  handler: () => Promise<NextResponse>,
  userId?: string | null
): Promise<NextResponse> {
  const key = userId ? rateLimitKey(identifier, userId) : identifier;
  const { success, remaining, reset } = await checkRateLimit(key);

  if (!success) {
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": String(remaining),
          "Retry-After": String(retryAfter),
        },
      }
    );
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
