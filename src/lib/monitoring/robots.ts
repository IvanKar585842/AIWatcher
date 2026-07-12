import { MonitoringMode } from "@prisma/client";
import { fetchWithSafeRedirects } from "@/lib/security/url";

const BOT_ALIASES = new Set(["*", "watchflowing", "WatchFlowing", "WatchFlowAI", "watchflowai"]);

interface RobotsRule {
  type: "allow" | "disallow";
  path: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

/**
 * Visual snapshot monitoring is user-initiated comparison, not search indexing.
 * Sites like Facebook block all crawlers via robots.txt (Disallow: /) but users
 * still need to compare visual appearance of pages they follow.
 */
export function shouldEnforceRobotsTxt(
  mode: MonitoringMode,
  respectRobots: boolean
): boolean {
  if (!respectRobots) return false;

  if (
    mode === MonitoringMode.VISUAL_CHANGES ||
    mode === MonitoringMode.SCREENSHOT_DIFF
  ) {
    return false;
  }

  return true;
}

function parseRobotsTxt(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (directive === "disallow" || directive === "allow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      current.rules.push({ type: directive, path: value });
    }
  }

  return groups;
}

function pathMatches(rulePath: string, urlPath: string): boolean {
  if (rulePath === "" || rulePath === "/") {
    return urlPath === "/" || urlPath.startsWith("/");
  }
  return urlPath.startsWith(rulePath);
}

function findApplicableGroup(groups: RobotsGroup[]): RobotsGroup | undefined {
  let wildcard: RobotsGroup | undefined;

  for (const group of groups) {
    for (const agent of group.agents) {
      if (BOT_ALIASES.has(agent)) {
        if (agent !== "*") return group;
        wildcard = group;
      }
    }
  }

  return wildcard;
}

function isPathAllowed(group: RobotsGroup, urlPath: string): boolean {
  let best: { type: "allow" | "disallow"; length: number } | null = null;

  for (const rule of group.rules) {
    if (!pathMatches(rule.path, urlPath)) continue;

    const length = rule.path.length;
    if (
      !best ||
      length > best.length ||
      (length === best.length && rule.type === "allow")
    ) {
      best = { type: rule.type, length };
    }
  }

  if (!best) return true;
  return best.type === "allow";
}

export async function isUrlAllowedByRobotsTxt(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const response = await fetchWithSafeRedirects(`${parsed.origin}/robots.txt`, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot)" },
    });

    if (!response.ok) return true;

    const group = findApplicableGroup(parseRobotsTxt(await response.text()));
    if (!group) return true;

    return isPathAllowed(group, parsed.pathname || "/");
  } catch {
    return true;
  }
}

export function robotsTxtBlockedMessage(url: string): string {
  return (
    `Access denied by robots.txt for ${new URL(url).hostname}. ` +
    `Disable "Respect robots.txt" in monitor settings if you have permission to monitor this page.`
  );
}
