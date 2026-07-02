import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!ratelimit) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      analytics: true,
    });
  }

  return ratelimit;
}

export async function checkRateLimit(
  identifier: string,
  limit = 60
): Promise<{ success: boolean; remaining: number }> {
  const rl = getRatelimit();
  if (!rl) {
    return { success: true, remaining: limit };
  }

  const result = await rl.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}

export async function withRateLimit(
  identifier: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const { success, remaining } = await checkRateLimit(identifier);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": String(remaining) },
      }
    );
  }

  const response = await handler();
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
