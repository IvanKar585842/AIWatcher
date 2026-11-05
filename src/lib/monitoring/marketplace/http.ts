import { MonitorCheckError } from "../check-error";

export class ApiBudget {
  used = 0;

  constructor(private readonly maxCalls: number) {}

  charge(count = 1): void {
    if (this.used + count > this.maxCalls) {
      throw new MonitorCheckError(
        "Marketplace API call budget for this check is exhausted. The previous snapshot was kept.",
        true
      );
    }
    this.used += count;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MonitorCheckError("Marketplace API returned a response that was not valid JSON", true);
  }
}

export function amazonMarketplaceCode(hostname: string): string {
  const host = hostname.replace(/^www\./, "");
  if (host === "amazon.de") return "amazon_de";
  if (host === "amazon.com") return "amazon_com";
  if (host === "amazon.co.uk") return "amazon_uk";
  if (host === "amazon.fr") return "amazon_fr";
  if (host === "amazon.it") return "amazon_it";
  if (host === "amazon.es") return "amazon_es";
  if (host === "amazon.co.jp") return "amazon_jp";
  if (host === "amazon.ca") return "amazon_ca";
  return `amazon_${host.replace(/^amazon\./, "").replace(/\./g, "_")}`;
}

export function ebayMarketplaceCode(marketplaceId: string): string {
  return marketplaceId.toLowerCase();
}

const AMAZON_HOSTS: Record<string, { domain: string; version: string; currency: string }> = {
  "amazon.de": { domain: "www.amazon.de", version: "3.2", currency: "EUR" },
  "amazon.com": { domain: "www.amazon.com", version: "3.1", currency: "USD" },
  "amazon.ca": { domain: "www.amazon.ca", version: "3.1", currency: "CAD" },
  "amazon.com.mx": { domain: "www.amazon.com.mx", version: "3.1", currency: "MXN" },
  "amazon.co.uk": { domain: "www.amazon.co.uk", version: "3.2", currency: "GBP" },
  "amazon.fr": { domain: "www.amazon.fr", version: "3.2", currency: "EUR" },
  "amazon.it": { domain: "www.amazon.it", version: "3.2", currency: "EUR" },
  "amazon.es": { domain: "www.amazon.es", version: "3.2", currency: "EUR" },
  "amazon.nl": { domain: "www.amazon.nl", version: "3.2", currency: "EUR" },
  "amazon.se": { domain: "www.amazon.se", version: "3.2", currency: "SEK" },
  "amazon.pl": { domain: "www.amazon.pl", version: "3.2", currency: "PLN" },
  "amazon.com.be": { domain: "www.amazon.com.be", version: "3.2", currency: "EUR" },
  "amazon.com.tr": { domain: "www.amazon.com.tr", version: "3.2", currency: "TRY" },
  "amazon.co.jp": { domain: "www.amazon.co.jp", version: "3.3", currency: "JPY" },
  "amazon.com.au": { domain: "www.amazon.com.au", version: "3.3", currency: "AUD" },
  "amazon.sg": { domain: "www.amazon.sg", version: "3.3", currency: "SGD" },
  "amazon.in": { domain: "www.amazon.in", version: "3.2", currency: "INR" },
  "amazon.ae": { domain: "www.amazon.ae", version: "3.2", currency: "AED" },
  "amazon.sa": { domain: "www.amazon.sa", version: "3.2", currency: "SAR" },
  "amazon.eg": { domain: "www.amazon.eg", version: "3.2", currency: "EGP" },
  "amazon.com.br": { domain: "www.amazon.com.br", version: "3.1", currency: "BRL" },
};

export function amazonLocale(hostname: string): { domain: string; version: string; currency: string } | null {
  const host = hostname.replace(/^www\./, "");
  return AMAZON_HOSTS[host] ?? null;
}

export function tokenEndpointForVersion(version: string): string {
  if (version === "3.1") return "https://api.amazon.com/auth/o2/token";
  if (version === "3.3") return "https://api.amazon.co.jp/auth/o2/token";
  return "https://api.amazon.co.uk/auth/o2/token";
}

export function asinFromPath(pathname: string): string | null {
  const match = pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/|$)/i);
  return match ? match[1].toUpperCase() : null;
}

export function ebayLegacyId(pathname: string): string | null {
  const match = pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,15})(?:\/|$)/i);
  return match ? match[1] : null;
}

export function throwForStatus(status: number, body: unknown, provider: string): never {
  const message = errorMessage(body) ?? `${provider} HTTP ${status}`;
  if (status === 401 || status === 403) {
    throw new MonitorCheckError(`${provider} authentication failed. ${message}`, true);
  }
  if (status === 429) {
    throw new MonitorCheckError(`${provider} API quota exceeded. ${message}`, false);
  }
  if (status >= 500) {
    throw new MonitorCheckError(`${provider} HTTP ${status}. ${message}`, false);
  }
  throw new MonitorCheckError(`${provider} HTTP ${status}. ${message}`, true);
}

function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.message === "string") return record.message.slice(0, 240);
  const errors = record.errors;
  if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
    const first = errors[0] as Record<string, unknown>;
    const code = typeof first.code === "string" ? first.code : "";
    const text = typeof first.message === "string" ? first.message : "";
    return `${code} ${text}`.trim().slice(0, 240) || null;
  }
  return null;
}
