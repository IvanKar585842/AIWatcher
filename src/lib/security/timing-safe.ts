import { timingSafeEqual } from "crypto";

/** Constant-time string compare for secrets (Bearer tokens, webhook headers). */
export function safeEqualString(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
