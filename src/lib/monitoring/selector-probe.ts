export interface SelectorProbe {
  matched: number;
  sample: string | null;
  failed: string[];
  note: string;
}

/** Counts simple selectors in already-fetched HTML. It does not execute JavaScript. */
export function probeSelector(html: string, selector: string): SelectorProbe {
  const parts = selector.split(",").map((part) => part.trim()).filter(Boolean);
  const failed: string[] = [];
  let matched = 0;
  let sample: string | null = null;
  for (const part of parts) {
    const found = matchSimple(html, part);
    if (found == null || found.count === 0) {
      failed.push(part);
      continue;
    }
    matched += found.count;
    sample = sample ?? found.sample;
  }
  return {
    matched,
    sample,
    failed,
    note: failed.length
      ? `These selectors did not match the initial HTML: ${failed.join(", ")}. If the element is created by JavaScript, this is not proof it was deleted.`
      : "Matched in the initial HTML response.",
  };
}

function matchSimple(html: string, selector: string): { count: number; sample: string | null } | null {
  if (/[>+~:]/.test(selector) || selector.split(/\s+/).length > 2) return null;
  const attr = selector.match(/^\[([a-zA-Z0-9_-]+)(?:[~|^$*]?=["']([^"']+)["'])?\]$/);
  const id = selector.match(/^#([\w-]+)$/);
  const className = selector.match(/^\.([\w-]+)$/);
  const tag = selector.match(/^([a-zA-Z][\w-]*)$/);
  let pattern: RegExp | null = null;
  if (id) pattern = new RegExp(`<[^>]*id=["']${id[1]}["'][^>]*>([\\s\\S]*?)</`, "gi");
  else if (className) pattern = new RegExp(`<[^>]*class=["'][^"']*\\b${className[1]}\\b[^"']*["'][^>]*>([\\s\\S]*?)</`, "gi");
  else if (tag) {
    const voidTag = /^(img|br|hr|meta|link|input|source)$/i.test(tag[1]);
    pattern = voidTag
      ? new RegExp(`<${tag[1]}\\b[^>]*>`, "gi")
      : new RegExp(`<${tag[1]}\\b[^>]*>([\\s\\S]*?)</${tag[1]}>`, "gi");
  }
  else if (attr) {
    pattern = attr[2]
      ? new RegExp(`<[^>]*${attr[1]}=["']${attr[2]}["'][^>]*>`, "gi")
      : new RegExp(`<[^>]*\\b${attr[1]}=["'][^"']*["'][^>]*>`, "gi");
  }
  if (!pattern) return null;
  const matches = [...html.matchAll(pattern)];
  const text = matches[0]?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) || null;
  return { count: matches.length, sample: text };
}
