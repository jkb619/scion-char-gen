/**
 * Legendary Titles, Omen, Demigod birthright notes, and Titanic profile fillers
 * for random generation and mechanical flavor fallback.
 */

import { isPostHeroBandCallingTierId } from "./eligibility.js";
import { pick, shuffle } from "./randomChargenUtils.js";

const TITANIC_CALLING_IDS = new Set(["adversary", "destroyer", "monster", "primeval", "tyrant"]);

/** @type {Record<string, string[]>} */
const CALLING_TITLE_KEYWORDS = {
  hunter: ["Stalker", "Predator", "Tracker", "Huntsman", "Slayer", "Pursuer"],
  destroyer: ["Ruin", "Breaker", "Annihilator", "Wrecker", "Cataclysm", "Harbinger"],
  monster: ["Horror", "Beast", "Virulence", "Abomination", "Monstrosity", "Maw"],
  guardian: ["Shield", "Ward", "Bulwark", "Sentinel", "Protector", "Aegis"],
  judge: ["Scales", "Verdict", "Accuser", "Lawgiver", "Arbiter", "Condemnation"],
  leader: ["Banner", "Commander", "Sovereign", "Herald", "Regent", "Voice"],
  healer: ["Mender", "Salve", "Restorer", "Physician", "Mercy", "Renewal"],
  liminal: ["Threshold", "Wayfarer", "Border-Walker", "Passage", "Gatekeeper", "Between"],
  trickster: ["Riddle", "Fox", "Liar", "Jester", "Twist", "Gambit"],
  warrior: ["Blade", "Spear", "Champion", "Vanguard", "Wrath", "Conqueror"],
  sage: ["Oracle", "Lore", "Witness", "Archive", "Insight", "Cipher"],
  lover: ["Heart", "Desire", "Consort", "Passion", "Bond", "Devotion"],
  creator: ["Maker", "Forge", "Architect", "Demiurge", "Artisan", "Shaper"],
  adversary: ["Nemesis", "Opponent", "Rival", "Usurper", "Antagonist", "Foeman"],
  primeval: ["Ancient", "First-Born", "Primal", "Root", "Deep", "Ur-Beast"],
  tyrant: ["Iron Rule", "Dominion", "Overlord", "Chain", "Crush", "Despot"],
};

const TITLE_EPITHETS = ["Broken Crown", "Last Road", "Red Winter", "Ash Grove", "Black Waters", "Stone Circle"];
const TITLE_PLACES = ["the Wild", "the Underworld", "the Borderlands", "the Deep Wood", "the Fallen City"];

/** @param {Record<string, unknown>} character */
export function legendaryTitleLineCount(character) {
  const legend = Math.max(0, Math.round(Number(character.legendRating) || 0));
  if (legend > 0) return legend;
  const tier = String(character.tier || "").trim().toLowerCase();
  if (tier === "hero" || tier === "titanic") return Math.max(1, legend || 1);
  return 0;
}

/** @param {string} callingId @param {() => number} rng */
function pickKeywordForCalling(callingId, rng) {
  const pool = CALLING_TITLE_KEYWORDS[callingId] || CALLING_TITLE_KEYWORDS.hunter;
  return pick(pool, rng) || "Scion";
}

/**
 * @param {string} keyword
 * @param {string} callingName
 * @param {() => number} rng
 */
function formatLegendaryTitle(keyword, callingName, rng) {
  const roll = rng();
  if (roll < 0.34) return `The ${keyword} of ${pick(TITLE_PLACES, rng) || "the World"}`;
  if (roll < 0.67) return `${keyword} of the ${pick(TITLE_EPITHETS, rng) || "Lost"}`;
  return `The ${callingName}'s ${keyword}`;
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
export function assignLegendaryTitlesAndOmen(character, bundle, rng) {
  const need = legendaryTitleLineCount(character);
  if (need <= 0) return;

  const existing = String(character.legendaryTitles || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (existing.length >= need && String(character.omen || "").trim()) return;

  /** @type {{ id: string; name: string; dots: number }[]} */
  const slots = [];
  if (Array.isArray(character.callingSlots)) {
    for (const s of character.callingSlots) {
      const id = String(s?.id || "").trim();
      if (!id) continue;
      slots.push({
        id,
        name: String(bundle.callings?.[id]?.name || id),
        dots: Math.max(1, Math.round(Number(s.dots) || 1)),
      });
    }
  } else if (character.callingId) {
    const id = String(character.callingId).trim();
    slots.push({
      id,
      name: String(bundle.callings?.[id]?.name || id),
      dots: Math.max(1, Math.round(Number(character.callingDots) || 1)),
    });
  }

  /** @type {string[]} */
  const titles = [...existing];
  let guard = need * 4;
  while (titles.length < need && guard > 0) {
    guard -= 1;
    const slot = slots.length ? slots[titles.length % slots.length] : { id: "guardian", name: "Guardian", dots: 1 };
    const kw = pickKeywordForCalling(slot.id, rng);
    const title = formatLegendaryTitle(kw, slot.name, rng);
    if (!titles.includes(title)) titles.push(title);
  }
  while (titles.length < need) {
    titles.push(`Title ${titles.length + 1} — define at table`);
  }
  character.legendaryTitles = titles.slice(0, need).join("\n");

  if (!String(character.omen || "").trim()) {
    const first = titles[0] || "the Scion";
    const pant = bundle.pantheons?.[character.pantheonId];
    const pantName = pant?.name || character.pantheonId || "the divine";
    if (String(character.patronKind) === "titan") {
      character.omen = `When Momentum or Legend moves, ${first.toLowerCase()} leaves a trace — cracked earth, unnatural frost, or wolves answering from nowhere (${pantName}; Demigod p. 132).`;
    } else {
      character.omen = `When Momentum or Legend is spent, signs of ${first} manifest — light, sound, or symbol tied to ${pantName} (Hero/Demigod Omen rules).`;
    }
  }
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle */
export function assignDemigodBirthrightPickNotes(character, bundle) {
  if (!isPostHeroBandCallingTierId(character.tier)) return;
  if (!character.birthrightPickNotes || typeof character.birthrightPickNotes !== "object") {
    character.birthrightPickNotes = {};
  }
  const picks = character.finishing?.birthrightPicks;
  if (!Array.isArray(picks)) return;
  for (const bid of picks) {
    const id = String(bid || "").trim();
    if (!id || character.birthrightPickNotes[id]) continue;
    const br = bundle.birthrights?.[id];
    if (!br || br.birthrightType !== "creature") continue;
    const dots = Math.max(1, Math.round(Number(br.pointCost ?? br.dots ?? 2)));
    character.birthrightPickNotes[id] =
      `Demigod creature upgrades (Scion: Demigod p. 131): Divine Fortitude — attackers suffer Complication (counterattack penalty) equal to ${dots} dot${dots === 1 ? "" : "s"}; Supernal Skill — sacrifice 1 die (not 2) to add Knacks/Flairs. Record two Flair upgrades on the sheet.`;
  }
}

/** @param {Record<string, unknown>} character @param {Record<string, unknown>} bundle @param {() => number} rng */
export function assignTitanicProfileFallback(character, bundle, rng) {
  if (String(character.patronKind) !== "titan") return;
  if (!isPostHeroBandCallingTierId(character.tier) && String(character.tier) !== "titanic") return;
  if (!character.titanicProfile || typeof character.titanicProfile !== "object") {
    character.titanicProfile = {
      motif: "",
      mutationCallingId: "",
      mutationDots: 0,
      condition: "",
      suppressEpicenterNotes: "",
    };
  }
  const tp = character.titanicProfile;
  const kind = character.patronKind === "titan" ? "titans" : "deities";
  const pant = bundle.pantheons?.[character.pantheonId];
  const patrons = Array.isArray(pant?.[kind]) ? pant[kind] : [];
  const parent = patrons.find((r) => r && r.id === character.parentDeityId);
  const parentName = parent?.name || character.parentDeityId || "the Titan";

  /** @type {string[]} */
  const slotIds = [];
  if (Array.isArray(character.callingSlots)) {
    for (const s of character.callingSlots) {
      const id = String(s?.id || "").trim();
      if (id) slotIds.push(id);
    }
  }

  if (!String(tp.motif || "").trim()) {
    tp.motif = `Titan-blood of ${parentName} — ${String(character.concept || "a Titanic Scion").replace(/\.$/, "")}.`;
  }
  if (!String(tp.mutationCallingId || "").trim()) {
    const titanCall = slotIds.find((id) => TITANIC_CALLING_IDS.has(id)) || pick([...TITANIC_CALLING_IDS], rng) || "monster";
    tp.mutationCallingId = titanCall;
  }
  if (!Math.round(Number(tp.mutationDots) || 0)) {
    const slot = (character.callingSlots || []).find((s) => String(s?.id) === tp.mutationCallingId);
    const dots = Math.max(1, Math.min(3, Math.round(Number(slot?.dots) || 2)));
    tp.mutationDots = dots;
  }
  if (!String(tp.condition || "").trim()) {
    const conds = [
      "Collateral surges when Legend is spent unchecked (Titans Rising).",
      "Mutation flares when insulted or when the band breaks a sworn oath.",
      "Epicenter pressure builds after using Titanic Knacks in populated areas.",
    ];
    tp.condition = pick(conds, rng) || conds[0];
  }
  if (!String(tp.suppressEpicenterNotes || "").trim()) {
    tp.suppressEpicenterNotes =
      "Note Epicenter triggers, collateral, and Maelstrom hooks at table (Saints & Monsters / Titans Rising). Suppression requires focus and may fail under stress.";
  }
}

/**
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {() => number} [rng]
 */
export function assignScionMantleExtras(character, bundle, rng = Math.random) {
  assignLegendaryTitlesAndOmen(character, bundle, rng);
  assignDemigodBirthrightPickNotes(character, bundle);
  assignTitanicProfileFallback(character, bundle, rng);
}

/** @param {Record<string, unknown>} character */
export function ensureMantleExtrasShape(character) {
  if (character.legendaryTitles == null || typeof character.legendaryTitles !== "string") character.legendaryTitles = "";
  if (character.omen == null || typeof character.omen !== "string") character.omen = "";
  if (!character.birthrightPickNotes || typeof character.birthrightPickNotes !== "object") {
    character.birthrightPickNotes = {};
  }
}
