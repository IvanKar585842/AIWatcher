/**
 * Verifies plan → effective monitoring interval mapping.
 * Run: npx tsx scripts/verify-monitoring-intervals.ts
 */
import { MonitoringInterval, Plan } from "@prisma/client";
import {
  INTERVAL_MINUTES,
  getAllowedIntervals,
  resolveEffectiveInterval,
} from "../src/lib/constants";

const EXPECTED_MIN: Record<Plan, MonitoringInterval> = {
  FREE: MonitoringInterval.TWELVE_HOURS,
  PRO: MonitoringInterval.THIRTY_MIN,
  BUSINESS: MonitoringInterval.ONE_MIN,
};

const EXPECTED_MINUTES: Record<Plan, number> = {
  FREE: 720,
  PRO: 30,
  BUSINESS: 1,
};

let failed = 0;

for (const plan of [Plan.FREE, Plan.PRO, Plan.BUSINESS] as const) {
  const allowed = getAllowedIntervals(plan);
  const min = allowed[0];
  const minutes = INTERVAL_MINUTES[min];
  const clampedFaster = resolveEffectiveInterval(plan, MonitoringInterval.ONE_MIN);

  const okMin = min === EXPECTED_MIN[plan];
  const okMinutes = minutes === EXPECTED_MINUTES[plan];
  const okClamp =
    plan === Plan.BUSINESS
      ? clampedFaster === MonitoringInterval.ONE_MIN
      : clampedFaster === EXPECTED_MIN[plan];

  if (!okMin || !okMinutes || !okClamp) {
    failed++;
    console.error(`FAIL ${plan}`, { min, minutes, clampedFaster, allowed });
  } else {
    console.log(
      `OK  ${plan}: min=${min} (${minutes} min), clamp(ONE_MIN)→${clampedFaster}`
    );
  }
}

// Free (Basic) allows 12h and 24h only
const freeAllowed = getAllowedIntervals(Plan.FREE);
if (!freeAllowed.includes(MonitoringInterval.TWELVE_HOURS)) {
  failed++;
  console.error("FAIL FREE must allow TWELVE_HOURS");
}
if (!freeAllowed.includes(MonitoringInterval.TWENTY_FOUR_HOURS)) {
  failed++;
  console.error("FAIL FREE must allow TWENTY_FOUR_HOURS");
}
if (freeAllowed.includes(MonitoringInterval.SIX_HOURS)) {
  failed++;
  console.error("FAIL FREE must not allow SIX_HOURS");
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nAll monitoring interval checks passed.");
