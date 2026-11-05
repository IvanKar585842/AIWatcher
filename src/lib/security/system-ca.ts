import tls from "node:tls";

let installed = false;

/**
 * Trust the OS certificate store in addition to Node's bundled roots.
 * Does not disable verification. Used when Windows has a root Node does not.
 */
export function installSystemCa(): boolean {
  if (installed) return true;
  const api = tls as typeof tls & {
    getCACertificates?: (type: "default" | "system") => string[];
    setDefaultCACertificates?: (certs: readonly string[]) => void;
  };
  if (typeof api.getCACertificates !== "function" || typeof api.setDefaultCACertificates !== "function") {
    return false;
  }
  try {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const cert of [...api.getCACertificates("default"), ...api.getCACertificates("system")]) {
      if (!cert || seen.has(cert)) continue;
      seen.add(cert);
      merged.push(cert);
    }
    if (merged.length === 0) return false;
    api.setDefaultCACertificates(merged);
    installed = true;
    return true;
  } catch {
    return false;
  }
}
