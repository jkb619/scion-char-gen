/**
 * Book-facing Purview label for the current pantheon: uses `signaturePurviewLabel`
 * when `purviewId` is that pantheon’s Signature Purview id (legacy Specialty renames).
 * @param {string} purviewId
 * @param {{ purviews?: Record<string, Record<string, unknown>>; pantheons?: Record<string, Record<string, unknown>> }} bundle
 * @param {string} [pantheonId]
 * @returns {string}
 */
export function purviewDisplayNameForPantheon(purviewId, bundle, pantheonId) {
  const pid = String(purviewId || "").trim();
  if (!pid) return "";
  const pp = String(pantheonId ?? "").trim();
  const pant = pp && bundle?.pantheons?.[pp] && typeof bundle.pantheons[pp] === "object" ? bundle.pantheons[pp] : null;
  const sig = pant && typeof pant.signaturePurviewId === "string" ? pant.signaturePurviewId.trim() : "";
  const lab = pant && typeof pant.signaturePurviewLabel === "string" ? pant.signaturePurviewLabel.trim() : "";
  if (sig && lab && sig === pid) return lab;
  const row = bundle?.purviews?.[pid];
  if (row && typeof row === "object" && typeof row.name === "string" && row.name.trim()) return row.name.trim();
  const spaced = pid.replace(/([A-Z])/g, " $1").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : pid;
}

/**
 * Deduped Purview id list for review sheet / interactive PDF. Export uses `purviews`;
 * older JSON may use `purviewIds`; patron slot picks may only appear in `patronPurviewSlots`.
 * @param {Record<string, unknown>} [data]
 * @returns {string[]}
 */
export function mergedPurviewIdsForSheet(data) {
  if (!data || typeof data !== "object") return [];
  /** @type {string[]} */
  const parts = [];
  const push = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const x of arr) {
      if (typeof x !== "string") continue;
      const id = x.trim();
      if (id) parts.push(id);
    }
  };
  push(data.purviews);
  push(data.purviewIds);
  push(data.patronPurviewSlots);
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const id of parts) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
