import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics";
import { ApiError, isUnauthorizedError, safeClientErrorMessage } from "@/lib/errors";
import { isUpgradeRequiredError } from "@/lib/upgrade-error";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = {
  success: false;
  error: string;
  details?: unknown;
  upgrade?: {
    feature: string;
    title: string;
    description: string;
    minPlan: string;
  };
};

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
    void import("@/lib/security/log").then(({ securityLog }) =>
      securityLog({
        type: "auth.failed",
        message: "Unauthorized API request",
      })
    );
    return apiFailure("Unauthorized", 401);
  }
  if (isUpgradeRequiredError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: error.upgradeDescription,
        upgrade: {
          feature: error.feature,
          title: error.upgradeTitle,
          description: error.upgradeDescription,
          minPlan: error.minPlan,
        },
      },
      { status: error.status }
    );
  }
  if (error instanceof ApiError) {
    if (error.status === 404) {
      // ownership helpers use 404 — already logged when denied
    } else if (error.status >= 500) {
      void import("@/lib/security/log").then(({ securityLog }) =>
        securityLog({
          type: "request.failed",
          message: error.message,
          metadata: { status: error.status },
        })
      );
      // Preserve intentional billing / infra messages (not opaque "Internal server error")
      return apiFailure(error.message, error.status);
    }
    return apiFailure(error.message, error.status);
  }

  // Stripe SDK errors that escaped route wrappers
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as { type?: unknown }).type === "string" &&
    "rawType" in error
  ) {
    return apiFailure("Unable to create checkout session", 502);
  }

  console.error("API error:", error);
  const safeName = error instanceof Error ? error.name : "UnknownError";
  void trackEvent({
    type: "api.error",
    metadata: { name: safeName },
  });
  void import("@/lib/security/log").then(({ securityLog }) =>
    securityLog({
      type: "request.failed",
      message: "Unhandled API error",
      metadata: { name: safeName },
    })
  );
  return apiFailure(safeClientErrorMessage(error, "Internal server error"), 500);
}

/** Alias for older route imports */
export function apiErrorResponse(error: unknown): NextResponse<ApiFailure> {
  return apiFailureFromError(error);
}
