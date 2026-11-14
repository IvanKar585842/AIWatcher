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
    title: "Global map of your sites",
    body: "These are the pages your company added.",
  },
  {
    id: "feed",
    route: "/dashboard",
    selector: '[data-tour="intelligence-feed"]',
    title: "What changed",
    body: "The assistant explains important changes on the sites your company owns.",
    prepare: "feed-tab",
  },
  {
    id: "assistant",
    route: "/dashboard",
    selector: '[data-tour="detection-assistant"]',
    title: "Ask the assistant",
    body: "Ask what changed on a page your company owns.",
    prepare: "assistant-tab",
  },
  {
    id: "monitors",
    route: "/dashboard/monitors",
    selector: '[data-tour="create-monitor-trigger"]',
    title: "Your sites",
    body: "Add a page your company owns.",
  },
  {
    id: "create",
    route: "/dashboard/monitors",
    selector: '[data-tour="create-monitor-dialog"]',
    title: "Add a page",
    body: "Name the page, paste its address, and choose what the assistant should explain.",
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
    body: "A weekly summary of what changed on the sites your company owns.",
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
