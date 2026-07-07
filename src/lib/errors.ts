import { NextResponse } from "next/server";
import { apiFailureFromError } from "@/lib/api-response";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof UnauthorizedError ||
    (error instanceof Error && error.message === "Unauthorized")
  );
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  return apiFailureFromError(error);
}
