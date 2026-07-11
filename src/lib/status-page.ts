import { z } from "zod";

export const USERNAME_REGEX = /^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$/;

const usernameValue = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(USERNAME_REGEX, "Use lowercase letters, numbers, and hyphens");

export const statusPageSettingsSchema = z.object({
  username: z
    .union([z.null(), z.literal("").transform(() => null), usernameValue])
    .optional(),
  statusPageEnabled: z.boolean().optional(),
  statusPageTitle: z
    .union([z.null(), z.string().trim().max(80)])
    .optional(),
});

export type PublicMonitorStatus = "operational" | "degraded" | "down" | "paused";

export function monitorPublicStatus(input: {
  status: string;
  errorCount: number;
}): PublicMonitorStatus {
  if (input.status === "PAUSED") return "paused";
  if (input.status === "ERROR") return "down";
  if (input.errorCount > 0) return "degraded";
  return "operational";
}

/** Heuristic uptime when no dedicated check ledger exists. */
export function estimateUptimePercent(input: {
  status: string;
  errorCount: number;
}): number {
  if (input.status === "PAUSED") return 100;
  if (input.status === "ERROR") return Math.max(0, Math.round(100 - input.errorCount * 8));
  if (input.errorCount === 0) return 100;
  return Math.max(85, Math.round(100 - input.errorCount * 3));
}

export const STATUS_LABELS: Record<PublicMonitorStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  paused: "Paused",
};
