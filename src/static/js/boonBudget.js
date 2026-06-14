/**
 * Boon purchase budget: Hero-band wizard cap; Demigod+ Legend dots (p. 132) + Experience extras.
 * Dominion marks cost two Purview Boons — paid by forgoing two sheet Boons or reserving Legend purchases.
 */

import { maxWizardBoonPicksForTier, boonPrimaryPurview } from "./eligibility.js";
import {
  legendTraitBoonPurchasesFromRating,
  tierUsesLegendTraitEffects,
} from "./legendTrait.js";

export const DOMINION_BOON_FORGONE_COST = 2;

/** @param {unknown} character */
export function experienceBoonIdSet(character) {
  const raw = character?.experienceBoonIds;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")));
}

/** @param {unknown} character */
export function ensureDominionForgoneShape(character) {
  if (!character || typeof character !== "object") return;
  if (!character.dominionBoonForgoneByPurview || typeof character.dominionBoonForgoneByPurview !== "object") {
    character.dominionBoonForgoneByPurview = {};
  }
  if (!character.dominionBoonForgoneXpByPurview || typeof character.dominionBoonForgoneXpByPurview !== "object") {
    character.dominionBoonForgoneXpByPurview = {};
  }
}

/**
 * @param {unknown} character
 * @param {string} purviewId
 * @returns {string[]}
 */
export function dominionForgoneBoonIds(character, purviewId) {
  ensureDominionForgoneShape(character);
  const pid = String(purviewId ?? "").trim();
  const raw = character.dominionBoonForgoneByPurview[pid];
  if (!Array.isArray(raw)) return [];
  return raw.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
}

/**
 * @param {unknown} character
 * @param {string} purviewId
 * @returns {string[]}
 */
export function dominionForgoneXpBoonIds(character, purviewId) {
  ensureDominionForgoneShape(character);
  const pid = String(purviewId ?? "").trim();
  const raw = character.dominionBoonForgoneXpByPurview[pid];
  if (!Array.isArray(raw)) return [];
  return raw.filter((id) => typeof id === "string" && id.trim());
}

/**
 * Legend purchases consumed by one Dominion mark (0–2).
 * @param {unknown} character
 * @param {string} purviewId
 */
export function dominionLegendPurchaseCostForMark(character, purviewId) {
  const forgone = dominionForgoneBoonIds(character, purviewId);
  if (forgone.length < DOMINION_BOON_FORGONE_COST) return DOMINION_BOON_FORGONE_COST;
  const xpForgone = new Set(dominionForgoneXpBoonIds(character, purviewId));
  const legendForgone = forgone.filter((id) => !xpForgone.has(id)).length;
  return Math.min(DOMINION_BOON_FORGONE_COST, legendForgone);
}

/**
 * @param {string} boonId
 * @param {string} purviewId
 * @param {{ boons?: Record<string, Record<string, unknown>> }} [bundle]
 */
export function boonBelongsToPurview(boonId, purviewId, bundle) {
  const bid = String(boonId ?? "").trim();
  const pid = String(purviewId ?? "").trim();
  if (!bid || !pid || !bundle?.boons) return false;
  const b = bundle.boons[bid];
  if (!b || typeof b !== "object") return false;
  return String(boonPrimaryPurview(b) || "").trim() === pid;
}

/**
 * Boon ids on the sheet that may be forgone for Dominion in `purviewId` (same Purview only).
 * @param {unknown} character
 * @param {string | null} [purviewId]
 * @param {{ boons?: Record<string, Record<string, unknown>> }} [bundle]
 */
export function sacrificableBoonIds(character, purviewId = null, bundle = null) {
  const ids = (character?.boonIds || []).filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  const alreadyForgone = new Set();
  ensureDominionForgoneShape(character);
  for (const pid of character?.dominionBoonPurviewIds || []) {
    for (const id of dominionForgoneBoonIds(character, pid)) alreadyForgone.add(id);
  }
  const pid = String(purviewId ?? "").trim();
  return ids.filter((id) => {
    if (alreadyForgone.has(id)) return false;
    if (pid && bundle) return boonBelongsToPurview(id, pid, bundle);
    return true;
  });
}

/**
 * @param {unknown} character
 * @param {string} purviewId
 * @param {{ forgoneBoonIds?: string[]; reserveLegend?: boolean }} payment
 */
export function projectedLegendBoonSlotsUsedAfterDominionMark(character, purviewId, payment = {}) {
  const pid = String(purviewId ?? "").trim();
  const xp = experienceBoonIdSet(character);
  const forgone = (payment.forgoneBoonIds || [])
    .map((id) => String(id || "").trim())
    .filter((id) => id && !id.startsWith("_"));
  const reserveLegend = Boolean(payment.reserveLegend) && forgone.length < DOMINION_BOON_FORGONE_COST;

  let boonIds = [...(character?.boonIds || [])].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  if (forgone.length === DOMINION_BOON_FORGONE_COST) {
    const drop = new Set(forgone);
    boonIds = boonIds.filter((id) => !drop.has(id));
  }

  const forgoneBy = { ...(character?.dominionBoonForgoneByPurview || {}) };
  const forgoneXpBy = { ...(character?.dominionBoonForgoneXpByPurview || {}) };
  if (forgone.length === DOMINION_BOON_FORGONE_COST) {
    forgoneBy[pid] = [...forgone];
    forgoneXpBy[pid] = forgone.filter((id) => xp.has(id));
  } else if (reserveLegend) {
    delete forgoneBy[pid];
    delete forgoneXpBy[pid];
  }

  const marked = new Set(
    (Array.isArray(character?.dominionBoonPurviewIds) ? character.dominionBoonPurviewIds : []).filter(
      (id) => typeof id === "string" && id.trim(),
    ),
  );
  marked.add(pid);

  let nonXp = 0;
  for (const id of boonIds) {
    if (!xp.has(id)) nonXp += 1;
  }

  let domCost = 0;
  for (const domPid of marked) {
    if (domPid === pid && forgone.length === DOMINION_BOON_FORGONE_COST) {
      const xpF = new Set(forgone.filter((id) => xp.has(id)));
      domCost += Math.min(DOMINION_BOON_FORGONE_COST, forgone.length - xpF.size);
    } else if (domPid === pid && reserveLegend) {
      domCost += DOMINION_BOON_FORGONE_COST;
    } else {
      domCost += dominionLegendPurchaseCostForMark(
        { ...character, dominionBoonForgoneByPurview: forgoneBy, dominionBoonForgoneXpByPurview: forgoneXpBy },
        domPid,
      );
    }
  }
  return nonXp + domCost;
}

/**
 * @param {unknown} character
 * @param {string} purviewId
 * @param {string[] | null} [forgoneBoonIds]
 * @param {{ boons?: Record<string, Record<string, unknown>> }} [bundle]
 * @returns {{ canMark: boolean; canReserveLegend: boolean; canSacrifice: boolean; sacrificableCount: number }}
 */
export function dominionMarkPaymentOptions(character, purviewId, forgoneBoonIds = null, bundle = null) {
  if (!tierUsesLegendTraitEffects(character?.tier)) {
    return { canMark: true, canReserveLegend: true, canSacrifice: false, sacrificableCount: 0 };
  }
  const pid = String(purviewId ?? "").trim();
  const marked = new Set(
    (Array.isArray(character?.dominionBoonPurviewIds) ? character.dominionBoonPurviewIds : []).filter(
      (id) => typeof id === "string" && id.trim(),
    ),
  );
  if (marked.has(pid)) {
    return { canMark: true, canReserveLegend: false, canSacrifice: false, sacrificableCount: 0 };
  }
  const total = legendBoonBudgetTotal(character) ?? 0;
  const sacrificable = sacrificableBoonIds(character, pid, bundle);
  const forgone =
    forgoneBoonIds == null
      ? null
      : forgoneBoonIds
          .map((id) => String(id || "").trim())
          .filter((id) => id && sacrificable.includes(id))
          .slice(0, DOMINION_BOON_FORGONE_COST);
  const canReserveLegend =
    projectedLegendBoonSlotsUsedAfterDominionMark(character, pid, { reserveLegend: true }) <= total;
  const canSacrifice =
    forgone != null &&
    forgone.length === DOMINION_BOON_FORGONE_COST &&
    projectedLegendBoonSlotsUsedAfterDominionMark(character, pid, { forgoneBoonIds: forgone }) <= total;
  return {
    canMark: canReserveLegend || sacrificable.length >= DOMINION_BOON_FORGONE_COST,
    canReserveLegend,
    canSacrifice,
    sacrificableCount: sacrificable.length,
  };
}

/**
 * Legend-funded slots consumed: non-XP Boons on sheet + Legend cost of each Dominion mark.
 * @param {unknown} character
 */
export function legendBoonSlotsUsed(character) {
  const xp = experienceBoonIdSet(character);
  let boons = 0;
  for (const id of character?.boonIds || []) {
    if (typeof id !== "string" || !id.trim() || id.startsWith("_")) continue;
    if (!xp.has(id)) boons += 1;
  }
  let domCost = 0;
  for (const pid of character?.dominionBoonPurviewIds || []) {
    if (typeof pid !== "string" || !pid.trim()) continue;
    domCost += dominionLegendPurchaseCostForMark(character, pid);
  }
  return boons + domCost;
}

/**
 * @param {unknown} character
 * @returns {number | null} — null when tier uses Hero-band cap instead of Legend budget
 */
export function legendBoonBudgetTotal(character) {
  if (!tierUsesLegendTraitEffects(character?.tier)) return null;
  return legendTraitBoonPurchasesFromRating(character?.legendRating);
}

/** @param {unknown} character */
export function legendBoonSlotsRemaining(character) {
  const total = legendBoonBudgetTotal(character);
  if (total == null) return null;
  return Math.max(0, total - legendBoonSlotsUsed(character));
}

/**
 * @typedef {{
 *   usesLegendBudget: boolean;
 *   legendTotal: number | null;
 *   legendUsed: number | null;
 *   legendRemaining: number | null;
 *   atFreeCap: boolean;
 *   heroCap: number | null;
 *   nonXpBoonCount: number;
 *   totalBoonCount: number;
 * }} BoonBudgetSnapshot
 */

/**
 * @param {unknown} character
 * @param {{ tier?: Record<string, { wizardSteps?: string[] }> }} [bundle]
 * @returns {BoonBudgetSnapshot}
 */
export function boonBudgetSnapshot(character, bundle) {
  const ids = (character?.boonIds || []).filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  const xp = experienceBoonIdSet(character);
  const nonXp = ids.filter((id) => !xp.has(id)).length;
  const heroCap = maxWizardBoonPicksForTier(character?.tier, bundle);
  if (tierUsesLegendTraitEffects(character?.tier)) {
    const legendTotal = legendBoonBudgetTotal(character) ?? 0;
    const legendUsed = legendBoonSlotsUsed(character);
    const legendRemaining = Math.max(0, legendTotal - legendUsed);
    return {
      usesLegendBudget: true,
      legendTotal,
      legendUsed,
      legendRemaining,
      atFreeCap: legendRemaining <= 0,
      heroCap: null,
      nonXpBoonCount: nonXp,
      totalBoonCount: ids.length,
    };
  }
  const atFreeCap = Number.isFinite(heroCap) && ids.length >= heroCap;
  return {
    usesLegendBudget: false,
    legendTotal: null,
    legendUsed: null,
    legendRemaining: null,
    atFreeCap,
    heroCap: Number.isFinite(heroCap) ? heroCap : null,
    nonXpBoonCount: nonXp,
    totalBoonCount: ids.length,
  };
}

/**
 * Whether a new Dominion mark would exceed the Legend Boon budget.
 * @param {unknown} character
 * @param {string} purviewId
 * @param {string[] | null} [forgoneBoonIds]
 * @param {{ boons?: Record<string, Record<string, unknown>> }} [bundle]
 */
export function dominionMarkWouldExceedLegendBoonBudget(character, purviewId, forgoneBoonIds = null, bundle = null) {
  if (!tierUsesLegendTraitEffects(character?.tier)) return false;
  const opts = dominionMarkPaymentOptions(character, purviewId, forgoneBoonIds, bundle);
  if (forgoneBoonIds != null && forgoneBoonIds.length === DOMINION_BOON_FORGONE_COST) {
    return !opts.canSacrifice;
  }
  return !opts.canReserveLegend && opts.sacrificableCount < DOMINION_BOON_FORGONE_COST;
}

/**
 * Mark Dominion in a Purview, optionally forgoing two sheet Boons (including XP-bought).
 * @param {unknown} character
 * @param {string} purviewId
 * @param {{ forgoneBoonIds?: string[]; reserveLegend?: boolean }} payment
 * @param {{ boons?: Record<string, Record<string, unknown>> }} [bundle]
 * @returns {boolean}
 */
export function applyDominionMarkPayment(character, purviewId, payment = {}, bundle = null) {
  const pid = String(purviewId ?? "").trim();
  if (!pid) return false;
  ensureDominionForgoneShape(character);
  const marked = new Set(
    (Array.isArray(character.dominionBoonPurviewIds) ? character.dominionBoonPurviewIds : []).filter(
      (id) => typeof id === "string" && id.trim(),
    ),
  );
  if (marked.has(pid)) return true;

  const sacrificable = sacrificableBoonIds(character, pid, bundle);
  const forgone = (payment.forgoneBoonIds || [])
    .map((id) => String(id || "").trim())
    .filter((id) => id && sacrificable.includes(id));
  const reserveLegend = Boolean(payment.reserveLegend) && forgone.length < DOMINION_BOON_FORGONE_COST;

  if (forgone.length === DOMINION_BOON_FORGONE_COST) {
    if (!dominionMarkPaymentOptions(character, pid, forgone, bundle).canSacrifice) return false;
    const xp = experienceBoonIdSet(character);
    const drop = new Set(forgone);
    character.boonIds = (character.boonIds || []).filter((id) => !drop.has(id));
    character.experienceBoonIds = (character.experienceBoonIds || []).filter((id) => !drop.has(id));
    character.dominionBoonForgoneByPurview[pid] = [...forgone];
    character.dominionBoonForgoneXpByPurview[pid] = forgone.filter((id) => xp.has(id));
  } else if (reserveLegend) {
    if (!dominionMarkPaymentOptions(character, pid, null, bundle).canReserveLegend) return false;
    delete character.dominionBoonForgoneByPurview[pid];
    delete character.dominionBoonForgoneXpByPurview[pid];
  } else {
    return false;
  }

  marked.add(pid);
  character.dominionBoonPurviewIds = [...marked];
  return true;
}

/**
 * Remove a Dominion mark and restore any Boons forgone for it.
 * @param {unknown} character
 * @param {string} purviewId
 */
export function clearDominionMarkPayment(character, purviewId) {
  const pid = String(purviewId ?? "").trim();
  if (!pid) return;
  ensureDominionForgoneShape(character);
  const forgone = dominionForgoneBoonIds(character, pid);
  const xpForgone = dominionForgoneXpBoonIds(character, pid);
  if (forgone.length) {
    const have = new Set(character.boonIds || []);
    for (const id of forgone) {
      if (!have.has(id)) {
        character.boonIds = [...(character.boonIds || []), id];
      }
    }
    if (xpForgone.length) {
      character.experienceBoonIds = [...new Set([...(character.experienceBoonIds || []), ...xpForgone])];
    }
  }
  delete character.dominionBoonForgoneByPurview[pid];
  delete character.dominionBoonForgoneXpByPurview[pid];
  character.dominionBoonPurviewIds = (character.dominionBoonPurviewIds || []).filter((id) => id !== pid);
}

/**
 * Drop Dominion marks whose Purview is no longer held or whose forgone Boons are invalid.
 * @param {unknown} character
 * @param {Set<string>} heldPurviews
 * @param {Set<string>} [validBoonIds]
 */
export function pruneDominionForgoneMaps(character, heldPurviews, validBoonIds) {
  ensureDominionForgoneShape(character);
  const held = heldPurviews instanceof Set ? heldPurviews : new Set();
  const valid = validBoonIds instanceof Set ? validBoonIds : null;
  for (const pid of [...(character.dominionBoonPurviewIds || [])]) {
    if (!held.has(pid)) {
      clearDominionMarkPayment(character, pid);
      continue;
    }
    const forgone = dominionForgoneBoonIds(character, pid);
    if (forgone.length && valid && forgone.some((id) => !valid.has(id))) {
      clearDominionMarkPayment(character, pid);
    }
  }
  for (const pid of Object.keys(character.dominionBoonForgoneByPurview || {})) {
    if (!(character.dominionBoonPurviewIds || []).includes(pid)) {
      delete character.dominionBoonForgoneByPurview[pid];
      delete character.dominionBoonForgoneXpByPurview[pid];
    }
  }
}
