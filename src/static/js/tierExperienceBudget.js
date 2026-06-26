/**
 * Campaign pacing guide for Experience earned per tier (Origin/Hero/Demigod/God bands).
 * Used by random character generation to simulate post-chargen advancement spending.
 */

/** @typedef {{ min: number; max: number; typical: number }} TierXpBand */

/** @type {Record<string, TierXpBand>} */
const TIER_XP_BANDS = {
  mortal: { min: 0, max: 25, typical: 10 },
  hero: { min: 40, max: 150, typical: 85 },
  titanic: { min: 40, max: 150, typical: 85 },
  demigod: { min: 50, max: 200, typical: 110 },
  god: { min: 40, max: 200, typical: 100 },
  sorcerer: { min: 0, max: 25, typical: 8 },
  sorcerer_hero: { min: 40, max: 150, typical: 80 },
  sorcerer_demigod: { min: 50, max: 200, typical: 105 },
  sorcerer_god: { min: 40, max: 200, typical: 95 },
};

/**
 * @param {string} tierId
 * @returns {TierXpBand}
 */
export function tierExperienceBand(tierId) {
  const t = String(tierId || "mortal").trim().toLowerCase();
  return TIER_XP_BANDS[t] || TIER_XP_BANDS.mortal;
}

/**
 * Roll total XP earned during play for a tier (remaining pool; spending tracked separately).
 * @param {string} tierId
 * @param {() => number} rng — uniform [0, 1)
 * @returns {number}
 */
export function rollTierExperiencePool(tierId, rng) {
  const band = tierExperienceBand(tierId);
  if (band.max <= 0) return 0;
  const span = band.max - band.min;
  const bias = 0.35 + rng() * 0.3;
  const raw = band.min + span * bias;
  return Math.max(0, Math.round(raw));
}

/**
 * Parse `typicalLegendRange` like `"2–4"` or `"8–10+"` into [lo, hi].
 * @param {string | undefined} rangeText
 * @returns {[number, number]}
 */
export function parseLegendRange(rangeText) {
  const s = String(rangeText || "").trim();
  const m = s.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!m) return [0, 1];
  const lo = Math.max(0, Number(m[1]));
  const hi = Math.max(lo, Number(m[2]));
  return [lo, hi];
}

/**
 * @param {string} tierId
 * @param {{ tier?: Record<string, { typicalLegendRange?: string }> }} bundle
 * @param {() => number} rng
 * @returns {number}
 */
export function rollLegendRatingForTier(tierId, bundle, rng) {
  const row = bundle?.tier?.[tierId];
  const [lo, hi] = parseLegendRange(row?.typicalLegendRange);
  if (hi <= lo) return lo;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Dragon Heir: scale XP pool with Inheritance stage (Hero-like band at mid tiers).
 * @param {number} inheritance 1–10
 * @param {() => number} rng
 */
export function rollDragonInheritanceExperiencePool(inheritance, rng) {
  const inh = Math.max(1, Math.min(10, Math.round(Number(inheritance) || 1)));
  const band = inh <= 2 ? { min: 0, max: 25 } : inh <= 5 ? { min: 40, max: 120 } : { min: 50, max: 180 };
  const span = band.max - band.min;
  const bias = 0.35 + rng() * 0.3;
  return Math.max(0, Math.round(band.min + span * bias));
}
