import { queueReconcileData } from "../src/lib/monitoring/queue";
import {
  CRON_BATCH_BUDGET_MS,
  CRON_MAX_SUCCESSES,
  partitionMonitorsByUrl,
  shouldContinueCron,
} from "../src/lib/monitoring/scheduler";

function assert(name: string, condition: boolean) {
  if (!condition) {
    console.error("FAIL", name);
    process.exitCode = 1;
    return;
  }
  console.log("PASS", name);
}

const when = new Date("2026-11-05T12:00:00.000Z");
const reconcile = queueReconcileData(when);
assert("reconcile keeps the schedule", reconcile.scheduledAt.getTime() === when.getTime());
assert(
  "reconcile does not clear a lock or attempt counter",
  !("lockedAt" in reconcile) && !("lockedBy" in reconcile) && !("attempts" in reconcile)
);

const split = partitionMonitorsByUrl([
  { id: "a", url: "https://example.com" },
  { id: "b", url: "https://example.com/docs" },
  { id: "c", url: "https://example.com" },
]);
assert("same URL is fetched once in a batch", split.process.map((item) => item.id).join() === "a,b");
assert("duplicate URL stays queued", split.defer.map((item) => item.id).join() === "c");

assert(
  "another batch starts after a success inside the budget",
  shouldContinueCron({
    startedAt: 0,
    now: 1_000,
    processed: 2,
    lastBatchSucceeded: 2,
  })
);
assert(
  "cron stops when the batch made no progress",
  !shouldContinueCron({
    startedAt: 0,
    now: 1_000,
    processed: 2,
    lastBatchSucceeded: 0,
  })
);
assert(
  "cron stops before the function timeout",
  !shouldContinueCron({
    startedAt: 0,
    now: CRON_BATCH_BUDGET_MS,
    processed: 2,
    lastBatchSucceeded: 2,
  })
);
assert(
  "cron stops at the success cap",
  !shouldContinueCron({
    startedAt: 0,
    now: 1_000,
    processed: CRON_MAX_SUCCESSES,
    lastBatchSucceeded: 1,
  })
);

if (!process.exitCode) console.log("scheduler guard checks passed");
