/**
 * Merge LLM concept output onto a random mechanical skeleton — flavor + validated thematic picks only.
 */

import { boonBudgetSnapshot } from "./boonBudget.js";
import {
  boonEligible,
  callingKnackSlotCap,
  heroUsesCallingSlotRows,
  isSorcererLineTierId,
  knackEligibleForCallingStep,
  knackEligibleForFinishingExtraKnack,
  maxWizardBoonPicksForTier,
  pruneKnackIdsToCallingSlotCap,
  seedHeroKnackRowAssignments,
  settleUnassignedHeldKnackSlots,
} from "./eligibility.js";
import {
  applyPathAndFinishingToSkillDots,
  pathOnlySkillDotsMap,
  pathSkillTrimmedLostAndUnion,
  sanitizePathSkillRedistribution,
} from "./pathSkillMath.js";
import {
  applyConceptMechanicalFallback,
  assignCallingAndKnacks,
  assignPurviewsBirthrightsBoons,
} from "./randomCharacterGenerator.js";
import { parseWelcomeTrack, pick, shuffle } from "./randomChargenUtils.js";
import { assignScionMantleExtras } from "./randomScionMantleExtras.js";
import { assignSorcererChargen } from "./randomSorcererChargen.js";

const PATH_KEYS = ["origin", "role", "society"];
const DRAGON_PATH_KEYS = ["origin", "role", "flight"];
const FLAVOR_STRING_KEYS = ["characterName", "concept", "notes", "sheetDescription", "legendaryTitles", "omen"];
const DEED_KEYS = ["short", "long", "band", "mythos"];
const SORCERY_FLAVOR_KEYS = ["motif", "invocation", "patronage", "prohibition", "talisman", "powerSource", "techniquesNotes"];

/** @param {unknown} obj */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** @param {Record<string, unknown>} bundle */
function skillIds(bundle) {
  return Object.keys(bundle?.skills || {}).filter((k) => !k.startsWith("_"));
}

/** @param {Record<string, unknown>} skeleton @param {Record<string, unknown>} bundle */
function finishingBumpsFromSkeleton(skeleton, bundle) {
  const pathOnly = pathOnlySkillDotsMap(bundle, skeleton);
  /** @type {Record<string, number>} */
  const bumps = {};
  for (const sid of skillIds(bundle)) {
    const total = skeleton.skillDots?.[sid] || 0;
    const po = pathOnly[sid] || 0;
    const diff = total - po;
    if (diff > 0) bumps[sid] = diff;
  }
  return bumps;
}

/** @param {string} welcomeTrack */
function expectedPatronKind(welcomeTrack) {
  const { lane } = parseWelcomeTrack(welcomeTrack);
  return lane === "titan" ? "titan" : "deity";
}

/** @param {Record<string, unknown>} char @param {Record<string, unknown>} bundle @param {string} welcomeTrack */
function validatePatron(char, bundle, welcomeTrack) {
  const { lane } = parseWelcomeTrack(welcomeTrack);
  if (lane === "sorcerer" || lane === "dragon") return true;
  const expectedKind = expectedPatronKind(welcomeTrack);
  if (char.patronKind !== expectedKind) return false;
  const pant = bundle.pantheons?.[char.pantheonId];
  if (!pant) return false;
  const list = expectedKind === "titan" ? pant.titans : pant.deities;
  if (!Array.isArray(list) || !list.length) return false;
  if (!char.parentDeityId) return false;
  return list.some((d) => d && d.id === char.parentDeityId);
}

/** @param {Record<string, unknown>} char @param {Record<string, unknown>} llm @param {string[]} pathKeys */
function applyPathPhrases(char, llm, pathKeys) {
  if (!llm.paths || typeof llm.paths !== "object") return;
  if (!char.paths || typeof char.paths !== "object") char.paths = {};
  for (const pk of pathKeys) {
    const v = String(llm.paths[pk] ?? "").trim();
    if (v && v.length <= 120) char.paths[pk] = v;
  }
}

/** @param {Record<string, unknown> | null | undefined} pr @param {Record<string, unknown>} fallback */
function normPathRank(pr, fallback) {
  const norm = (v, fb) => {
    const s = String(v ?? "")
      .trim()
      .toLowerCase();
    return PATH_KEYS.includes(s) ? s : fb;
  };
  const out = {
    primary: norm(pr?.primary, fallback.primary),
    secondary: norm(pr?.secondary, fallback.secondary),
    tertiary: norm(pr?.tertiary, fallback.tertiary),
  };
  if (new Set([out.primary, out.secondary, out.tertiary]).size !== 3) return { ...fallback };
  return out;
}

/** @param {unknown} pathSkills @param {Record<string, unknown>} bundle */
function validatePathSkills(pathSkills, bundle) {
  if (!pathSkills || typeof pathSkills !== "object") return false;
  for (const pk of PATH_KEYS) {
    const arr = pathSkills[pk];
    if (!Array.isArray(arr) || arr.length !== 3) return false;
    for (const sid of arr) {
      if (!sid || String(sid).startsWith("_") || !bundle.skills?.[sid]) return false;
    }
  }
  return true;
}

/** @param {Record<string, unknown>} char @param {Record<string, unknown>} bundle @param {() => number} rng */
function healPathRedistribution(char, bundle, rng) {
  const { lost, trimmed, union } = pathSkillTrimmedLostAndUnion(bundle, char);
  if (lost <= 0) {
    char.pathSkillRedistribution = {};
    return;
  }
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
  char.pathSkillRedistribution = sanitizePathSkillRedistribution(trimmed, lost, union, G);
}

/** @param {Record<string, unknown>} char @param {Record<string, unknown>} llm */
function applyFlavorFields(char, llm) {
  for (const key of FLAVOR_STRING_KEYS) {
    const v = String(llm[key] ?? "").trim();
    if (v) char[key] = v.slice(0, 500);
  }
  if (llm.deeds && typeof llm.deeds === "object") {
    if (!char.deeds || typeof char.deeds !== "object") char.deeds = {};
    for (const k of DEED_KEYS) {
      const v = String(llm.deeds[k] ?? "").trim();
      if (v) char.deeds[k] = v.slice(0, 500);
    }
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

/**
 * @param {string[]} candidateIds
 * @param {Record<string, unknown>} char
 * @param {Record<string, unknown>} bundle
 * @param {number} cap
 */
function buildValidKnackList(candidateIds, char, bundle, cap) {
  /** @type {string[]} */
  const picked = [];
  for (const id of candidateIds) {
    if (picked.length >= cap) break;
    const kid = String(id || "").trim();
    if (!kid || picked.includes(kid)) continue;
    const k = bundle.knacks?.[kid];
    if (!k || !knackEligibleForCallingStep(k, char, bundle)) continue;
    const trial = [...picked, kid];
    if (pruneKnackIdsToCallingSlotCap(trial, char, bundle).length !== trial.length) continue;
    picked.push(kid);
  }
  return picked;
}

/**
 * @param {string[]} candidateIds
 * @param {Record<string, unknown>} char
 * @param {Record<string, unknown>} bundle
 */
function buildValidBoonList(candidateIds, char, bundle) {
  const tier = String(char.tier || "mortal");
  const cap = maxWizardBoonPicksForTier(tier, bundle);
  /** @type {string[]} */
  const picked = [];
  for (const id of candidateIds) {
    if (Number.isFinite(cap) && picked.length >= cap) break;
    const bid = String(id || "").trim();
    if (!bid || picked.includes(bid)) continue;
    const b = bundle.boons?.[bid];
    if (!b || !boonEligible(b, char, bundle)) continue;
    const trial = [...picked, bid];
    const snap = boonBudgetSnapshot({ ...char, boonIds: trial }, bundle);
    if (snap.usesLegendBudget && snap.legendRemaining != null && snap.legendRemaining < 0) continue;
    picked.push(bid);
  }
  return picked;
}

/** @param {Record<string, unknown>} char @param {Record<string, unknown>} llm @param {Record<string, unknown>} skeleton @param {Record<string, unknown>} bundle @param {() => number} rng */
function mergeThematicPicks(char, llm, skeleton, bundle, rng) {
  const allowed = allowedCallingIds(char, bundle);
  const llmCalling = String(llm.callingId || "").trim();
  if (llmCalling && allowed.includes(llmCalling)) {
    if (heroUsesCallingSlotRows(char) && Array.isArray(char.callingSlots) && char.callingSlots.length) {
      const slots = char.callingSlots.map((row) => ({ ...row }));
      const idx = slots.findIndex((row) => row.id === llmCalling);
      if (idx > 0) {
        const [row] = slots.splice(idx, 1);
        slots.unshift(row);
      } else if (idx < 0) {
        slots[0] = { ...slots[0], id: llmCalling };
      }
      char.callingSlots = slots;
      char.callingId = llmCalling;
    } else {
      char.callingId = llmCalling;
    }
  }

  const knackCap = callingKnackSlotCap(char);
  const llmKnacks = Array.isArray(llm.knackIds) ? llm.knackIds.map(String) : [];
  const skeletonKnacks = Array.isArray(skeleton.knackIds) ? skeleton.knackIds.map(String) : [];
  let knacks = buildValidKnackList(llmKnacks, char, bundle, knackCap);
  if (knacks.length < knackCap) {
    knacks = buildValidKnackList([...knacks, ...skeletonKnacks], char, bundle, knackCap);
  }
  if (knacks.length < knackCap) {
    const pool = Object.values(bundle.knacks || {}).filter(
      (k) => k && typeof k === "object" && knackEligibleForCallingStep(k, char, bundle),
    );
    for (const k of shuffle(pool, rng)) {
      if (knacks.length >= knackCap) break;
      const kid = String(k.id || "");
      if (!kid || knacks.includes(kid)) continue;
      knacks = buildValidKnackList([...knacks, kid], char, bundle, knackCap);
    }
  }
  char.knackIds = knacks;
  if (heroUsesCallingSlotRows(char)) {
    seedHeroKnackRowAssignments(char, bundle);
    settleUnassignedHeldKnackSlots(char, bundle);
  }

  const llmBoons = Array.isArray(llm.boonIds) ? llm.boonIds.map(String) : [];
  const skeletonBoons = Array.isArray(skeleton.boonIds) ? skeleton.boonIds.map(String) : [];
  let boons = buildValidBoonList(llmBoons, char, bundle);
  if (!boons.length) boons = buildValidBoonList(skeletonBoons, char, bundle);
  char.boonIds = boons;

  const llmPurviews = Array.isArray(llm.purviewIds) ? llm.purviewIds.map(String).filter(Boolean) : [];
  const validPurviews = llmPurviews.filter((pid) => bundle.purviews?.[pid] && !pid.startsWith("_"));
  if (validPurviews.length) char.purviewIds = [...new Set(validPurviews)];

  if (Array.isArray(llm.patronPurviewSlots) && llm.patronPurviewSlots.length === 4) {
    const slots = llm.patronPurviewSlots.map((id) => {
      const pid = String(id || "").trim();
      return pid && bundle.purviews?.[pid] ? pid : "";
    });
    if (slots.some(Boolean)) char.patronPurviewSlots = slots;
  }

  if (String(char.tier) === "mortal" || String(char.tier) === "sorcerer") {
    const llmFin = Array.isArray(llm.finishing?.finishingKnackIds) ? llm.finishing.finishingKnackIds.map(String) : [];
    const skeletonFin = Array.isArray(skeleton.finishing?.finishingKnackIds)
      ? skeleton.finishing.finishingKnackIds.map(String)
      : [];
    /** @type {string[]} */
    let fin = [];
    for (const id of [...llmFin, ...skeletonFin]) {
      if (fin.length >= 2) break;
      const kid = String(id || "").trim();
      if (!kid || fin.includes(kid) || char.knackIds.includes(kid)) continue;
      const k = bundle.knacks?.[kid];
      if (!k || !knackEligibleForFinishingExtraKnack(k, char, bundle)) continue;
      fin.push(kid);
    }
    if (fin.length < 2) {
      const pool = Object.values(bundle.knacks || {}).filter(
        (k) => k && typeof k === "object" && knackEligibleForFinishingExtraKnack(k, char, bundle),
      );
      for (const k of shuffle(pool, rng)) {
        if (fin.length >= 2) break;
        const kid = String(k.id || "");
        if (!kid || fin.includes(kid) || char.knackIds.includes(kid)) continue;
        fin.push(kid);
      }
    }
    if (fin.length) char.finishing.finishingKnackIds = fin;
  }
}

/** @param {Record<string, unknown>} char @param {Record<string, unknown>} skeleton @param {Record<string, unknown>} bundle */
function restoreOriginFinishingMechanicals(char, skeleton, bundle) {
  const tier = String(char.tier || "");
  if (tier !== "mortal" && tier !== "sorcerer") return;

  const skFin = skeleton.finishing;
  if (!skFin || typeof skFin !== "object") return;

  char.finishing.extraSkillDots = skFin.extraSkillDots ?? 5;
  char.finishing.extraAttributeDots = skFin.extraAttributeDots ?? 1;
  if (skFin.knackOrBirthright) char.finishing.knackOrBirthright = skFin.knackOrBirthright;
  if (skFin.sorcererMortalFinishingPackage) {
    char.finishing.sorcererMortalFinishingPackage = skFin.sorcererMortalFinishingPackage;
  }

  if (skFin.attrBaseline && typeof skFin.attrBaseline === "object") {
    char.finishing.attrBaseline = deepClone(skFin.attrBaseline);
    char.attributes = deepClone(skeleton.attributes);
  }

  const pathChanged =
    JSON.stringify(char.pathSkills) !== JSON.stringify(skeleton.pathSkills) ||
    JSON.stringify(char.pathRank) !== JSON.stringify(skeleton.pathRank);
  const bumps = finishingBumpsFromSkeleton(skeleton, bundle);

  if (pathChanged) {
    if (skFin.skillBaseline && typeof skFin.skillBaseline === "object") {
      applyPathAndFinishingToSkillDots(bundle, char, bumps);
    }
  } else {
    if (skFin.skillBaseline && typeof skFin.skillBaseline === "object") {
      char.finishing.skillBaseline = deepClone(skFin.skillBaseline);
    }
    char.skillDots = deepClone(skeleton.skillDots);
  }

  if (tier === "mortal") {
    if ((char.finishing.finishingKnackIds || []).length < 2 && (skFin.finishingKnackIds || []).length) {
      char.finishing.finishingKnackIds = deepClone(skFin.finishingKnackIds);
    }
    if (
      char.finishing.knackOrBirthright === "birthrights" &&
      !(char.finishing.birthrightPicks || []).length &&
      (skFin.birthrightPicks || []).length
    ) {
      char.finishing.birthrightPicks = deepClone(skFin.birthrightPicks);
    }
  }
}

/**
 * Re-apply skeleton Finishing + specialties after normalize (which can disturb baselines).
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} skeleton
 * @param {Record<string, unknown>} bundle
 * @param {() => number} rng
 */
export function repairConceptMechanicalsFromSkeleton(character, skeleton, bundle, rng) {
  restoreOriginFinishingMechanicals(character, skeleton, bundle);
  void rng;
}

/** @param {string} sid @param {string} label @param {Record<string, unknown>} bundle */
export function isGenericSkillSpecialtyLabel(sid, label, bundle) {
  const v = String(label || "").trim().toLowerCase();
  if (!v) return true;
  const name = String(bundle.skills?.[sid]?.name || sid).trim().toLowerCase();
  if (v === `${name} focus`) return true;
  if (v.endsWith(" focus") && v.slice(0, -6).trim() === name) return true;
  if (/\(xp\)$/i.test(v)) return true;
  return false;
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle */
export function clearGenericSkillSpecialtyPlaceholders(character, bundle) {
  if (!character.skillSpecialties || typeof character.skillSpecialties !== "object") {
    character.skillSpecialties = {};
    return;
  }
  for (const sid of skillIds(bundle)) {
    const label = String(character.skillSpecialties[sid] || "").trim();
    if (label && isGenericSkillSpecialtyLabel(sid, label, bundle)) {
      delete character.skillSpecialties[sid];
    }
  }
}

/** @param {Record<string, unknown>} char @param {Record<string, unknown>} llm @param {Record<string, unknown>} bundle @param {() => number} rng */
function applyConceptSkillSpecialties(char, llm, bundle, rng) {
  if (!char.skillSpecialties || typeof char.skillSpecialties !== "object") char.skillSpecialties = {};
  const llmSpecs = llm.skillSpecialties && typeof llm.skillSpecialties === "object" ? llm.skillSpecialties : {};
  for (const [sid, label] of Object.entries(llmSpecs)) {
    if (!bundle.skills?.[sid] || String(sid).startsWith("_")) continue;
    if ((char.skillDots?.[sid] || 0) < 3) continue;
    const v = String(label ?? "").trim();
    if (!v || isGenericSkillSpecialtyLabel(sid, v, bundle)) continue;
    char.skillSpecialties[sid] = v.slice(0, 120);
  }
  void rng;
}

/** @param {Record<string, unknown>} char @param {Record<string, unknown>} llm @param {Record<string, unknown>} bundle */
function applySorceryFlavorAndHints(char, llm, bundle) {
  if (!char.sorceryProfile || typeof char.sorceryProfile !== "object") char.sorceryProfile = {};
  const sp = char.sorceryProfile;
  const llmSp = llm.sorceryProfile && typeof llm.sorceryProfile === "object" ? llm.sorceryProfile : {};
  for (const key of SORCERY_FLAVOR_KEYS) {
    const v = String(llmSp[key] ?? "").trim();
    if (v) sp[key] = v.slice(0, 500);
  }
  const catalogIds = new Set(
    (bundle?.saintsMonsters?.sorcererWorkingsCatalog || [])
      .filter((r) => r && r.id)
      .map((r) => String(r.id)),
  );
  const llmWorkings = (llmSp.workingIds || []).map((x) => String(x).trim()).filter((id) => catalogIds.has(id));
  if (llmWorkings.length) sp.workingIds = [...new Set(llmWorkings)];
  const llmTech = (llmSp.additionalTechniqueIds || []).map((x) => String(x).trim()).filter(Boolean);
  if (llmTech.length) sp.additionalTechniqueIds = [...new Set(llmTech)];
}

/** @param {Record<string, unknown>} char @param {Record<string, unknown>} llm @param {Record<string, unknown>} skeleton @param {Record<string, unknown>} bundle @param {string} welcomeTrack */
function applyValidatedPatron(char, llm, skeleton, bundle, welcomeTrack) {
  const { lane } = parseWelcomeTrack(welcomeTrack);
  if (lane === "sorcerer" || lane === "dragon") return false;

  char.pantheonId = String(llm.pantheonId ?? char.pantheonId ?? "").trim();
  char.parentDeityId = String(llm.parentDeityId ?? char.parentDeityId ?? "").trim();
  char.patronKind = expectedPatronKind(welcomeTrack);

  if (!validatePatron(char, bundle, welcomeTrack)) {
    char.pantheonId = skeleton.pantheonId;
    char.parentDeityId = skeleton.parentDeityId;
    char.patronKind = skeleton.patronKind;
    return false;
  }
  return char.pantheonId !== skeleton.pantheonId || char.parentDeityId !== skeleton.parentDeityId;
}

/**
 * Apply LLM concept output onto a random skeleton; mechanical budgets stay rules-legal.
 * @param {Record<string, unknown>} skeleton — output of `generateRandomCharacter`
 * @param {Record<string, unknown>} llmHints — raw LLM override object (not trusted for budgets)
 * @param {Record<string, unknown>} bundle
 * @param {string} welcomeTrack
 * @param {() => number} rng
 * @returns {Record<string, unknown>}
 */
export function finalizeConceptCharacterFromSkeleton(skeleton, llmHints, bundle, welcomeTrack, rng) {
  const llm = llmHints && typeof llmHints === "object" ? llmHints : {};
  const char = deepClone(skeleton);
  const isDragon = String(char.chargenLineage ?? "").trim().toLowerCase() === "dragonheir";

  applyFlavorFields(char, llm);

  if (isDragon) {
    applyPathPhrases(char, llm, DRAGON_PATH_KEYS);
    applyConceptMechanicalFallback(char, bundle);
    return char;
  }

  const finishingBumps = finishingBumpsFromSkeleton(skeleton, bundle);

  char.tier = skeleton.tier;
  char.chargenLineage = skeleton.chargenLineage;
  char.legendRating = skeleton.legendRating;
  char.attributes = deepClone(skeleton.attributes);
  char.arenaRank = deepClone(skeleton.arenaRank);
  char.favoredApproach = skeleton.favoredApproach;
  char.experiencePoints = skeleton.experiencePoints;
  char.experiencePointsSpent = skeleton.experiencePointsSpent;
  char.experiencePurchaseLog = deepClone(skeleton.experiencePurchaseLog || []);
  char.experienceAttributeBumps = deepClone(skeleton.experienceAttributeBumps || {});
  char.experienceSkillBumps = deepClone(skeleton.experienceSkillBumps || {});
  char.experienceKnackIds = deepClone(skeleton.experienceKnackIds || []);
  char.finishing = deepClone(skeleton.finishing);
  char.skillDots = deepClone(skeleton.skillDots);
  char.pathSkills = deepClone(skeleton.pathSkills);
  char.pathRank = deepClone(skeleton.pathRank);
  char.pathSkillRedistribution = deepClone(skeleton.pathSkillRedistribution || {});

  applyPathPhrases(char, llm, PATH_KEYS);

  const patronChanged = applyValidatedPatron(char, llm, skeleton, bundle, welcomeTrack);

  if (validatePathSkills(llm.pathSkills, bundle)) {
    char.pathSkills = {
      origin: [...llm.pathSkills.origin],
      role: [...llm.pathSkills.role],
      society: [...llm.pathSkills.society],
    };
    char.pathRank = normPathRank(llm.pathPriority || llm.pathRank, skeleton.pathRank);
    healPathRedistribution(char, bundle, rng);
    applyPathAndFinishingToSkillDots(bundle, char, finishingBumps);
  }

  if (patronChanged) {
    assignCallingAndKnacks(char, bundle, rng);
    assignPurviewsBirthrightsBoons(char, bundle, rng);
  } else {
    char.callingId = skeleton.callingId;
    char.callingDots = skeleton.callingDots;
    char.callingSlots = skeleton.callingSlots ? deepClone(skeleton.callingSlots) : null;
    char.knackIds = deepClone(skeleton.knackIds || []);
    char.knackSlotById = deepClone(skeleton.knackSlotById || {});
    char.boonIds = deepClone(skeleton.boonIds || []);
    char.purviewIds = deepClone(skeleton.purviewIds || []);
    char.patronPurviewSlots = deepClone(skeleton.patronPurviewSlots || ["", "", "", ""]);
  }

  mergeThematicPicks(char, llm, skeleton, bundle, rng);
  applyConceptSkillSpecialties(char, llm, bundle, rng);

  if (isSorcererLineTierId(String(char.tier))) {
    applySorceryFlavorAndHints(char, llm, bundle);
    assignSorcererChargen(char, bundle, rng);
  }

  assignScionMantleExtras(char, bundle, rng);
  restoreOriginFinishingMechanicals(char, skeleton, bundle);
  clearGenericSkillSpecialtyPlaceholders(char, bundle);
  applyConceptMechanicalFallback(char, bundle);

  return char;
}
