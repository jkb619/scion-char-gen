/**
 * Random Dragon Heir character generator (Welcome line: Dragon).
 */

import {
  defaultDragonState,
  ensureDragonShape,
  syncDragonFlightPathRequiredSkills,
  dragonCallingDotsRequired,
  finalizeDragonSkillDotsFromPaths,
} from "./chargen/DragonChargenWizard.js";
import { experiencePurchaseCost, experienceSpend, recordExperienceSkillBump } from "./experience.js";
import { createRng, emptyCharacterShape, pick, shuffle } from "./randomChargenUtils.js";
import { rollDragonInheritanceExperiencePool } from "./tierExperienceBudget.js";

const DRAGON_PATH_KEYS = ["origin", "role", "flight"];
const ARENA_ORDER = ["Physical", "Mental", "Social"];
const ARENAS = {
  Physical: ["might", "dexterity", "stamina"],
  Mental: ["intellect", "cunning", "resolve"],
  Social: ["presence", "manipulation", "composure"],
};
const APPROACHES = ["Force", "Finesse", "Resilience"];

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

/** @param {import('./chargen/DragonChargenWizard.js').DragonState} d @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignDragonCallingsAndKnacks(d, bundle, rng) {
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

  const knackRows = Object.entries(bundle?.dragonCallingKnacks || {}).filter(([k]) => !k.startsWith("_"));
  const shuffled = shuffle(knackRows, rng);
  /** @type {string[]} */
  const knackIds = [];
  let budget = totalDots;
  for (const [kid, row] of shuffled) {
    if (budget <= 0) break;
    const cost = Math.round(Number(row?.callingSlotCost) || 1);
    if (cost > budget) continue;
    knackIds.push(kid);
    budget -= cost;
  }
  d.callingKnackIds = knackIds;

  const cap = Math.min(10, Math.round(Number(d.inheritance) || 1) + 1);
  const flight = bundle?.dragonFlights?.[d.flightId];
  const favored = Array.isArray(flight?.favoredDraconicKnackIds) ? flight.favoredDraconicKnackIds : [];
  const draconicPool = Object.keys(bundle?.dragonKnacks || {}).filter((k) => !k.startsWith("_"));
  const draconicPick = shuffle([...favored, ...draconicPool], rng).filter(
    (id, i, arr) => arr.indexOf(id) === i,
  );
  d.draconicKnackIds = draconicPick.slice(0, cap);
}

/** @param {import('./chargen/DragonChargenWizard.js').DragonState} d @param {Record<string, unknown>} bundle @param {() => number} rng */
function assignDragonMagicAndBirthrights(d, bundle, rng) {
  const flight = bundle?.dragonFlights?.[d.flightId];
  if (flight?.signatureMagicId) d.knownMagics[0] = String(flight.signatureMagicId);
  const magicPool = Object.keys(bundle?.dragonMagic || {}).filter((k) => !k.startsWith("_"));
  const extras = shuffle(magicPool.filter((id) => id !== d.knownMagics[0]), rng);
  if (extras[0]) d.knownMagics[1] = extras[0];

  const brPool = Object.keys(bundle?.birthrightsDragon || bundle?.birthrights || {}).filter((k) => !k.startsWith("_"));
  let spent = 0;
  /** @type {{ id: string; dots: number }[]} */
  const picks = [];
  for (const bid of shuffle(brPool, rng)) {
    const table = bundle?.birthrightsDragon?.[bid] || bundle?.birthrights?.[bid];
    const cost = Math.max(1, Math.round(Number(table?.pointCost ?? table?.dots ?? 1)));
    if (spent + cost > 4) continue;
    picks.push({ id: bid, dots: cost });
    spent += cost;
  }
  d.birthrightPicks = picks;
  d.finishingFocus = "knacks";
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
  assignDragonCallingsAndKnacks(character.dragon, bundle, rng);
  assignDragonMagicAndBirthrights(character.dragon, bundle, rng);

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
