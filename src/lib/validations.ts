import { z } from "zod";
import {
  ChangeCategory,
  ChangeImportance,
  MonitoringInterval,
  MonitoringMode,
  NotificationMethod,
} from "@prisma/client";
import { validateMonitorUrl } from "@/lib/security/url";

const urlSchema = z
  .string()
  .url("Please enter a valid URL")
  .refine((url) => validateMonitorUrl(url).ok, {
    message: "This URL cannot be monitored (private or blocked address)",
  });

export const monitorConfigSchema = z.object({
  retryAttempts: z.number().int().min(1).max(10).optional(),
  timeout: z.number().int().min(5000).max(120000).optional(),
  ignoreCookies: z.boolean().optional(),
  ignoreTimestamps: z.boolean().optional(),
  ignoreAds: z.boolean().optional(),
  ignoreRandomIds: z.boolean().optional(),
  ignoreDynamicContent: z.boolean().optional(),
  archived: z.boolean().optional(),
  monitorTypeId: z.string().max(80).optional(),
});

const monitorBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: urlSchema,
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(30)).max(15).optional(),
  aiPrompt: z.string().max(4000).optional().nullable(),
  config: monitorConfigSchema.optional().nullable(),
  mode: z.nativeEnum(MonitoringMode),
  selector: z.string().max(500).optional().nullable(),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  interval: z.nativeEnum(MonitoringInterval),
  notificationMethod: z.nativeEnum(NotificationMethod),
  respectRobots: z.boolean().default(true),
});

export const createMonitorSchema = monitorBaseSchema
  .refine(
    (data) => {
      if (data.mode === MonitoringMode.CSS_SELECTOR || data.mode === MonitoringMode.XPATH) {
        return !!data.selector?.trim();
      }
      return true;
    },
    { message: "Selector is required for this monitoring mode", path: ["selector"] }
  )
  .refine(
    (data) => {
      if (data.mode === MonitoringMode.KEYWORD_DETECTION) {
        return (data.keywords?.length ?? 0) > 0;
      }
      return true;
    },
    { message: "At least one keyword is required", path: ["keywords"] }
  );

export const updateMonitorSchema = monitorBaseSchema.partial().extend({
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
});

export const searchChangesSchema = z.object({
  query: z.string().max(200).optional(),
  category: z.nativeEnum(ChangeCategory).optional(),
  importance: z.nativeEnum(ChangeImportance).optional(),
  monitorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
export type SearchChangesInput = z.infer<typeof searchChangesSchema>;
