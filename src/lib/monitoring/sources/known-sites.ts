export type KnownSiteKind = "docs" | "news" | "code";

export interface KnownSite {
  id: string;
  name: string;
  domain: string;
  kind: KnownSiteKind;
}

const site = (id: string, name: string, domain: string, kind: KnownSiteKind): KnownSite => ({
  id,
  name,
  domain,
  kind,
});

/** Public sites that monitor well as ordinary pages. Not storefronts. */
export const KNOWN_SITES: KnownSite[] = [
  site("mdn", "MDN", "developer.mozilla.org", "docs"),
  site("w3c", "W3C", "w3.org", "docs"),
  site("rfc", "RFC Editor", "rfc-editor.org", "docs"),
  site("python", "Python", "python.org", "docs"),
  site("nodejs", "Node.js", "nodejs.org", "docs"),
  site("react", "React", "react.dev", "docs"),
  site("rust", "Rust", "rust-lang.org", "docs"),
  site("go", "Go", "go.dev", "docs"),
  site("kubernetes", "Kubernetes", "kubernetes.io", "docs"),
  site("docker", "Docker", "docs.docker.com", "docs"),
  site("npm", "npm", "npmjs.com", "docs"),
  site("pypi", "PyPI", "pypi.org", "docs"),
  site("wikipedia", "Wikipedia", "wikipedia.org", "docs"),
  site("bbc", "BBC", "bbc.com", "news"),
  site("bbc-uk", "BBC", "bbc.co.uk", "news"),
  site("guardian", "The Guardian", "theguardian.com", "news"),
  site("reuters", "Reuters", "reuters.com", "news"),
  site("nature", "Nature", "nature.com", "news"),
  site("who", "WHO", "who.int", "news"),
  site("europa", "European Union", "europa.eu", "news"),
  site("govuk", "GOV.UK", "gov.uk", "news"),
  site("aljazeera", "Al Jazeera", "aljazeera.com", "news"),
  site("npr", "NPR", "npr.org", "news"),
  site("ap", "AP", "apnews.com", "news"),
  site("dw", "DW", "dw.com", "news"),
  site("tagesschau", "tagesschau", "tagesschau.de", "news"),
  site("france24", "France 24", "france24.com", "news"),
  site("lemonde", "Le Monde", "lemonde.fr", "news"),
  site("un", "United Nations", "un.org", "news"),
  site("github", "GitHub", "github.com", "code"),
  site("gitlab", "GitLab", "gitlab.com", "code"),
  site("codeberg", "Codeberg", "codeberg.org", "code"),
];

const BY_DOMAIN = new Map(KNOWN_SITES.map((entry) => [entry.domain, entry]));

export function lookupKnownSite(hostname: string): KnownSite | null {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  const exact = BY_DOMAIN.get(host);
  if (exact) return exact;
  let best: KnownSite | null = null;
  for (const entry of KNOWN_SITES) {
    if (host.endsWith(`.${entry.domain}`) && (!best || entry.domain.length > best.domain.length)) {
      best = entry;
    }
  }
  return best;
}

export function isNewsIndex(url: URL): boolean {
  if (lookupKnownSite(url.hostname)?.kind !== "news") return false;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return true;
  if (parts.length > 1) return false;
  return /^(news|world|international|uk|us|sport|business|politics|technology|science|culture|latest|index\.rss|rss)$/i.test(parts[0]);
}

/** A short public section such as /blog or /company/news. Homepages stay page checks. */
export function isContentIndexPath(url: URL): boolean {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0 || parts.length > 2) return false;
  const last = parts[parts.length - 1].replace(/\.(html|rss|xml)$/i, "");
  return /^(news|blog|press|press-releases|latest|world|updates|changelog|articles|stories|feed|rss)$/i.test(last);
}

export function knownSiteDetail(kind: KnownSiteKind): string {
  if (kind === "docs") {
    return "Documentation your company publishes. The main article text is compared. A browser runs only when the page is an empty script shell.";
  }
  if (kind === "news") {
    return "A news or blog page on your site. An RSS or Atom link on the same site is more precise. The page itself is still checked when you add it directly.";
  }
  return "A code host your company uses. A /releases URL uses the releases API. Other pages use the normal page check.";
}
