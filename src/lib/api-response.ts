import { NextResponse } from "next/server";
import { ApiError, isUnauthorizedError } from "@/lib/errors";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: string; details?: unknown };

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiFailure(
  error: string,
  status = 400,
  details?: unknown
): NextResponse<ApiFailure> {
  return NextResponse.json({ success: false, error, ...(details ? { details } : {}) }, { status });
}

export function apiFailureFromError(error: unknown): NextResponse<ApiFailure> {
  if (isUnauthorizedError(error)) {
    return apiFailure("Unauthorized", 401);
  }
  if (error instanceof ApiError) {
    return apiFailure(error.message, error.status);
  }
  console.error("API error:", error);
  const message =
    error instanceof Error && error.message.includes("Invalid")
      ? error.message
      : "Internal server error";
  return apiFailure(message, 500);
}
