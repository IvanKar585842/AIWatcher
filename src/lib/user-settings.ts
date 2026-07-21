import type { ChangeImportance, MonitoringInterval, MonitoringMode, NotificationMethod } from "@prisma/client";

export interface UserSettings {
  compactMode: boolean;
  emailNotifications: boolean;
  telegramNotifications: boolean;
  weeklySummary: boolean;
  instantAlerts: boolean;
  aiProvider: "openai" | "claude" | "gemini" | "auto";
  importanceThreshold: ChangeImportance;
  ignoreCosmeticChanges: boolean;
  aiPromptTemplates: string[];
  defaultInterval: MonitoringInterval;
  defaultMode: MonitoringMode;
  timezone: string;
  defaultNotificationMethod: NotificationMethod;
  analyticsEnabled: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  compactMode: false,
  emailNotifications: true,
  telegramNotifications: true,
  weeklySummary: true,
  instantAlerts: true,
  aiProvider: "auto",
  importanceThreshold: "MEDIUM",
  ignoreCosmeticChanges: true,
  aiPromptTemplates: [
    "Notify when documentation or release notes change.",
    "Ignore layout changes.",
    "Notify only when important information changes.",
  ],
  defaultInterval: "TWENTY_FOUR_HOURS",
  defaultMode: "ENTIRE_PAGE",
  timezone: "UTC",
  defaultNotificationMethod: "EMAIL",
  analyticsEnabled: true,
};

const STORAGE_KEY = "watchflow-user-settings";
const LEGACY_STORAGE_KEYS = ["WatchFlowing-user-settings", "watchflow-ai-user-settings"];

export function loadUserSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_USER_SETTINGS;
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      LEGACY_STORAGE_KEYS.map((k) => localStorage.getItem(k)).find(Boolean) ??
      null;
    if (!raw) return DEFAULT_USER_SETTINGS;
    return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export const TIMEZONE_OPTIONS = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

export const AI_PROVIDER_OPTIONS = [
  { value: "auto" as const, label: "Automatic (server default)" },
  { value: "openai" as const, label: "OpenAI" },
  { value: "claude" as const, label: "Claude" },
  { value: "gemini" as const, label: "Gemini" },
];

export const IMPORTANCE_OPTIONS: ChangeImportance[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
