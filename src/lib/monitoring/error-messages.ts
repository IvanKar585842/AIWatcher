/**
 * User-facing monitoring error classification.
 * Maps raw technical failures into product-quality messages
 * while preserving technical details for "Advanced details".
 */

export type MonitoringErrorKind =
  | "SUCCESS"
  | "WARNING"
  | "BLOCKED"
  | "TEMPORARILY_UNAVAILABLE"
  | "INVALID_URL"
  | "TIMEOUT"
  | "NOT_FOUND"
  | "SELECTOR_MISSING"
  | "ROBOTS_BLOCKED"
  | "UNKNOWN";

export type MonitoringErrorTone = "red" | "amber" | "zinc" | "emerald";

export interface MonitoringErrorInfo {
  kind: MonitoringErrorKind;
  title: string;
  description: string;
  suggestions: string[];
  statusLabel: string;
  technical: string | null;
  tone: MonitoringErrorTone;
  /** Lucide-ish icon key for UI */
  icon: "shield" | "clock" | "wifi-off" | "alert" | "link" | "check" | "bot";
}

const KIND_COPY: Record<
  Exclude<MonitoringErrorKind, "SUCCESS">,
  Omit<MonitoringErrorInfo, "kind" | "technical">
> = {
  BLOCKED: {
    title: "Website blocked automated monitoring",
    description:
      "This website does not allow automated tools to access its pages. This is usually caused by anti-bot protection or security settings.",
    suggestions: [
      "Try another public page on the same site",
      "Use a page without bot protection",
      "Use API / RSS monitoring if the site provides it",
    ],
    statusLabel: "Monitoring unavailable",
    tone: "red",
    icon: "shield",
  },
  TEMPORARILY_UNAVAILABLE: {
    title: "Website temporarily unavailable",
    description:
      "The website did not respond correctly during the check. This may be temporary or caused by traffic protection.",
    suggestions: ["Retry the check now", "Try again later", "Confirm the site loads in your browser"],
    statusLabel: "Temporarily unavailable",
    tone: "amber",
    icon: "wifi-off",
  },
  TIMEOUT: {
    title: "Check timed out",
    description:
      "The page took too long to load. Slow servers, heavy scripts, or network delays can cause this.",
    suggestions: [
      "Retry the check",
      "Try a lighter page URL",
      "Increase patience and check again later",
    ],
    statusLabel: "Timeout",
    tone: "amber",
    icon: "clock",
  },
  INVALID_URL: {
    title: "This URL cannot be monitored",
    description:
      "The address is invalid or not allowed for security reasons (for example private/internal networks).",
    suggestions: [
      "Double-check the URL starts with https://",
      "Use a public website address",
      "Remove login credentials from the URL",
    ],
    statusLabel: "Invalid URL",
    tone: "red",
    icon: "link",
  },
  NOT_FOUND: {
    title: "Page not found",
    description: "The website returned a not-found response. The URL may have moved or been removed.",
    suggestions: ["Open the URL in your browser", "Update the monitor to the correct page"],
    statusLabel: "Page not found",
    tone: "amber",
    icon: "alert",
  },
  SELECTOR_MISSING: {
    title: "Target element not found",
    description:
      "The CSS selector or XPath did not match anything on the page. The layout may have changed.",
    suggestions: [
      "Verify the selector in browser DevTools",
      "Update the selector after a redesign",
      "Switch to Entire Page mode temporarily",
    ],
    statusLabel: "Selector missing",
    tone: "amber",
    icon: "alert",
  },
  ROBOTS_BLOCKED: {
    title: "Blocked by robots.txt",
    description:
      "The site’s robots.txt rules disallow automated access for this path. You can disable “Respect robots.txt” only if you have permission to monitor the page.",
    suggestions: [
      "Choose a different public URL",
      "Disable Respect robots.txt only if allowed",
      "Use Visual mode where robots rules are relaxed",
    ],
    statusLabel: "Robots.txt blocked",
    tone: "amber",
    icon: "bot",
  },
  WARNING: {
    title: "Check completed with a warning",
    description: "The check finished, but something needs your attention.",
    suggestions: ["Review the technical details", "Retry if the issue looks temporary"],
    statusLabel: "Warning",
    tone: "amber",
    icon: "alert",
  },
  UNKNOWN: {
    title: "Monitoring check failed",
    description:
      "Something went wrong while checking this website. Retry the check, or review advanced details if the problem continues.",
    suggestions: ["Retry the check", "Confirm the site loads in your browser", "Contact support if it keeps failing"],
    statusLabel: "Check failed",
    tone: "red",
    icon: "alert",
  },
};

interface StoredErrorV1 {
  v: 1;
  kind: MonitoringErrorKind;
  title?: string;
  technical?: string | null;
}

function fromKind(
  kind: Exclude<MonitoringErrorKind, "SUCCESS">,
  technical: string | null,
  titleOverride?: string
): MonitoringErrorInfo {
  const base = KIND_COPY[kind];
  return {
    kind,
    ...base,
    title: titleOverride?.trim() || base.title,
    technical,
  };
}

function extractHttpStatus(message: string): number | null {
  const m =
    message.match(/\bHTTP\s+(\d{3})\b/i) ||
    message.match(/\bstatus(?:\s*code)?[:\s]+(\d{3})\b/i);
  if (!m) return null;
  const code = Number(m[1]);
  return Number.isFinite(code) ? code : null;
}

function kindFromHttp(status: number): Exclude<MonitoringErrorKind, "SUCCESS"> {
  if (status === 401 || status === 403 || status === 407 || status === 429) return "BLOCKED";
  if (status === 404 || status === 410) return "NOT_FOUND";
  if (status === 408 || status === 425) return "TIMEOUT";
  if (status >= 500 && status <= 504) return "TEMPORARILY_UNAVAILABLE";
  if (status >= 500) return "TEMPORARILY_UNAVAILABLE";
  if (status >= 400) return "WARNING";
  return "UNKNOWN";
}

export function getSuccessMonitoringStatus(): MonitoringErrorInfo {
  return {
    kind: "SUCCESS",
    title: "Monitoring healthy",
    description: "The latest check completed successfully.",
    suggestions: [],
    statusLabel: "OK",
    technical: null,
    tone: "emerald",
    icon: "check",
  };
}

/**
 * Classify a thrown error or legacy stored string into a user-facing info object.
 */
export function classifyMonitoringError(raw: unknown): MonitoringErrorInfo {
  const technical =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : raw == null
          ? null
          : String(raw);

  const message = (technical ?? "").trim();
  if (!message) {
    return fromKind("UNKNOWN", null);
  }

  // Already stored structured payload
  const stored = tryParseStored(message);
  if (stored) return stored;

  const lower = message.toLowerCase();
  const http = extractHttpStatus(message);

  if (
    lower.includes("robots.txt") ||
    lower.includes("access denied by robots")
  ) {
    return fromKind("ROBOTS_BLOCKED", message);
  }

  if (
    lower.includes("selector not found") ||
    lower.includes("xpath not found") ||
    lower.includes("css selector is required") ||
    lower.includes("xpath is required")
  ) {
    return fromKind("SELECTOR_MISSING", message);
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborted") ||
    lower.includes("deadline")
  ) {
    return fromKind("TIMEOUT", message);
  }

  if (
    lower.includes("not allowed") ||
    lower.includes("invalid url") ||
    lower.includes("private network") ||
    lower.includes("could not resolve url") ||
    lower.includes("only http")
  ) {
    return fromKind("INVALID_URL", message);
  }

  if (
    lower.includes("navigation returned no response") ||
    lower.includes("net::") ||
    lower.includes("err_connection") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound")
  ) {
    return fromKind("TEMPORARILY_UNAVAILABLE", message);
  }

  if (http != null) {
    return fromKind(kindFromHttp(http), message);
  }

  // Friendly titles already stored as plain text
  for (const [kind, copy] of Object.entries(KIND_COPY) as Array<
    [Exclude<MonitoringErrorKind, "SUCCESS">, (typeof KIND_COPY)[Exclude<MonitoringErrorKind, "SUCCESS">]]
  >) {
    if (message === copy.title || message.startsWith(copy.title)) {
      return fromKind(kind, null, copy.title);
    }
  }

  return fromKind("UNKNOWN", message);
}

function tryParseStored(raw: string): MonitoringErrorInfo | null {
  if (!raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw) as StoredErrorV1;
    if (parsed?.v !== 1 || !parsed.kind || parsed.kind === "SUCCESS") return null;
    return fromKind(
      parsed.kind as Exclude<MonitoringErrorKind, "SUCCESS">,
      parsed.technical ?? null,
      parsed.title
    );
  } catch {
    return null;
  }
}

/** Persist a compact structured error for monitors.errorMessage */
export function serializeMonitorError(info: MonitoringErrorInfo): string {
  const payload: StoredErrorV1 = {
    v: 1,
    kind: info.kind,
    title: info.title,
    technical: info.technical,
  };
  return JSON.stringify(payload);
}

/** Short line for cards / lists */
export function monitorErrorSummary(errorMessage: string | null | undefined): string | null {
  if (!errorMessage) return null;
  return classifyMonitoringError(errorMessage).title;
}

export function isBlockedMonitoringError(info: MonitoringErrorInfo): boolean {
  return info.kind === "BLOCKED" || info.kind === "ROBOTS_BLOCKED";
}
