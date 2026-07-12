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

const MAX_JSON_BODY_BYTES = 256 * 1024; // 256 KB

/** Messages safe to show end users (validation / expected business errors). */
export function safeClientErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (error instanceof ApiError && error.status < 500) {
    return error.message;
  }
  if (error instanceof Error) {
    const msg = error.message;
    // Allow known user-facing validation / URL policy messages only
    if (
      msg.startsWith("Invalid") ||
      msg.includes("not allowed") ||
      msg.includes("cannot be monitored") ||
      msg.includes("Could not resolve URL") ||
      msg.includes("Too many redirects") ||
      msg.includes("Only HTTP")
    ) {
      return msg.slice(0, 200);
    }
  }
  return fallback;
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > MAX_JSON_BODY_BYTES) {
      throw new ApiError("Request body too large", 413);
    }
  }

  try {
    const text = await request.text();
    if (text.length > MAX_JSON_BODY_BYTES) {
      throw new ApiError("Request body too large", 413);
    }
    if (!text.trim()) {
      throw new ApiError("Invalid JSON body", 400);
    }
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Invalid JSON body", 400);
  }
}
