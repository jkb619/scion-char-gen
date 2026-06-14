/**
 * Legend trait effects (Scion: Demigod p. 132): Boon purchases per Legend dot;
 * Calling dots on even-numbered Legend dots. Tier Legend caps for sheet / export.
 */

import { isPostHeroBandCallingTierId } from "./eligibility.js";

/** @param {string | undefined} tierId */
function normTierId(tierId) {
  const t = String(tierId ?? "")
    .trim()
    .toLowerCase();
  return t === "origin" ? "mortal" : t;
}

/** Typical maximum Legend rating per tier band (sheet advisory cap). */
export const LEGEND_DOT_MAX_BY_TIER = {
  mortal: 1,
  hero: 4,
  demigod: 8,
  god: 12,
  sorcerer: 1,
  sorcerer_hero: 4,
  sorcerer_demigod: 8,
  sorcerer_god: 12,
  titanic: 4,
};

/** @param {string | undefined} tierId */
export function legendDotMaxForTier(tierId) {
  const t = normTierId(tierId);
  return LEGEND_DOT_MAX_BY_TIER[t] ?? 1;
}

/**
 * Typical minimum Legend to qualify as that tier (advisory).
 * @param {string | undefined} tierId
 */
export function legendBookMinForTier(tierId) {
  const t = normTierId(tierId);
  if (t === "mortal" || t === "sorcerer") return 0;
  if (t === "hero" || t === "titanic" || t === "sorcerer_hero") return 1;
  if (t === "demigod" || t === "sorcerer_demigod") return 4;
  if (t === "god" || t === "sorcerer_god") return 8;
  return 0;
}

/** Demigod+ bands where Legend trait advancement (Boons / Calling dots) is cited on the sheet. */
export function tierUsesLegendTraitEffects(tierId) {
  return isPostHeroBandCallingTierId(tierId);
}

/**
 * Purview Boon purchases earned from Legend dots (one per dot; Demigod p. 132).
 * @param {number} legendRating
 */
export function legendTraitBoonPurchasesFromRating(legendRating) {
  const n = Math.round(Number(legendRating) || 0);
  return Math.max(0, n);
}

/**
 * Calling dots earned on even-numbered Legend dots (Demigod p. 132).
 * @param {number} legendRating
 */
export function legendTraitCallingDotsFromRating(legendRating) {
  const n = Math.round(Number(legendRating) || 0);
  return Math.max(0, Math.floor(n / 2));
}

/**
 * Regular Purview Boons forgone for Dominion Boons (two per Purview; Demigod pp. 154–155).
 * @param {number} dominionPurviewCount
 */
export function dominionBoonPurviewBoonsForgone(dominionPurviewCount) {
  const n = Math.round(Number(dominionPurviewCount) || 0);
  return Math.max(0, n * 2);
}

/**
 * @param {number} legendRating
 * @param {string | undefined} tierId
 */
export function legendTraitEffectsSummary(legendRating, tierId) {
  if (!tierUsesLegendTraitEffects(tierId)) return null;
  const rating = Math.max(0, Math.round(Number(legendRating) || 0));
  const boons = legendTraitBoonPurchasesFromRating(rating);
  const callingDots = legendTraitCallingDotsFromRating(rating);
  return {
    legendRating: rating,
    maxLegend: legendDotMaxForTier(tierId),
    boonPurchasesFromLegend: boons,
    callingDotsFromEvenLegend: callingDots,
    summary: `At Legend ${rating}: ${boons} Purview Boon purchase${boons === 1 ? "" : "s"} (one per Legend dot); ${callingDots} Calling dot${callingDots === 1 ? "" : "s"} (each even-numbered Legend dot).`,
    source: "Scion: Demigod p. 132 (Legend trait effects)",
  };
}

/**
 * @param {string[]} dominionBoonPurviewIds
 * @param {string | undefined} tierId
 */
export function dominionBoonLedgerSummary(dominionBoonPurviewIds, tierId) {
  if (!isPostHeroBandCallingTierId(tierId)) return null;
  const ids = (dominionBoonPurviewIds || []).filter((id) => typeof id === "string" && id.trim());
  const count = ids.length;
  const forgone = dominionBoonPurviewBoonsForgone(count);
  return {
    dominionPurviewCount: count,
    dominionBoonPurviewIds: [...ids],
    purviewBoonsForgone: forgone,
    summary:
      count === 0
        ? "No Dominion Boons marked — each costs two regular Purview Boon purchases when taken in play."
        : `${count} Dominion Boon${count === 1 ? "" : "s"} marked (${forgone} regular Purview Boon purchases forgone).`,
    note: "Dominion replaces two separate regular Purview Boons with one Dominion Boon per Purview (Demigod pp. 154–155).",
  };
}
