/** localStorage key — mirrors DB productTourCompleted for offline/fallback. */
export const PRODUCT_TOUR_STORAGE_KEY = "wf-product-tour-done";

export const PRODUCT_TOUR_EVENTS = {
  START: "wf-start-product-tour",
  MAYBE_START: "wf-maybe-start-product-tour",
  OPEN_CREATE: "wf-tour-open-create-monitor",
  CLOSE_CREATE: "wf-tour-close-create-monitor",
} as const;

export type TourStepId =
  | "welcome"
  | "map"
  | "feed"
  | "assistant"
  | "monitors"
  | "create"
  | "settings"
  | "reports";

export type TourStepDef = {
  id: TourStepId;
  /** Navigate here before locating the target (omitted = stay). */
  route?: string;
  /** CSS selector for spotlight target; omit for centered welcome card. */
  selector?: string;
  title: string;
  body: string;
  /** Optional DOM/setup action before highlighting (tab switch, open dialog…). */
  prepare?: "feed-tab" | "assistant-tab" | "open-create" | "close-create" | "expand-notifications";
  primaryLabel?: string;
};

export const PRODUCT_TOUR_STEPS: TourStepDef[] = [
  {
    id: "welcome",
    title: "Welcome to WatchFlowing",
    body: "Let's quickly show you how everything works.",
    primaryLabel: "Start tour",
  },
  {
    id: "map",
    route: "/dashboard",
    selector: '[data-tour="global-map"]',
    title: "Global Monitor Map",
    body: "This shows all websites you are currently monitoring.",
  },
  {
    id: "feed",
    route: "/dashboard",
    selector: '[data-tour="intelligence-feed"]',
    title: "Intelligence Feed",
    body: "Here AI summarizes important changes detected on monitored websites.",
    prepare: "feed-tab",
  },
  {
    id: "assistant",
    route: "/dashboard",
    selector: '[data-tour="detection-assistant"]',
    title: "Detection Assistant",
    body: "Ask AI about detected changes and understand what happened.",
    prepare: "assistant-tab",
  },
  {
    id: "monitors",
    route: "/dashboard/monitors",
    selector: '[data-tour="create-monitor-trigger"]',
    title: "Monitors",
    body: "This is where you add websites you want WatchFlowing to monitor.",
  },
  {
    id: "create",
    route: "/dashboard/monitors",
    selector: '[data-tour="create-monitor-dialog"]',
    title: "Create a monitor",
    body: "You can choose what type of website changes you want to track — URL, monitoring options, and notification settings.",
    prepare: "open-create",
  },
  {
    id: "settings",
    route: "/dashboard/settings",
    selector: '[data-tour="settings-notifications"]',
    title: "Notifications",
    body: "Connect email and Telegram alerts to receive important changes.",
    prepare: "expand-notifications",
  },
  {
    id: "reports",
    route: "/dashboard/reports",
    selector: '[data-tour="weekly-report"]',
    title: "Weekly AI Business Report",
    body: "Receive summarized insights about your monitored websites.",
    primaryLabel: "Finish",
  },
];

export function readTourDoneLocal(): boolean {
  try {
    return localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTourDoneLocal(done: boolean): void {
  try {
    if (done) localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, "1");
    else localStorage.removeItem(PRODUCT_TOUR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
