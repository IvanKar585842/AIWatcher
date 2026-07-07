import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),
  AI_PROVIDER: z.enum(["openai", "claude", "gemini"]).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv | null {
  const parsed = serverEnvSchema.safeParse(process.env);
  return parsed.success ? parsed.data : null;
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
}

export function validateProductionEnv(): { ok: boolean; issues: string[] } {
  const required = ["DATABASE_URL", "CRON_SECRET"] as const;
  const issues = required.filter((key) => !process.env[key]);
  return { ok: issues.length === 0, issues: [...issues] };
}
