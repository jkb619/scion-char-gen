/**
 * Shared helpers for random character generators (no eligibility/bundle logic).
 */

export const NAME_PARTS = [
  "Alex",
  "Jordan",
  "Riley",
  "Morgan",
  "Casey",
  "Sam",
  "Quinn",
  "Avery",
  "Dakota",
  "River",
  "Sage",
  "Phoenix",
];

/** @returns {() => number} */
export function createRng(seed) {
  if (seed == null) return Math.random;
  let s = Math.abs(Math.trunc(Number(seed))) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** @template T @param {T[]} arr @param {() => number} rng */
export function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** @template T @param {T[]} arr @param {() => number} rng */
export function pick(arr, rng) {
  if (!arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

/** Hero Visitation / Demigod+ three-row Calling layout: each row 1–5 dots, exact total. */
export const HERO_CREATION_CALLING_DOTS = 5;

/**
 * Spread `totalDots` across three Calling rows (min 1, max 5 per row).
 * @param {number} totalDots
 * @param {() => number} rng
 * @returns {[number, number, number]}
 */
export function distributeThreeRowCallingDots(totalDots, rng) {
  const dots = [1, 1, 1];
  let sum = 3;
  const target = Math.max(3, Math.min(15, Math.round(Number(totalDots) || 3)));
  let guard = 0;
  while (sum < target && guard < 48) {
    guard += 1;
    const i = Math.floor(rng() * 3);
    if (dots[i] < 5) {
      dots[i] += 1;
      sum += 1;
    }
  }
  guard = 0;
  while (sum > target && guard < 48) {
    guard += 1;
    let moved = false;
    for (let i = 2; i >= 0 && sum > target; i -= 1) {
      if (dots[i] > 1) {
        dots[i] -= 1;
        sum -= 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return /** @type {[number, number, number]} */ (dots);
}

/**
 * @param {string} encoded — `deity:hero`, `dragon:3`, `sorcerer:sorcerer_hero`, …
 */
export function parseWelcomeTrack(encoded) {
  const raw = String(encoded || "deity:mortal").trim();
  const idx = raw.indexOf(":");
  const lane = idx === -1 ? "deity" : raw.slice(0, idx);
  const payload = idx === -1 ? "mortal" : raw.slice(idx + 1);
  return { lane, payload };
}

/** @returns {Record<string, unknown>} */
export function emptyCharacterShape() {
  return {
    tier: "mortal",
    characterName: "",
    concept: "",
    deeds: { short: "", long: "", band: "", mythos: "" },
    paths: { origin: "", role: "", society: "" },
    pantheonId: "",
    virtueSpectrum: 0,
    parentDeityId: "",
    patronKind: "deity",
    pathRank: { primary: "origin", secondary: "role", tertiary: "society" },
    pathSkills: { origin: [], role: [], society: [] },
    pathSkillRedistribution: {},
    pathSkillRedistSourceHash: null,
    skillDots: {},
    skillSpecialties: {},
    attributes: {},
    favoredApproach: "Force",
    arenaRank: ["Social", "Mental", "Physical"],
    callingId: "",
    callingDots: 1,
    callingSlots: null,
    knackSlotById: {},
    knackLockedRowBudgetCostById: {},
    lockedKnackIds: [],
    finishingBonusKnackIds: [],
    experienceKnackIds: [],
    experienceBoonIds: [],
    lockedBoonIds: [],
    carriedExperienceKnackIds: [],
    experienceAttributeBumps: {},
    experienceSkillBumps: {},
    knackIds: [],
    purviewIds: [],
    patronPurviewSlots: ["", "", "", ""],
    boonIds: [],
    dominionBoonPurviewIds: [],
    dominionBoonForgoneByPurview: {},
    dominionBoonForgoneXpByPurview: {},
    experiencePoints: 0,
    experiencePointsSpent: 0,
    experiencePurchaseLog: [],
    experienceBirthrightPickIds: [],
    birthrightIds: [],
    legendRating: 0,
    awarenessRating: 1,
    legendPoolDotSpentSlots: [],
    awarenessPoolDotSpentSlots: [],
    tierAdvancementLog: [],
    finishing: {
      extraSkillDots: 5,
      extraAttributeDots: 1,
      knackOrBirthright: "knacks",
      sorcererMortalFinishingPackage: "four_paraphernalia",
      sorcererMortalExtraTechniquesNotes: "",
      skillBaseline: null,
      attrBaseline: null,
      finishingKnackIds: [],
      birthrightPicks: [],
    },
    notes: "",
    sheetDescription: "",
    sheetEquipmentIds: [],
    fatebindings: [],
    sheetNotesExtra: "",
    chargenLineage: "scion",
  };
}
