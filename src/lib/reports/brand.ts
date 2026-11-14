export type WorkspaceBrand = { brandName: string | null; hidePoweredBy: boolean };

/** Reads only the reserved brand object. Other workspace settings stay untouched. */
export function readWorkspaceBrand(settings: unknown): WorkspaceBrand {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { brandName: null, hidePoweredBy: false };
  }
  const brand = (settings as { brand?: unknown }).brand;
  if (!brand || typeof brand !== "object" || Array.isArray(brand)) {
    return { brandName: null, hidePoweredBy: false };
  }
  const name = typeof (brand as { name?: unknown }).name === "string" ? (brand as { name: string }).name.trim() : "";
  const hidePoweredBy = (brand as { hidePoweredBy?: unknown }).hidePoweredBy === true;
  return { brandName: name.slice(0, 80) || null, hidePoweredBy };
}
