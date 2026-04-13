/**
 * Birthright catalog tag ids / display names (relicDetails / creatureDetails / top-level tagIds).
 * @param {Record<string, unknown> | null | undefined} br
 * @returns {string[]}
 */
export function birthrightTagIds(br) {
  const out = [];
  const add = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const id of arr) {
      const s = id != null ? String(id).trim() : "";
      if (s) out.push(s);
    }
  };
  if (!br || typeof br !== "object") return [];
  add(/** @type {any} */ (br).relicDetails?.tagIds);
  add(/** @type {any} */ (br).creatureDetails?.tagIds);
  add(/** @type {any} */ (br).tagIds);
  return [...new Set(out)];
}

/**
 * @param {Record<string, unknown> | null | undefined} br
 * @param {{ tags?: Record<string, { name?: string }> } | null | undefined} bundle
 * @returns {string[]}
 */
export function birthrightTagLabels(br, bundle) {
  const tags = bundle?.tags || {};
  return birthrightTagIds(br)
    .map((tid) => String(tags[tid]?.name || tid))
    .filter(Boolean);
}
