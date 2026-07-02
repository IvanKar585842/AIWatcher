import { z } from "zod";
import {
  MonitoringInterval,
  MonitoringMode,
  NotificationMethod,
} from "@prisma/client";

const urlSchema = z.string().url("Please enter a valid URL");

const monitorBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  url: urlSchema,
  mode: z.nativeEnum(MonitoringMode),
  selector: z.string().max(500).optional(),
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
  category: z.string().optional(),
  importance: z.string().optional(),
  monitorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
export type SearchChangesInput = z.infer<typeof searchChangesSchema>;
