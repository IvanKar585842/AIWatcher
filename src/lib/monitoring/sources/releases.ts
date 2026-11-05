import { MonitorCheckError } from "../check-error";
import { fetchWithSafeRedirects } from "@/lib/security/url";
import { makeRecord } from "./records";
import type { FetchLike, SourceRecord } from "./types";

export async function fetchGitHubReleases(
  owner: string,
  repo: string,
  maxResults: number,
  fetchImpl?: FetchLike
): Promise<SourceRecord[]> {
  const run = fetchImpl ?? fetchWithSafeRedirects;
  const response = await run(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=${Math.min(10, maxResults)}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "WatchFlowing/1.0 (+https://watchflowing.com/bot; monitoring service)",
    },
  });
  if (response.status === 404) throw new MonitorCheckError("GitHub repository or releases were not found", true);
  if (!response.ok) {
    throw new MonitorCheckError(`HTTP ${response.status} loading GitHub releases API`, response.status >= 500 || response.status === 429);
  }
  const payload = (await response.json()) as Array<Record<string, unknown>>;
  return (Array.isArray(payload) ? payload : []).slice(0, maxResults).map((release) => {
    const version = typeof release.tag_name === "string" ? release.tag_name : null;
    const title = typeof release.name === "string" ? release.name : version;
    const body = typeof release.body === "string" ? release.body.replace(/\s+/g, " ").trim().slice(0, 500) : null;
    return makeRecord({
      sourceType: "release",
      adapter: "github-releases",
      id: version ?? String(release.id ?? title),
      title,
      url: typeof release.html_url === "string" ? release.html_url : `https://github.com/${owner}/${repo}/releases/tag/${version}`,
      summary: body,
      content: body,
      publishedAt: typeof release.published_at === "string" ? release.published_at : null,
      updatedAt: null,
      author: null,
      publisher: `${owner}/${repo}`,
      version,
      imageUrl: null,
      price: null,
      currency: null,
      availability: null,
      seller: null,
      variant: null,
      condition: null,
    });
  });
}

export function githubReleaseTarget(url: URL): { owner: string; repo: string } | null {
  if (!/^github\.com$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/releases\/?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}
