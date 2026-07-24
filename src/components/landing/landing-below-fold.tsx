import { LandingDeferredGate } from "@/components/landing/landing-deferred-gate";
import { OsFaq } from "@/components/landing/os/faq";
import { OsFooter } from "@/components/landing/os/footer";
import { OsPricing } from "@/components/landing/os/pricing";

/**
 * Server wrapper: RSC Pricing/FAQ/Footer in initial HTML.
 * Interactive below-fold sections load via a deferred client chunk.
 */
export function LandingBelowFold() {
  return (
    <>
      <LandingDeferredGate />
      <OsPricing />
      <OsFaq />
      <OsFooter />
    </>
  );
}
