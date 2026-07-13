import Stripe from "stripe";
import { ApiError } from "@/lib/errors";

/**
 * Map Stripe SDK / config failures to safe client-facing ApiErrors.
 * Never forward raw Stripe messages (may contain ids / internals).
 */
export function toStripeClientError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof Stripe.errors.StripeError) {
    const code = error.code ?? "";
    const msg = (error.message ?? "").toLowerCase();

    console.error("[stripe]", {
      name: error.name,
      type: error.type,
      code,
      statusCode: error.statusCode,
      message: error.message,
    });

    if (
      error instanceof Stripe.errors.StripeAuthenticationError ||
      code === "api_key_expired"
    ) {
      return new ApiError("Stripe configuration error", 503);
    }

    if (
      code === "resource_missing" ||
      msg.includes("no such price") ||
      msg.includes("no such customer") ||
      msg.includes("no such product")
    ) {
      return new ApiError("Stripe configuration error", 503);
    }

    if (
      msg.includes("portal") ||
      msg.includes("customer portal") ||
      msg.includes("billing portal")
    ) {
      return new ApiError(
        "Billing portal is not configured yet. Please try again later.",
        503
      );
    }

    if (
      error instanceof Stripe.errors.StripeConnectionError ||
      error instanceof Stripe.errors.StripeAPIError ||
      error instanceof Stripe.errors.StripeRateLimitError
    ) {
      return new ApiError("Payment system is temporarily unavailable", 503);
    }

    return new ApiError("Unable to create checkout session", 502);
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("stripe") ||
      msg.includes("price id") ||
      msg.includes("not configured") ||
      msg.includes("secret_key")
    ) {
      console.error("[stripe] config:", error.message);
      return new ApiError("Stripe configuration error", 503);
    }
  }

  console.error("[stripe] unexpected:", error);
  return new ApiError("Payment system is temporarily unavailable", 503);
}
