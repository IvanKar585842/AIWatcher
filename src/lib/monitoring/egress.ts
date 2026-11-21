import { isIP } from "node:net";
import { validateMonitorUrl } from "@/lib/security/url";

/**
 * Public crawl addresses the owner has chosen to publish.
 * Empty means this deployment has not named a stable outbound address.
 * These are not the machine address of the WatchFlowing origin.
 */
export function publishedEgressIps(raw = process.env.WATCHFLOWING_EGRESS_IPS): string[] {
  const seen = new Set<string>();
  for (const part of (raw ?? "").split(/[,\s]+/)) {
    const ip = part.trim();
    if (!ip || !isIP(ip)) continue;
    const probe = ip.includes(":") ? `http://[${ip}]/` : `http://${ip}/`;
    if (!validateMonitorUrl(probe).ok) continue;
    seen.add(ip);
  }
  return [...seen];
}
