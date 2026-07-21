import { LandingDeferredClient } from "@/components/landing/landing-deferred-client";
import { OsFaq } from "@/components/landing/os/faq";
import { OsFooter } from "@/components/landing/os/footer";
import { OsPricing } from "@/components/landing/os/pricing";

/**
 * Server wrapper: RSC Pricing/FAQ ship without framer-motion.
 * Heavy interactive sections stay in the deferred client island.
 */
export function LandingBelowFold() {
  return (
    <>
      <LandingDeferredClient />
      <OsPricing />
      <OsFaq />
      <OsFooter />
    </>
  );
}
