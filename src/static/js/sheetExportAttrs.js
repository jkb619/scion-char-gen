/** Favored Approach → +2 to each listed Attribute (pre–Favored ratings), max 5 after. */
const APPROACH_ATTRS = {
  Force: ["might", "intellect", "presence"],
  Finesse: ["dexterity", "cunning", "manipulation"],
  Resilience: ["stamina", "resolve", "composure"],
};

/**
 * @param {Record<string, number | undefined>} baseAttrs
 * @param {string} [favoredApproach]
 * @returns {Record<string, number>}
 */
export function applyFavoredApproachToPre(baseAttrs, favoredApproach) {
  const fav = APPROACH_ATTRS[favoredApproach] ? favoredApproach : "Force";
  const out = { ...baseAttrs };
  for (const id of APPROACH_ATTRS[fav]) {
    out[id] = (out[id] ?? 1) + 2;
  }
  for (const id of Object.keys(out)) {
    if (out[id] > 5) out[id] = 5;
  }
  return out;
}

/**
 * Post–Favored Approach attribute dots for sheets and PDFs.
 * Prefers `attributesIncludingFinishingBeforeFavored` (full pre–Favored, including Origin Finishing bumps)
 * when present; otherwise falls back to legacy single-block exports.
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} bundle
 * @returns {Record<string, number>}
 */
export function sheetFinalAttrsAfterFavored(data, bundle) {
  const attrKeys = Object.keys(bundle?.attributes || {}).filter((k) => !String(k).startsWith("_"));
  const clampPre = (/** @type {Record<string, unknown>} */ src) => {
    /** @type {Record<string, number>} */
    const pre = {};
    for (const id of attrKeys) {
      const v = src[id];
      pre[id] = v == null || Number.isNaN(Number(v)) ? 1 : Math.max(1, Math.min(5, Math.round(Number(v))));
    }
    return pre;
  };

  const inc = data.attributesIncludingFinishingBeforeFavored;
  if (inc && typeof inc === "object") {
    const fav = typeof data.favoredApproach === "string" ? data.favoredApproach : "Force";
    return applyFavoredApproachToPre(clampPre(inc), fav);
  }

  const before = data.attributesBeforeFavored && typeof data.attributesBeforeFavored === "object" ? data.attributesBeforeFavored : null;
  if (before) {
    const fav = typeof data.favoredApproach === "string" ? data.favoredApproach : "Force";
    return applyFavoredApproachToPre(clampPre(before), fav);
  }

  const afterOnly = data.attributesAfterFavored && typeof data.attributesAfterFavored === "object" ? data.attributesAfterFavored : {};
  /** @type {Record<string, number>} */
  const out = {};
  for (const id of attrKeys) {
    const v = afterOnly[id];
    out[id] = v == null || Number.isNaN(Number(v)) ? 1 : Math.max(1, Math.min(5, Math.round(Number(v))));
  }
  return out;
}

/**
 * Full Skill ratings (Path + redistribution + Finishing Skill dots) for sheets / PDFs.
 * Prefers `skillsIncludingFinishing` when present on export payloads.
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} bundle
 * @returns {Record<string, number>}
 */
export function sheetFinalSkillDots(data, bundle) {
  const inc = data.skillsIncludingFinishing && typeof data.skillsIncludingFinishing === "object" ? data.skillsIncludingFinishing : null;
  const sk = data.skills && typeof data.skills === "object" ? data.skills : {};
  const src = inc || sk;
  /** @type {Record<string, number>} */
  const out = {};
  for (const sid of Object.keys(bundle?.skills || {})) {
    if (String(sid).startsWith("_")) continue;
    const v = src[sid];
    out[sid] = v == null || Number.isNaN(Number(v)) ? 0 : Math.max(0, Math.min(5, Math.round(Number(v))));
  }
  return out;
}
