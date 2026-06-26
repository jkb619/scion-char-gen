/**
 * Random legal character generator for the Welcome-tab tier / line selection.
 * Produces internal wizard character state (same shape as `defaultCharacter()`).
 */

import { isEntryVisibleForBooks } from "./bookFilter.js";
import {
  boonEligible,
  knackEligible,
  knackEligibleForCallingStep,
  knackEligibleForFinishingExtraKnack,
  heroUsesCallingSlotRows,
  isHeroBandCallingTierId,
  isPostHeroBandCallingTierId,
  isSorcererLineTierId,
  maxWizardBoonPicksForTier,
  pruneKnackIdsToCallingSlotCap,
  seedHeroKnackRowAssignments,
  settleUnassignedHeldKnackSlots,
  callingKnackSlotCap,
} from "./eligibility.js";
import { boonBudgetSnapshot } from "./boonBudget.js";
import { legendTraitCallingDotsFromRating } from "./legendTrait.js";
import {
  experiencePurchaseCost,
  experienceSpend,
  recordExperienceAttributeBump,
  recordExperienceSkillBump,
} from "./experience.js";
import { applyPathAndFinishingToSkillDots, pathSkillTrimmedLostAndUnion, sanitizePathSkillRedistribution } from "./pathSkillMath.js";
import { generateRandomDragonCharacter } from "./randomDragonCharacter.js";
import {
  createRng,
  distributeThreeRowCallingDots,
  emptyCharacterShape,
  HERO_CREATION_CALLING_DOTS,
  NAME_PARTS,
  parseWelcomeTrack,
  pick,
  shuffle,
} from "./randomChargenUtils.js";
import { rollLegendRatingForTier, rollTierExperiencePool } from "./tierExperienceBudget.js";

export { createRng, emptyCharacterShape, parseWelcomeTrack } from "./randomChargenUtils.js";

const PATH_KEYS = ["origin", "role", "society"];
const ARENA_ORDER = ["Physical", "Mental", "Social"];
const ARENAS = {
  Physical: ["might", "dexterity", "stamina"],
  Mental: ["intellect", "cunning", "resolve"],
  Social: ["presence", "manipulation", "composure"],
};
const APPROACHES = ["Force", "Finesse", "Resilience"];

/**
 * @param {Record<string, unknown>} bundle
 * @param {string} lane
 */
function skillIds(bundle) {
  return Object.keys(bundle?.skills || {}).filter((k) => !k.startsWith("_"));
}

/** @param {Record<string, unknown>} bundle */
function pathTemplatesByKind(bundle) {
  /** @type {Record<string, { id: string; name: string; suggestedSkills?: string[] }[]>} */
  const out = { origin: [], role: [], society: [] };
  for (const [id, row] of Object.entries(bundle?.paths || {})) {
    if (!row || typeof row !== "object" || id.startsWith("_")) continue;
    const kind = row.pathKind === "societyPantheon" ? "society" : row.pathKind;
    if (kind !== "origin" && kind !== "role" && kind !== "society") continue;
    out[kind].push({
      id,
      name: String(row.name || id),
      suggestedSkills: Array.isArray(row.suggestedSkills) ? row.suggestedSkills : [],
    });
  }
  return out;
}

/**
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {"deity"|"titan"} patronKind
 */
function pickPantheonAndParent(character, bundle, patronKind, rng) {
  const rows = Object.entries(bundle.pantheons || {})
    .filter(([id, p]) => !id.startsWith("_") && p && typeof p === "object")
    .map(([id, p]) => ({ id, pantheon: p }));
  const withPatrons = rows.filter(({ pantheon }) => {
    const list = patronKind === "titan" ? pantheon.titans : pantheon.deities;
    return Array.isArray(list) && list.length > 0;
  });
  const chosen = pick(withPatrons.length ? withPatrons : rows, rng);
  if (!chosen) return;
  character.pantheonId = chosen.id;
  character.patronKind = patronKind;
  const list =
    patronKind === "titan"
      ? Array.isArray(chosen.pantheon.titans)
        ? chosen.pantheon.titans
        : []
      : Array.isArray(chosen.pantheon.deities)
        ? chosen.pantheon.deities
        : [];
  const deity = pick(list.filter((d) => d && d.id), rng);
  if (deity) character.parentDeityId = deity.id;
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function pickPathPhrases(character, bundle, rng) {
  const templates = pathTemplatesByKind(bundle);
  for (const pk of PATH_KEYS) {
    const t = pick(templates[pk], rng);
    character.paths[pk] = t ? t.name : `${pk.charAt(0).toUpperCase() + pk.slice(1)} path`;
  }
  character.pathRank = {
    primary: pick(PATH_KEYS, rng) || "origin",
    secondary: "",
    tertiary: "",
  };
  const rest = PATH_KEYS.filter((k) => k !== character.pathRank.primary);
  character.pathRank.secondary = rest[0] || "role";
  character.pathRank.tertiary = rest[1] || "society";
}

/** Society asset skills for patron. */
function societyAssetSkillIds(character, bundle) {
  const pant = bundle.pantheons?.[character.pantheonId];
  if (!pant) return [];
  const kind = character.patronKind === "titan" ? "titans" : "deities";
  const list = Array.isArray(pant[kind]) ? pant[kind] : [];
  const patron = list.find((d) => d && d.id === character.parentDeityId);
  const fromPatron = Array.isArray(patron?.assetSkills) ? patron.assetSkills : [];
  const valid = (arr) =>
    arr.filter((id) => typeof id === "string" && id && !id.startsWith("_") && bundle.skills?.[id]);
  const patronSkills = valid(fromPatron);
  if (patronSkills.length) return patronSkills;
  return valid(Array.isArray(pant.assetSkills) ? pant.assetSkills : []);
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function pickPathSkills(character, bundle, rng) {
  const templates = pathTemplatesByKind(bundle);
  const allSkills = skillIds(bundle);

  /** Prefer template suggestions; always return three distinct skills (overlap across paths is legal). */
  const pickThree = (candidates, fallbackPool) => {
    const picked = [];
    const take = (pool) => {
      for (const id of shuffle(pool.filter((x) => !picked.includes(x)), rng)) {
        picked.push(id);
        if (picked.length >= 3) return;
      }
    };
    take(candidates.length ? candidates : fallbackPool);
    if (picked.length < 3) take(fallbackPool);
    return picked.slice(0, 3);
  };

  for (const pk of ["origin", "role"]) {
    const t = pick(templates[pk], rng);
    const suggested = (t?.suggestedSkills || []).filter((id) => bundle.skills?.[id]);
    character.pathSkills[pk] = pickThree(suggested, allSkills);
  }

  const assets = societyAssetSkillIds(character, bundle);
  const society = [...new Set(assets)];
  while (society.length < 3) {
    const pool = allSkills.filter((id) => !society.includes(id));
    if (!pool.length) break;
    society.push(pick(pool, rng));
  }
  character.pathSkills.society = society.slice(0, 3);

  const { lost, trimmed, union } = pathSkillTrimmedLostAndUnion(bundle, character);
  if (lost > 0) {
    const order = shuffle([...union], rng);
    /** @type {Record<string, number>} */
    const G = {};
    let remaining = lost;
    for (const sid of order) {
      if (remaining <= 0) break;
      const cap = Math.max(0, 5 - (trimmed[sid] || 0));
      if (cap <= 0) continue;
      G[sid] = 1;
      remaining -= 1;
    }
    character.pathSkillRedistribution = sanitizePathSkillRedistribution(trimmed, lost, union, G);
  }
}

/** @param {Record<string, unknown>} character @param {() => number} rng */
function assignAttributesAndFinishing(character, rng) {
  character.arenaRank = shuffle(ARENA_ORDER, rng);
  const pools = {
    [character.arenaRank[0]]: 6,
    [character.arenaRank[1]]: 4,
    [character.arenaRank[2]]: 2,
  };
  character.favoredApproach = pick(APPROACHES, rng) || "Force";

  /** @type {Record<string, number>} */
  const attrs = {};
  for (const arena of ARENA_ORDER) {
    for (const id of ARENAS[arena]) attrs[id] = 1;
  }

  for (const arena of ARENA_ORDER) {
    let budget = pools[arena] || 0;
    const ids = ARENAS[arena];
    while (budget > 0) {
      const id = pick(ids, rng);
      if (!id) break;
      if (attrs[id] < 5) {
        attrs[id] += 1;
        budget -= 1;
      } else {
        const movable = ids.filter((x) => attrs[x] < 5);
        if (!movable.length) break;
        const alt = pick(movable, rng);
        if (alt) attrs[alt] += 1;
        budget -= 1;
      }
    }
  }

  character.attributes = { ...attrs };
  character.finishing.attrBaseline = { ...attrs };

  const finAttrId = pick(Object.keys(attrs), rng);
  if (finAttrId && attrs[finAttrId] < 5) {
    attrs[finAttrId] += 1;
    character.attributes[finAttrId] = attrs[finAttrId];
  }
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle */
function allowedCallingIds(character, bundle) {
  const pant = bundle.pantheons?.[character.pantheonId];
  if (!pant) return Object.keys(bundle.callings || {}).filter((k) => !k.startsWith("_"));
  const kind = character.patronKind === "titan" ? "titans" : "deities";
  const list = Array.isArray(pant[kind]) ? pant[kind] : [];
  const patron = list.find((d) => d && d.id === character.parentDeityId);
  const raw = Array.isArray(patron?.callings) ? patron.callings : [];
  const filtered = raw.filter((cid) => bundle.callings?.[cid]);
  if (filtered.length) return filtered;
  return Object.keys(bundle.callings || {}).filter((k) => !k.startsWith("_"));
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignCallingAndKnacks(character, bundle, rng) {
  const allowed = allowedCallingIds(character, bundle);
  const tier = String(character.tier || "mortal");

  if (heroUsesCallingSlotRows(character)) {
    const primary = pick(allowed, rng) || allowed[0] || "";
    let dotPattern;
    if (isHeroBandCallingTierId(tier)) {
      dotPattern = shuffle([3, 1, 1], rng);
    } else if (isPostHeroBandCallingTierId(tier)) {
      const legend = Math.max(0, Math.round(Number(character.legendRating) || 0));
      const totalDots = HERO_CREATION_CALLING_DOTS + legendTraitCallingDotsFromRating(legend);
      dotPattern = shuffle(distributeThreeRowCallingDots(totalDots, rng), rng);
    } else {
      dotPattern = shuffle(distributeThreeRowCallingDots(HERO_CREATION_CALLING_DOTS, rng), rng);
    }
    const others = shuffle(allowed.filter((c) => c !== primary), rng);
    character.callingSlots = [
      { id: primary, dots: dotPattern[0] },
      { id: others[0] || "", dots: dotPattern[1] },
      { id: others[1] || "", dots: dotPattern[2] },
    ];
    character.callingId = primary;
    character.callingDots = dotPattern.reduce((a, b) => a + b, 0);
  } else {
    character.callingId = pick(allowed, rng) || allowed[0] || "";
    character.callingDots = 1;
    character.callingSlots = null;
  }

  const knackPool = Object.values(bundle.knacks || {}).filter(
    (k) => k && typeof k === "object" && knackEligibleForCallingStep(k, character, bundle),
  );
  const cap = callingKnackSlotCap(character);
  /** @type {string[]} */
  const picked = [];
  const shuffled = shuffle(knackPool, rng);
  for (const k of shuffled) {
    if (picked.length >= cap) break;
    const kid = String(k.id || "");
    if (!kid || picked.includes(kid)) continue;
    const trial = [...picked, kid];
    const pruned = pruneKnackIdsToCallingSlotCap(trial, character, bundle);
    if (pruned.length === trial.length) picked.push(kid);
  }
  character.knackIds = picked;
  if (heroUsesCallingSlotRows(character)) {
    seedHeroKnackRowAssignments(character, bundle);
    settleUnassignedHeldKnackSlots(character, bundle);
  }

  if (tier === "mortal" || tier === "sorcerer") {
    character.finishing.knackOrBirthright = "knacks";
    const finPool = Object.values(bundle.knacks || {}).filter(
      (k) => k && typeof k === "object" && knackEligibleForFinishingExtraKnack(k, character, bundle),
    );
    const finShuffled = shuffle(finPool, rng);
    /** @type {string[]} */
    const fin = [];
    for (const k of finShuffled) {
      if (fin.length >= 2) break;
      const kid = String(k.id || "");
      if (!kid || fin.includes(kid) || character.knackIds.includes(kid)) continue;
      fin.push(kid);
    }
    character.finishing.finishingKnackIds = fin;
  }
}

/** @param {Record<string, unknown>} bundle @param {string} bid */
function birthrightPointCost(bundle, bid) {
  const br = bundle.birthrights?.[bid];
  const c = Math.round(Number(br?.pointCost ?? br?.dots ?? 1));
  return Number.isFinite(c) && c > 0 ? c : 1;
}

function birthrightBudgetForTier(tierId) {
  const t = String(tierId || "mortal");
  if (t === "hero" || t === "titanic" || t === "sorcerer_hero") return 7;
  if (isPostHeroBandCallingTierId(t)) return 11;
  return 4;
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignPurviewsBirthrightsBoons(character, bundle, rng) {
  const tier = String(character.tier || "mortal");
  const pant = bundle.pantheons?.[character.pantheonId];
  const sig = pant && typeof pant === "object" ? String(pant.signaturePurviewId || "").trim() : "";

  const kind = character.patronKind === "titan" ? "titans" : "deities";
  const list = Array.isArray(pant?.[kind]) ? pant[kind] : [];
  const patron = list.find((d) => d && d.id === character.parentDeityId);
  const patronPurviews = [...new Set((patron?.purviews || []).filter((id) => bundle.purviews?.[id]))];

  const slotCount = Math.min(4, Math.round(Number(bundle.tier?.[tier]?.patronPurviewSlotCount) || 0));
  const slots = ["", "", "", ""];
  const shuffledPv = shuffle(patronPurviews.filter((id) => id !== sig), rng);
  for (let i = 0; i < slotCount && i < shuffledPv.length; i += 1) slots[i] = shuffledPv[i];
  character.patronPurviewSlots = slots;

  if (tier === "hero" || tier === "titanic") {
    const merged = [];
    if (slots[0]) merged.push(slots[0]);
    if (sig) merged.push(sig);
    character.purviewIds = [...new Set(merged)];
  } else if (isPostHeroBandCallingTierId(tier)) {
    const merged = slots.filter(Boolean);
    if (sig && !merged.includes(sig)) merged.unshift(sig);
    character.purviewIds = [...new Set(merged)];
  }

  const brBudget = birthrightBudgetForTier(tier);
  const brPool = Object.keys(bundle.birthrights || {}).filter((id) => !id.startsWith("_") && bundle.birthrights[id]);
  let spent = 0;
  /** @type {string[]} */
  const brPicks = [];
  for (const bid of shuffle(brPool, rng)) {
    const cost = birthrightPointCost(bundle, bid);
    if (spent + cost > brBudget) continue;
    brPicks.push(bid);
    spent += cost;
  }
  character.finishing.birthrightPicks = brPicks;

  const boonSteps = bundle.tier?.[tier]?.wizardSteps;
  if (!Array.isArray(boonSteps) || !boonSteps.includes("boons")) return;

  const boonPool = Object.values(bundle.boons || {}).filter(
    (b) => b && typeof b === "object" && isEntryVisibleForBooks(b, new Set()) && boonEligible(b, character, bundle),
  );
  const shuffledBoons = shuffle(boonPool, rng);
  /** @type {string[]} */
  const boonPicks = [];
  const heroCap = maxWizardBoonPicksForTier(tier, bundle);
  for (const b of shuffledBoons) {
    const bid = String(b.id || "");
    if (!bid || boonPicks.includes(bid)) continue;
    boonPicks.push(bid);
    if (Number.isFinite(heroCap) && boonPicks.length >= heroCap) break;
    const snap = boonBudgetSnapshot({ ...character, boonIds: boonPicks }, bundle);
    if (snap.usesLegendBudget && snap.legendRemaining != null && snap.legendRemaining <= 0) break;
  }
  character.boonIds = boonPicks;
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function distributeFinishingSkillDots(character, bundle, rng) {
  const pathOnly = {};
  for (const sid of skillIds(bundle)) {
    pathOnly[sid] = character.skillDots?.[sid] || 0;
  }
  /** @type {Record<string, number>} */
  const bumps = {};
  let budget = 5;
  const candidates = skillIds(bundle).filter((sid) => (pathOnly[sid] || 0) < 5);
  while (budget > 0 && candidates.length) {
    const sid = pick(candidates, rng);
    if (!sid) break;
    const cur = (pathOnly[sid] || 0) + (bumps[sid] || 0);
    if (cur >= 5) continue;
    bumps[sid] = (bumps[sid] || 0) + 1;
    budget -= 1;
  }
  applyPathAndFinishingToSkillDots(bundle, character, bumps);
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle */
export function applyMechanicalFlavorFallback(character, bundle) {
  const dragon = String(character?.chargenLineage ?? "").trim().toLowerCase() === "dragonheir";
  if (!String(character.characterName || "").trim()) {
    character.characterName = `${pick(NAME_PARTS, rngStatic())} ${pick(NAME_PARTS, rngStatic())}`;
  }
  if (!String(character.concept || "").trim()) {
    if (dragon) {
      character.concept = "A Dragon Heir learning what inheritance demands.";
    } else if (isSorcererLineTierId(String(character.tier))) {
      character.concept = "A sorcerer whose power is still being defined at the table.";
    } else {
      const pantheonName = bundle.pantheons?.[character.pantheonId]?.name || "the World";
      character.concept = `A ${bundle.tier?.[character.tier]?.name || character.tier} Scion marked by ${pantheonName}.`;
    }
  }
  if (!character.deeds || typeof character.deeds !== "object") character.deeds = {};
  if (!String(character.deeds.short || "").trim()) {
    character.deeds.short = dragon ? "Master a draconic challenge." : "Prove worth to allies and rivals alike.";
  }
  if (!String(character.deeds.long || "").trim()) {
    character.deeds.long = dragon
      ? "Claim a place worthy of your inheritance."
      : `Forge a lasting bond between mortal life and ${character.patronKind === "titan" ? "Titan" : "deity"} legacy.`;
  }
  if (!String(character.deeds.band || "").trim()) {
    character.deeds.band = dragon ? "Stand with the Brood when fate turns brutal." : "Stand with the band when fate turns brutal.";
  }
  for (const pk of ["origin", "role", "society"]) {
    if (!character.paths || typeof character.paths !== "object") character.paths = {};
    if (!String(character.paths[pk] || "").trim()) {
      character.paths[pk] = `${pk.charAt(0).toUpperCase() + pk.slice(1)} path`;
    }
  }
  if (dragon && character.dragon && typeof character.dragon === "object") {
    const d = character.dragon;
    if (!d.paths || typeof d.paths !== "object") d.paths = { origin: "", role: "", flight: "" };
    for (const [pk, dk] of [
      ["origin", "origin"],
      ["role", "role"],
      ["society", "flight"],
    ]) {
      if (!String(d.paths[dk] || "").trim()) {
        d.paths[dk] = character.paths[pk] || `${dk} path`;
      }
    }
    if (!d.skillSpecialties || typeof d.skillSpecialties !== "object") d.skillSpecialties = {};
    for (const sid of skillIds(bundle)) {
      const dots = d.skillDots?.[sid] || 0;
      if (dots >= 3 && !String(d.skillSpecialties[sid] || "").trim()) {
        d.skillSpecialties[sid] = `${bundle.skills?.[sid]?.name || sid} focus`;
      }
    }
  } else {
    assignChargenSpecialties(character, bundle, rngStatic());
  }
}

function rngStatic() {
  return Math.random;
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignChargenSpecialties(character, bundle, rng) {
  if (!character.skillSpecialties || typeof character.skillSpecialties !== "object") character.skillSpecialties = {};
  for (const sid of skillIds(bundle)) {
    const dots = character.skillDots?.[sid] || 0;
    if (dots >= 3 && !String(character.skillSpecialties[sid] || "").trim()) {
      const name = bundle.skills?.[sid]?.name || sid;
      character.skillSpecialties[sid] = `${name} focus`;
    }
  }
}

/**
 * Spend tier XP pool (skills first, then specialties, attributes, knacks).
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {() => number} rng
 */
export function spendTierExperiencePool(character, bundle, rng) {
  const tier = String(character.tier || "mortal");
  const pool = rollTierExperiencePool(tier, rng);
  character.experiencePoints = pool;
  character.experiencePointsSpent = 0;
  character.experiencePurchaseLog = [];
  if (pool <= 0) return;

  const skillCost = experiencePurchaseCost(bundle, "skill") || 5;
  const specCost = experiencePurchaseCost(bundle, "specialty") || 3;
  const attrCost = experiencePurchaseCost(bundle, "attribute") || 10;
  const knackCost = experiencePurchaseCost(bundle, "knack") || 10;

  const skillCandidates = () =>
    skillIds(bundle).filter((sid) => (character.skillDots?.[sid] || 0) < 5);
  const specCandidates = () =>
    skillIds(bundle).filter(
      (sid) =>
        (character.skillDots?.[sid] || 0) >= 3 &&
        !String(character.skillSpecialties?.[sid] || "").trim(),
    );

  let guard = 200;
  while (guard > 0 && (character.experiencePoints || 0) >= skillCost) {
    guard -= 1;
    const roll = rng();
    if (roll < 0.55) {
      const cands = skillCandidates();
      const sid = pick(cands, rng);
      if (!sid) break;
      if (!experienceSpend(character, bundle, "skill", `${bundle.skills?.[sid]?.name || sid} +1`)) break;
      character.skillDots[sid] = Math.min(5, (character.skillDots[sid] || 0) + 1);
      recordExperienceSkillBump(character, sid);
    } else if (roll < 0.75) {
      const cands = specCandidates();
      const sid = pick(cands, rng);
      if (!cands.length || !sid) {
        if (!skillCandidates().length) break;
        continue;
      }
      const label = `${bundle.skills?.[sid]?.name || sid} specialty`;
      if (!experienceSpend(character, bundle, "specialty", label)) break;
      character.skillSpecialties[sid] = `${label} (XP)`;
    } else if (roll < 0.9) {
      const attrIds = Object.keys(bundle.attributes || {}).filter((k) => !k.startsWith("_"));
      const aid = pick(attrIds, rng);
      if (!aid) break;
      if (!experienceSpend(character, bundle, "attribute", `${bundle.attributes?.[aid]?.name || aid} +1`)) break;
      character.attributes[aid] = Math.min(5, (character.attributes[aid] || 1) + 1);
      recordExperienceAttributeBump(character, aid);
    } else {
      const poolKnacks = Object.values(bundle.knacks || {}).filter(
        (k) => k && typeof k === "object" && knackEligible(k, character, bundle),
      );
      const kid = String(pick(poolKnacks, rng)?.id || "");
      if (!kid || (character.experienceKnackIds || []).includes(kid)) continue;
      if (!experienceSpend(character, bundle, "knack", bundle.knacks?.[kid]?.name || kid)) break;
      if (!Array.isArray(character.experienceKnackIds)) character.experienceKnackIds = [];
      character.experienceKnackIds.push(kid);
    }
  }
}

/**
 * @param {Record<string, unknown>} bundle
 * @param {{ welcomeTrack: string; seed?: number; allowedBooks?: Set<string> }} options
 * @returns {Record<string, unknown>}
 */
export function generateRandomCharacter(bundle, options) {
  const rng = createRng(options.seed);
  const { lane, payload } = parseWelcomeTrack(options.welcomeTrack);

  if (lane === "dragon") {
    return generateRandomDragonCharacter(bundle, payload, rng);
  }

  const character = emptyCharacterShape();

  if (lane === "sorcerer") {
    character.chargenLineage = "scion";
    character.tier = isSorcererLineTierId(payload) ? payload : "sorcerer";
    character.patronKind = "deity";
    pickPathPhrases(character, bundle, rng);
    pickPathSkills(character, bundle, rng);
    distributeFinishingSkillDots(character, bundle, rng);
    assignAttributesAndFinishing(character, rng);
    spendTierExperiencePool(character, bundle, rng);
    character.legendRating = rollLegendRatingForTier(character.tier, bundle, rng);
    return character;
  }

  character.chargenLineage = "scion";
  if (lane === "titan") {
    character.patronKind = "titan";
    character.tier = payload === "titanic" ? "titanic" : payload;
  } else {
    character.patronKind = "deity";
    character.tier = payload || "mortal";
  }

  if (!bundle.tier?.[character.tier]) character.tier = "mortal";

  pickPantheonAndParent(character, bundle, character.patronKind === "titan" ? "titan" : "deity", rng);
  pickPathPhrases(character, bundle, rng);
  pickPathSkills(character, bundle, rng);
  distributeFinishingSkillDots(character, bundle, rng);
  assignAttributesAndFinishing(character, rng);
  character.legendRating = rollLegendRatingForTier(character.tier, bundle, rng);
  assignCallingAndKnacks(character, bundle, rng);
  assignPurviewsBirthrightsBoons(character, bundle, rng);

  spendTierExperiencePool(character, bundle, rng);

  return character;
}
