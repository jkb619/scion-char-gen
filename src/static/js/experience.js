/**
 * Experience advancement (Origin p. 113 / Hero p. 185; S&M p. 87 for Boon / Technique).
 * @typedef {{ cost?: number; object?: string; change?: string }} ExperienceCostRow
 */

/** @param {unknown} character */
export function experiencePointsAvailable(character) {
  return Math.max(0, Math.round(Number(character?.experiencePoints) || 0));
}

/** Lifetime XP spent through this app’s Exp Leveling purchases. */
export function experiencePointsSpent(character) {
  return Math.max(0, Math.round(Number(/** @type {{ experiencePointsSpent?: number }} */ (character)?.experiencePointsSpent) || 0));
}

/** Total XP earned in play (remaining pool + spent). */
export function experiencePointsTotal(character) {
  return experiencePointsAvailable(character) + experiencePointsSpent(character);
}

/** @param {unknown} data — export / sheet snapshot */
export function sheetExperienceTotals(data) {
  const remaining = Math.max(
    0,
    Math.round(Number(data?.experiencePointsRemaining ?? data?.experiencePoints) || 0),
  );
  const spent = Math.max(0, Math.round(Number(data?.experiencePointsSpent) || 0));
  const totalRaw = data?.experiencePointsTotal;
  const total =
    totalRaw != null && totalRaw !== "" && !Number.isNaN(Number(totalRaw))
      ? Math.max(0, Math.round(Number(totalRaw)))
      : remaining + spent;
  return { total, remaining, spent };
}

/** @param {Record<string, unknown> | null | undefined} bundle @param {string} key */
export function experiencePurchaseCost(bundle, key) {
  const row = bundle?.experienceAdvancement?.costs?.[key];
  if (!row || typeof row !== "object") return null;
  const c = Math.round(Number(/** @type {{ cost?: number }} */ (row).cost));
  return Number.isFinite(c) && c > 0 ? c : null;
}

/** @param {unknown} character @param {Record<string, unknown> | null | undefined} bundle @param {string} key */
export function experienceCanAfford(character, bundle, key) {
  const cost = experiencePurchaseCost(bundle, key);
  if (cost == null) return false;
  return experiencePointsAvailable(character) >= cost;
}

/**
 * @param {unknown} character
 * @param {Record<string, unknown> | null | undefined} bundle
 * @param {string} key
 * @returns {boolean}
 */
export function experienceSpend(character, bundle, key) {
  const cost = experiencePurchaseCost(bundle, key);
  if (cost == null || !character || typeof character !== "object") return false;
  const cur = experiencePointsAvailable(character);
  if (cur < cost) return false;
  /** @type {{ experiencePoints?: number; experiencePointsSpent?: number }} */ (character).experiencePoints = cur - cost;
  character.experiencePointsSpent = experiencePointsSpent(character) + cost;
  return true;
}

/**
 * Refund one purchase (e.g. deselecting an XP Knack).
 * @param {unknown} character
 * @param {Record<string, unknown> | null | undefined} bundle
 * @param {string} key
 * @returns {boolean}
 */
export function experienceRefund(character, bundle, key) {
  const cost = experiencePurchaseCost(bundle, key);
  if (cost == null || !character || typeof character !== "object") return false;
  /** @type {{ experiencePoints?: number; experiencePointsSpent?: number }} */ (character).experiencePoints =
    experiencePointsAvailable(character) + cost;
  character.experiencePointsSpent = Math.max(0, experiencePointsSpent(character) - cost);
  return true;
}

/** @param {Record<string, unknown> | null | undefined} bundle */
export function experienceAdvancementTableRows(bundle) {
  const costs = bundle?.experienceAdvancement?.costs;
  if (!costs || typeof costs !== "object") return [];
  return Object.entries(costs)
    .filter(([k]) => k && !k.startsWith("_"))
    .map(([, row]) => row)
    .filter((row) => row && typeof row === "object")
    .sort((a, b) => {
      const ca = Number(/** @type {{ cost?: number }} */ (a).cost) || 0;
      const cb = Number(/** @type {{ cost?: number }} */ (b).cost) || 0;
      if (ca !== cb) return ca - cb;
      return String(/** @type {{ object?: string }} */ (a).object || "").localeCompare(
        String(/** @type {{ object?: string }} */ (b).object || ""),
      );
    });
}

/** @param {Record<string, unknown> | null | undefined} bundle */
export function experienceTableSummaryTitle(bundle) {
  return experienceAdvancementTableRows(bundle)
    .map((row) => {
      const r = /** @type {{ object?: string; cost?: number }} */ (row);
      return `${r.object || "?"}: ${r.cost ?? "?"} XP`;
    })
    .join("; ");
}

/** @param {unknown} character */
export function ensureExperienceAdvancementBumps(character) {
  if (!character || typeof character !== "object") return;
  const c = /** @type {{ experienceAttributeBumps?: Record<string, number>; experienceSkillBumps?: Record<string, number> }} */ (
    character
  );
  if (!c.experienceAttributeBumps || typeof c.experienceAttributeBumps !== "object") {
    c.experienceAttributeBumps = {};
  }
  if (!c.experienceSkillBumps || typeof c.experienceSkillBumps !== "object") {
    c.experienceSkillBumps = {};
  }
}

/** @param {unknown} character @param {string} attrId */
export function experienceAttributeBumpCount(character, attrId) {
  ensureExperienceAdvancementBumps(character);
  const id = String(attrId || "").trim();
  if (!id) return 0;
  const n = Math.round(
    Number(/** @type {{ experienceAttributeBumps?: Record<string, number> }} */ (character).experienceAttributeBumps?.[id]) ||
      0,
  );
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** @param {unknown} character @param {string} skillId */
export function experienceSkillBumpCount(character, skillId) {
  ensureExperienceAdvancementBumps(character);
  const id = String(skillId || "").trim();
  if (!id) return 0;
  const n = Math.round(
    Number(/** @type {{ experienceSkillBumps?: Record<string, number> }} */ (character).experienceSkillBumps?.[id]) || 0,
  );
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** @param {unknown} character */
export function experienceAttributeBumpsTotal(character) {
  ensureExperienceAdvancementBumps(character);
  const bumps = /** @type {{ experienceAttributeBumps?: Record<string, number> }} */ (character).experienceAttributeBumps;
  return Object.values(bumps || {}).reduce((sum, n) => {
    const v = Math.round(Number(n) || 0);
    return sum + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);
}

/** @param {unknown} character */
export function experienceSkillBumpsTotal(character) {
  ensureExperienceAdvancementBumps(character);
  const bumps = /** @type {{ experienceSkillBumps?: Record<string, number> }} */ (character).experienceSkillBumps;
  return Object.values(bumps || {}).reduce((sum, n) => {
    const v = Math.round(Number(n) || 0);
    return sum + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);
}

/** @param {unknown} character @param {string} attrId */
export function recordExperienceAttributeBump(character, attrId) {
  ensureExperienceAdvancementBumps(character);
  const id = String(attrId || "").trim();
  if (!id) return;
  /** @type {{ experienceAttributeBumps: Record<string, number> }} */ (character).experienceAttributeBumps[id] =
    experienceAttributeBumpCount(character, id) + 1;
}

/** @param {unknown} character @param {string} skillId */
export function recordExperienceSkillBump(character, skillId) {
  ensureExperienceAdvancementBumps(character);
  const id = String(skillId || "").trim();
  if (!id) return;
  /** @type {{ experienceSkillBumps: Record<string, number> }} */ (character).experienceSkillBumps[id] =
    experienceSkillBumpCount(character, id) + 1;
}
