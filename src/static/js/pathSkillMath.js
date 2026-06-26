/** @typedef {"origin"|"role"|"society"} PathKey */

const PATH_KEYS = ["origin", "role", "society"];

/**
 * Raw Path priority dots (3 / 2 / 1) before the five-dot cap.
 * @param {Record<string, unknown>} bundle
 * @param {{ pathRank?: Record<string, string>; pathSkills?: Record<string, string[]> }} character
 * @returns {Record<string, number>}
 */
export function computeRawPathSkillDots(bundle, character) {
  /** @type {Record<string, number>} */
  const dots = {};
  for (const id of Object.keys(bundle?.skills || {})) {
    if (String(id).startsWith("_")) continue;
    dots[id] = 0;
  }
  const rankToDots = { primary: 3, secondary: 2, tertiary: 1 };
  const pr = character.pathRank || {};
  for (const rank of ["primary", "secondary", "tertiary"]) {
    const pathKey = pr[rank];
    const list = character.pathSkills?.[pathKey] || [];
    const add = rankToDots[rank] || 0;
    for (const sid of list) {
      if (!Object.hasOwn(dots, sid)) continue;
      dots[sid] += add;
    }
  }
  return dots;
}

/** @param {Record<string, unknown>} bundle @param {{ pathSkills?: Record<string, string[]> }} character */
export function pathSkillUnionSet(bundle, character) {
  const u = new Set();
  for (const pk of PATH_KEYS) {
    for (const sid of character.pathSkills?.[pk] || []) {
      if (!sid || String(sid).startsWith("_")) continue;
      if (bundle?.skills?.[sid]) u.add(sid);
    }
  }
  return u;
}

/** @param {Record<string, unknown>} bundle @param {{ pathRank?: Record<string, string>; pathSkills?: Record<string, string[]> }} character */
export function pathSkillTrimmedLostAndUnion(bundle, character) {
  const raw = computeRawPathSkillDots(bundle, character);
  /** @type {Record<string, number>} */
  const trimmed = {};
  let lost = 0;
  for (const sid of Object.keys(raw)) {
    const r = raw[sid] || 0;
    const ex = Math.max(0, r - 5);
    lost += ex;
    trimmed[sid] = r - ex;
  }
  return { raw, trimmed, lost, union: pathSkillUnionSet(bundle, character) };
}

/** @param {Record<string, number> | null | undefined} G */
export function sumPathSkillRedistribution(G) {
  let s = 0;
  if (!G || typeof G !== "object") return 0;
  for (const v of Object.values(G)) {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n > 0) s += n;
  }
  return s;
}

/**
 * @param {Record<string, number>} trimmed
 * @param {number} lost
 * @param {Set<string>} union
 * @param {Record<string, number>} G0
 */
export function sanitizePathSkillRedistribution(trimmed, lost, union, G0) {
  /** @type {Record<string, number>} */
  const G = {};
  if (lost <= 0) return G;
  for (const sid of union) {
    const g0 = Math.max(0, Math.round(Number(G0[sid]) || 0));
    if (g0 <= 0) continue;
    const cap = Math.max(0, 5 - (trimmed[sid] || 0));
    if (cap <= 0) continue;
    G[sid] = Math.min(g0, cap);
  }
  let sumG = sumPathSkillRedistribution(G);
  if (sumG > lost) {
    const order = [...union].sort();
    let excess = sumG - lost;
    for (const sid of order) {
      while (excess > 0 && (G[sid] || 0) > 0) {
        G[sid] -= 1;
        excess -= 1;
      }
    }
  }
  /** @type {Record<string, number>} */
  const out = {};
  for (const [k, v] of Object.entries(G)) {
    if (v > 0) out[k] = v;
  }
  return out;
}

/**
 * Final Path-layer skill dots (trim + redistribution), excluding Finishing / XP bumps.
 * @param {Record<string, unknown>} bundle
 * @param {{ pathRank?: Record<string, string>; pathSkills?: Record<string, string[]>; pathSkillRedistribution?: Record<string, number> }} character
 * @returns {Record<string, number>}
 */
export function pathOnlySkillDotsMap(bundle, character) {
  const { trimmed, lost, union } = pathSkillTrimmedLostAndUnion(bundle, character);
  let G = sanitizePathSkillRedistribution(trimmed, lost, union, character.pathSkillRedistribution || {});
  if (lost <= 0) G = {};
  /** @type {Record<string, number>} */
  const out = {};
  for (const sid of Object.keys(bundle?.skills || {})) {
    if (String(sid).startsWith("_")) continue;
    const t = trimmed[sid] || 0;
    const g = G[sid] || 0;
    out[sid] = Math.max(0, Math.min(5, t + g));
  }
  return out;
}

/**
 * Apply Path totals plus optional Finishing skill bumps into `character.skillDots`.
 * @param {Record<string, unknown>} bundle
 * @param {{ skillDots?: Record<string, number>; finishing?: { skillBaseline?: Record<string, number> | null; extraSkillDots?: number } }} character
 * @param {Record<string, number>} [finishingBumps] — per-skill Finishing dots (chargen)
 */
export function applyPathAndFinishingToSkillDots(bundle, character, finishingBumps = {}) {
  const pathOnly = pathOnlySkillDotsMap(bundle, character);
  if (!character.skillDots || typeof character.skillDots !== "object") character.skillDots = {};
  for (const sid of Object.keys(bundle?.skills || {})) {
    if (String(sid).startsWith("_")) continue;
    const po = pathOnly[sid] ?? 0;
    const fin = Math.max(0, Math.round(Number(finishingBumps[sid]) || 0));
    character.skillDots[sid] = Math.max(0, Math.min(5, po + fin));
  }
  if (!character.finishing || typeof character.finishing !== "object") character.finishing = {};
  character.finishing.skillBaseline = { ...pathOnly };
}
