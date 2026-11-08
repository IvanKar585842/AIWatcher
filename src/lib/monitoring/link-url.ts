const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
  "ref_src",
];

/** Turn a pasted link into a stable public http(s) URL. Invalid text is returned unchanged. */
export function normalizeSubmittedUrl(raw: string): string {
  let value = raw.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  value = value.replace(/^['"]+|['"]+$/g, "");
  if (!value) return "";
  if (value.startsWith("//")) value = `https:${value}`;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return value;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.toString();
}
