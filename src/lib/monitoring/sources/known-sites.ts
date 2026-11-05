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

export function knownSiteDetail(kind: KnownSiteKind): string {
  if (kind === "docs") {
    return "Public documentation. The main article text is compared. A browser runs only when the page is an empty script shell.";
  }
  if (kind === "news") {
    return "Public news page. An RSS or Atom link on the same site is more precise. The page itself is still fetched when you monitor it directly.";
  }
  return "Public code host. A /releases URL uses the releases API. Other public pages use the normal page check.";
}
