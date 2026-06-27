/**
 * Random Dragon Heir character generator (Welcome line: Dragon).
 */

import {
  defaultDragonState,
  ensureDragonShape,
  syncDragonFlightPathRequiredSkills,
  dragonCallingDotsRequired,
  dragonKnackShell,
  dragonMagicIdsExcludedFromSecondaryKnownSlots,
  finalizeDragonSkillDotsFromPaths,
} from "./chargen/DragonChargenWizard.js";
import {
  knackEligible,
  knackEligibleForCallingStep,
  knackIdsCallingSlotsUsed,
  pruneKnackIdsToCallingSlotCap,
  seedHeroKnackRowAssignments,
  syncHeroKnackSlotAssignments,
} from "./eligibility.js";
import { experiencePurchaseCost, experienceSpend, recordExperienceSkillBump } from "./experience.js";
import { emptyCharacterShape, pick, shuffle } from "./randomChargenUtils.js";
import { rollDragonInheritanceExperiencePool } from "./tierExperienceBudget.js";

const DRAGON_PATH_KEYS = ["origin", "role", "flight"];
const ARENA_ORDER = ["Physical", "Mental", "Social"];
const ARENAS = {
  Physical: ["might", "dexterity", "stamina"],
  Mental: ["intellect", "cunning", "resolve"],
  Social: ["presence", "manipulation", "composure"],
};
const APPROACHES = ["Force", "Finesse", "Resilience"];
const DEED_NAME_TEMPLATES = [
  "The Unwritten Scale",
  "Breath Before the Storm",
  "Hoard of Broken Oaths",
  "Wyrm's Quiet Gambit",
  "Ash on the Horizon",
  "The Brood Remembers",
];

/** @param {Record<string, unknown>} bundle */
function skillIds(bundle) {
  return Object.keys(bundle?.skills || {}).filter((k) => !k.startsWith("_"));
}

/** @param {Record<string, unknown>} bundle */
function flightIds(bundle) {
  return Object.keys(bundle?.dragonFlights || {}).filter((k) => !k.startsWith("_"));
}

/** @param {Record<string, unknown>} bundle */
function dragonCallingIdPool(bundle) {
  const out = new Set();
  for (const row of Object.values(bundle?.dragonCallingKnacks || {})) {
    if (!row || typeof row !== "object") continue;
    for (const c of row.callings || []) {
      const s = String(c ?? "").trim();
      if (s && !s.startsWith("_")) out.add(s);
    }
  }
  return [...out];
}

/** @param {Record<string, unknown>} bundle */
function dragonBirthrightCatalogIds(bundle) {
  return Object.keys(bundle?.birthrights || {}).filter((id) => {
    if (id.startsWith("_")) return false;
    const b = bundle.birthrights[id];
    if (!b || typeof b !== "object") return false;
    const lines = /** @type {{ chargenLines?: unknown }} */ (b).chargenLines;
    return Array.isArray(lines) && lines.includes("dragonHeir");
  });
}

/** @param {Record<string, unknown>} bundle @param {string} bid */
function birthrightPointCost(bundle, bid) {
  const br = bundle.birthrights?.[bid];
  const c = Math.round(Number(br?.pointCost ?? br?.dots ?? 1));
  return Number.isFinite(c) && c > 0 ? Math.min(5, c) : 1;
}

/** @param {Record<string, unknown>} bundle @param {string} magicId */
function spellIdsForMagic(bundle, magicId) {
  const mag = bundle?.dragonMagic?.[magicId];
  if (!mag || !Array.isArray(mag.spells)) return [];
  return mag.spells
    .map((s) => String(s?.id ?? "").trim())
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown>} bundle
 * @param {string} magicId
 * @param {() => number} rng
 * @param {Set<string>} [exclude]
 */
function pickSpellForMagic(bundle, magicId, rng, exclude = new Set()) {
  const pool = spellIdsForMagic(bundle, magicId).filter((id) => !exclude.has(id));
  return pick(pool.length ? pool : spellIdsForMagic(bundle, magicId), rng) || "";
}

/** @param {number} inh @param {Record<string, unknown>} bundle */
function advancementSpellSlotCount(inh, bundle) {
  const row = bundle?.dragonTier?.inheritanceTrack?.[String(inh)];
  return Math.max(0, Math.round(Number(row?.wizardAdvancementSpellSlots) || 0));
}

/** @param {Record<string, unknown>} character @param {import('./chargen/DragonChargenWizard.js').DragonState} d */
function draconicKnackEligibilityCharacter(character, d) {
  return {
    ...character,
    tier: "hero",
    legendRating: Math.round(Number(d.inheritance) || 1),
    callingSlots: d.callingSlots,
    dragonHeirCallingKnackShell: true,
  };
}

/** @param {Record<string, unknown>} bundle @param {() => number} rng */
function pickDragonPathPhrases(d, bundle, rng) {
  const templates = { origin: [], role: [] };
  for (const [id, row] of Object.entries(bundle?.paths || {})) {
    if (!row || typeof row !== "object" || id.startsWith("_")) continue;
    const kind = row.pathKind === "societyPantheon" ? "society" : row.pathKind;
    if (kind === "origin" || kind === "role") {
      templates[kind].push(String(row.name || id));
    }
  }
  d.paths.origin = pick(templates.origin, rng) || "Hatchling origins";
  d.paths.role = pick(templates.role, rng) || "Role among the Brood";
  d.pathRank = {
    primary: pick(DRAGON_PATH_KEYS, rng) || "role",
    secondary: "",
    tertiary: "",
  };
  const rest = DRAGON_PATH_KEYS.filter((k) => k !== d.pathRank.primary);
  d.pathRank.secondary = rest[0] || "flight";
  d.pathRank.tertiary = rest[1] || "origin";
}

/** @param {import('./chargen/DragonChargenWizard.js').DragonState} d @param {Record<string, unknown>} bundle @param {() => number} rng */
function pickDragonPathSkills(d, bundle, rng) {
  const all = skillIds(bundle);
  const used = new Set();
  const pickN = (pool, n) => {
    const shuffled = shuffle(pool.filter((id) => !used.has(id)), rng);
    const out = shuffled.slice(0, n);
    for (const id of out) used.add(id);
    return out;
  };
  d.pathSkills.origin = pickN(all, 3);
  d.pathSkills.role = pickN(all, 3);
  syncDragonFlightPathRequiredSkills(d, bundle);
  const req = new Set(d.pathSkills.flight || []);
  if ((d.pathSkills.flight || []).length < 3) {
    const extra = pick(all.filter((id) => !req.has(id)), rng);
    if (extra) d.pathSkills.flight = [...(d.pathSkills.flight || []), extra].slice(0, 3);
  }
}

/** @param {import('./chargen/DragonChargenWizard.js').DragonState} d @param {() => number} rng */
function assignDragonAttributes(d, rng) {
  d.arenaRank = shuffle(ARENA_ORDER, rng);
  const pools = {
    [d.arenaRank[0]]: 6,
    [d.arenaRank[1]]: 4,
    [d.arenaRank[2]]: 2,
  };
  d.favoredApproach = pick(APPROACHES, rng) || "Finesse";
  for (const arena of ARENA_ORDER) {
    for (const id of ARENAS[arena]) d.attributes[id] = 1;
  }
  for (const arena of ARENA_ORDER) {
    let budget = pools[arena] || 0;
    const ids = ARENAS[arena];
    while (budget > 0) {
      const id = pick(ids, rng);
      if (!id) break;
      if ((d.attributes[id] || 1) < 5) {
        d.attributes[id] += 1;
        budget -= 1;
      } else {
        const movable = ids.filter((x) => (d.attributes[x] || 1) < 5);
        if (!movable.length) break;
        const alt = pick(movable, rng);
        if (alt) d.attributes[alt] += 1;
        budget -= 1;
      }
    }
  }
  d.finishingAttrBaseline = { ...d.attributes };
  const finId = pick(Object.keys(d.attributes), rng);
  if (finId && (d.attributes[finId] || 1) < 5) d.attributes[finId] += 1;
}

/**
 * @param {Record<string, unknown>} character
 * @param {import('./chargen/DragonChargenWizard.js').DragonState} d
 * @param {Record<string, unknown>} bundle
 * @param {() => number} rng
 */
function assignDragonCallingsAndKnacks(character, d, bundle, rng) {
  const pool = dragonCallingIdPool(bundle);
  const picked = shuffle(pool, rng).slice(0, 3);
  const totalDots = dragonCallingDotsRequired(bundle, d.inheritance);
  const dots = [2, 2, 1];
  let sum = dots[0] + dots[1] + dots[2];
  while (sum < totalDots) {
    const i = Math.floor(rng() * 3);
    if (dots[i] < 5) {
      dots[i] += 1;
      sum += 1;
    }
  }
  while (sum > totalDots) {
    for (let i = 2; i >= 0 && sum > totalDots; i -= 1) {
      if (dots[i] > 1) {
        dots[i] -= 1;
        sum -= 1;
      }
    }
    if (sum > totalDots) break;
  }
  d.callingSlots = [
    { id: picked[0] || "", dots: dots[0] },
    { id: picked[1] || "", dots: dots[1] },
    { id: picked[2] || "", dots: dots[2] },
  ];
  d.callingKnackIds = [];
  d.knackSlotById = {};

  const shell = dragonKnackShell(character);
  shell.knackIds = [];
  shell.knackSlotById = {};
  const knackPool = Object.values(bundle?.dragonCallingKnacks || {}).filter(
    (k) => k && typeof k === "object" && knackEligibleForCallingStep(k, shell, bundle),
  );
  /** @type {string[]} */
  const pickedKnacks = [];
  for (const k of shuffle(knackPool, rng)) {
    if (knackIdsCallingSlotsUsed(pickedKnacks, bundle, shell) >= totalDots) break;
    const kid = String(k.id || "").trim();
    if (!kid) continue;
    const trial = pruneKnackIdsToCallingSlotCap([...pickedKnacks, kid], shell, bundle);
    if (trial.length === pickedKnacks.length + 1) pickedKnacks.push(kid);
  }
  shell.knackIds = pickedKnacks;
  seedHeroKnackRowAssignments(shell, bundle);
  syncHeroKnackSlotAssignments(shell, bundle);
  d.callingKnackIds = [...(shell.knackIds || [])];
  d.knackSlotById = { ...(shell.knackSlotById || {}) };

  const dkCap = Math.min(10, Math.round(Number(d.inheritance) || 1) + 1);
  const flight = bundle?.dragonFlights?.[d.flightId];
  const favored = Array.isArray(flight?.favoredDraconicKnackIds) ? flight.favoredDraconicKnackIds : [];
  const draconicPool = Object.keys(bundle?.dragonKnacks || {}).filter((k) => !k.startsWith("_"));
  const draconicPick = shuffle([...favored, ...draconicPool], rng).filter((id, i, arr) => arr.indexOf(id) === i);
  const knChar = draconicKnackEligibilityCharacter(character, d);
  /** @type {string[]} */
  const draconicIds = [];
  for (const id of draconicPick) {
    if (draconicIds.length >= dkCap) break;
    const k = bundle?.dragonKnacks?.[id];
    if (k && typeof k === "object" && knackEligible(k, knChar, bundle)) draconicIds.push(id);
  }
  for (const id of shuffle(draconicPool, rng)) {
    if (draconicIds.length >= dkCap) break;
    if (draconicIds.includes(id)) continue;
    const k = bundle?.dragonKnacks?.[id];
    if (k && typeof k === "object" && knackEligible(k, knChar, bundle)) draconicIds.push(id);
  }
  d.draconicKnackIds = draconicIds.slice(0, dkCap);
}

/** @param {import('./chargen/DragonChargenWizard.js').DragonState} d @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignDragonMagicAndSpells(d, bundle, rng) {
  const flight = bundle?.dragonFlights?.[d.flightId];
  const sig = flight?.signatureMagicId ? String(flight.signatureMagicId) : "";
  d.knownMagics = ["", "", ""];
  if (sig) d.knownMagics[0] = sig;

  const excluded = dragonMagicIdsExcludedFromSecondaryKnownSlots(bundle, d.flightId);
  const magicPool = Object.keys(bundle?.dragonMagic || {}).filter(
    (k) => !k.startsWith("_") && k !== sig && !excluded.has(k),
  );
  const extras = shuffle(magicPool, rng);
  if (extras[0]) d.knownMagics[1] = extras[0];
  if (extras[1]) d.knownMagics[2] = extras[1];
  if (!d.knownMagics[1]) d.knownMagics[1] = pick(magicPool.filter((id) => id !== d.knownMagics[2]), rng) || "";
  if (!d.knownMagics[2]) {
    d.knownMagics[2] =
      pick(
        magicPool.filter((id) => id !== d.knownMagics[1]),
        rng,
      ) || "";
  }

  if (!d.spellsByMagicId || typeof d.spellsByMagicId !== "object") d.spellsByMagicId = {};
  for (const mid of d.knownMagics.filter(Boolean)) {
    const spellId = pickSpellForMagic(bundle, mid, rng);
    if (spellId) d.spellsByMagicId[mid] = spellId;
  }

  if (!d.bonusSpell || typeof d.bonusSpell !== "object") d.bonusSpell = { magicId: "", spellId: "" };
  const known = d.knownMagics.filter(Boolean);
  const bonusMid = pick(known, rng) || known[0] || "";
  const primarySpell = String(d.spellsByMagicId[bonusMid] || "").trim();
  const bonusSpellId = pickSpellForMagic(bundle, bonusMid, rng, new Set([primarySpell]));
  d.bonusSpell = { magicId: bonusMid, spellId: bonusSpellId || pickSpellForMagic(bundle, bonusMid, rng) };

  const advN = advancementSpellSlotCount(d.inheritance, bundle);
  /** @type {{ magicId: string; spellId: string }[]} */
  const advRows = [];
  const magicForAdv = [...known, String(d.bonusSpell.magicId || "").trim()].filter(Boolean);
  const usedAdvSpells = new Set(
    [
      ...Object.values(d.spellsByMagicId || {}),
      String(d.bonusSpell.spellId || "").trim(),
    ].filter(Boolean),
  );
  for (let i = 0; i < advN; i += 1) {
    const mid = magicForAdv[i % magicForAdv.length] || known[0] || "";
    const spellId = pickSpellForMagic(bundle, mid, rng, usedAdvSpells) || pickSpellForMagic(bundle, mid, rng);
    if (spellId) usedAdvSpells.add(spellId);
    advRows.push({ magicId: mid, spellId });
  }
  d.advancementSpells = advRows;
}

/** @param {import('./chargen/DragonChargenWizard.js').DragonState} d @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignDragonBirthrights(d, bundle, rng) {
  const brPool = dragonBirthrightCatalogIds(bundle);
  const target = 7;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    /** @type {{ id: string; dots: number }[]} */
    const picks = [];
    let spent = 0;
    for (const bid of shuffle([...brPool], rng)) {
      const cost = birthrightPointCost(bundle, bid);
      if (spent + cost > target) continue;
      picks.push({ id: bid, dots: cost });
      spent += cost;
      if (spent === target) break;
    }
    if (spent === target) {
      d.birthrightPicks = picks;
      d.finishingFocus = "knacks";
      return;
    }
  }
  /** Fallback: 4 + 3 dots when greedy shuffle misses exact 7. */
  const sorted = [...brPool].sort((a, b) => birthrightPointCost(bundle, b) - birthrightPointCost(bundle, a));
  const four = sorted.find((id) => birthrightPointCost(bundle, id) === 4) || sorted[0];
  const three = sorted.find((id) => id !== four && birthrightPointCost(bundle, id) === 3) || sorted.find((id) => id !== four);
  d.birthrightPicks = [
    four ? { id: four, dots: birthrightPointCost(bundle, four) } : null,
    three ? { id: three, dots: birthrightPointCost(bundle, three) } : null,
  ].filter(Boolean);
  d.finishingFocus = "knacks";
}

/** @param {import('./chargen/DragonChargenWizard.js').DragonState} d @param {() => number} rng */
function assignDragonDeedName(d, rng) {
  if (Math.round(Number(d.inheritance) || 1) >= 2) {
    d.deedName = pick(DEED_NAME_TEMPLATES, rng) || "The Brood's Mark";
  }
}

/** @param {import('./chargen/DragonChargenWizard.js').DragonState} d @param {Record<string, unknown>} bundle @param {() => number} rng */
function distributeDragonFinishingSkills(d, bundle, rng) {
  const pathOnly = finalizeDragonSkillDotsFromPaths(d, bundle);
  if (!d.finishingSkillBonus || typeof d.finishingSkillBonus !== "object") d.finishingSkillBonus = {};
  let budget = 5;
  const candidates = skillIds(bundle).filter((sid) => (pathOnly[sid] || 0) < 5);
  while (budget > 0 && candidates.length) {
    const sid = pick(candidates, rng);
    if (!sid) break;
    const cur = (pathOnly[sid] || 0) + (d.finishingSkillBonus[sid] || 0);
    if (cur >= 5) continue;
    d.finishingSkillBonus[sid] = (d.finishingSkillBonus[sid] || 0) + 1;
    budget -= 1;
  }
  finalizeDragonSkillDotsFromPaths(d, bundle);
}

/**
 * @param {Record<string, unknown>} bundle
 * @param {string} inheritancePayload
 * @param {() => number} rng
 */
export function generateRandomDragonCharacter(bundle, inheritancePayload, rng) {
  const character = emptyCharacterShape();
  character.chargenLineage = "dragonHeir";
  character.tier = "mortal";
  character.patronKind = "deity";
  character.dragon = defaultDragonState();
  const inh = Math.max(1, Math.min(10, Math.round(Number(inheritancePayload) || 1)));
  character.dragon.inheritance = inh;

  const flights = flightIds(bundle);
  character.dragon.flightId = pick(flights, rng) || flights[0] || "";
  const flightMeta = bundle?.dragonFlights?.[character.dragon.flightId];
  character.dragon.paths.flight = flightMeta?.name ? `${flightMeta.name} Flight` : "Flight path";

  pickDragonPathPhrases(character.dragon, bundle, rng);
  pickDragonPathSkills(character.dragon, bundle, rng);
  distributeDragonFinishingSkills(character.dragon, bundle, rng);
  assignDragonAttributes(character.dragon, rng);
  assignDragonCallingsAndKnacks(character, character.dragon, bundle, rng);
  assignDragonMagicAndSpells(character.dragon, bundle, rng);
  assignDragonBirthrights(character.dragon, bundle, rng);
  assignDragonDeedName(character.dragon, rng);

  character.paths.origin = character.dragon.paths.origin;
  character.paths.role = character.dragon.paths.role;
  character.paths.society = character.dragon.paths.flight;

  ensureDragonShape(character, bundle);

  const pool = rollDragonInheritanceExperiencePool(inh, rng);
  character.experiencePoints = pool;
  character.experiencePointsSpent = 0;
  character.experiencePurchaseLog = [];
  const skillCost = experiencePurchaseCost(bundle, "skill") || 5;
  let guard = 40;
  while (guard > 0 && (character.experiencePoints || 0) >= skillCost) {
    guard -= 1;
    const cands = skillIds(bundle).filter((sid) => (character.dragon.skillDots?.[sid] || 0) < 5);
    const sid = pick(cands, rng);
    if (!sid) break;
    if (!experienceSpend(character, bundle, "skill", `${bundle.skills?.[sid]?.name || sid} +1`)) break;
    character.dragon.skillDots[sid] = Math.min(5, (character.dragon.skillDots[sid] || 0) + 1);
    recordExperienceSkillBump(character, sid);
  }

  return character;
}
