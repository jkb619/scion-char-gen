/**
 * Knack / Boon eligibility for chargen UI (data-driven gates in JSON + character state).
 * @typedef {{ tier?: string; callingId?: string; callingDots?: number; callingSlots?: { id?: string; dots?: number }[]; pantheonId?: string; parentDeityId?: string; patronKind?: string; purviewIds?: string[]; patronPurviewSlots?: string[]; mythosInnatePower?: { style?: string; awarenessPurviewId?: string; awarenessLocked?: boolean }; legendRating?: number; awarenessRating?: number; boonIds?: string[]; pathRank?: { primary?: string }; knackIds?: string[]; knackSlotById?: Record<string, number>; dragonHeirCallingKnackShell?: boolean }} CharacterLike
 */

const TIER_RANK = {
  mortal: 0,
  sorcerer: 0,
  hero: 1,
  titanic: 1,
  sorcerer_hero: 1,
  demigod: 2,
  sorcerer_demigod: 2,
  god: 3,
  sorcerer_god: 3,
};

function tierRank(tierId) {
  const t = String(tierId ?? "mortal").trim().toLowerCase();
  if (t === "origin") return 0;
  return TIER_RANK[t] ?? 0;
}

function normalizedTierIdEligibility(tierId) {
  const raw = String(tierId ?? "mortal").trim().toLowerCase();
  if (raw === "origin") return "mortal";
  return raw;
}

const SORCERER_LINE_TIER_IDS = new Set(["sorcerer", "sorcerer_hero", "sorcerer_demigod", "sorcerer_god"]);

/** Saints & Monsters Sorcerer track: no Scion Callings or Knacks (chargen pp. 83–87). */
export function isSorcererLineTierId(tierId) {
  return SORCERER_LINE_TIER_IDS.has(normalizedTierIdEligibility(tierId));
}

/** Demigod- and God-band tiers: deity line (Hero→Demigod→God), Titan line (Titanic→Demigod→God), Sorcerer divine band. */
export function isPostHeroBandCallingTierId(tierId) {
  const t = normalizedTierIdEligibility(tierId);
  return t === "demigod" || t === "god" || t === "sorcerer_demigod" || t === "sorcerer_god";
}

/** Hero / Titanic / Heroic Sorcerer: two starting Purview Boons on the wizard Boons step (Hero-style chargen). */
export const MAX_HERO_BAND_WIZARD_BOON_PICKS = 2;

/**
 * Boons wizard: cap at {@link MAX_HERO_BAND_WIZARD_BOON_PICKS} for Hero-band tiers; uncapped when `tier.json`
 * lists a `boons` step for any other tier (Demigod, God, divine-band Sorcerer, etc.). Tiers without a Boons step
 * use the Hero-band cap so stray imports stay bounded. If the bundle row is missing, Demigod+ ids still return
 * uncapped picks (same as `isPostHeroBandCallingTierId`).
 *
 * @param {string | undefined} tierId
 * @param {{ tier?: Record<string, { wizardSteps?: string[] }> }} [bundle]
 */
export function maxWizardBoonPicksForTier(tierId, bundle) {
  const t = normalizedTierIdEligibility(tierId);
  const tierRow = bundle?.tier?.[t];
  const steps = tierRow && Array.isArray(tierRow.wizardSteps) ? tierRow.wizardSteps : null;
  if (steps && steps.includes("boons")) {
    if (t === "hero" || t === "titanic" || t === "sorcerer_hero") return MAX_HERO_BAND_WIZARD_BOON_PICKS;
    return Number.POSITIVE_INFINITY;
  }
  if (isPostHeroBandCallingTierId(t)) return Number.POSITIVE_INFINITY;
  return MAX_HERO_BAND_WIZARD_BOON_PICKS;
}

/**
 * Hero-band tiers (Hero / Titanic / Heroic Sorcerer): one Immortal Knack costs two Calling “slots”
 * and must sit on a Calling row with two+ dots (Hero p.184). Demigod/God use 1:1 slots (no double cost).
 * @param {string | undefined} tierId
 */
export function immortalKnackCostsTwoCallingSlots(tierId) {
  const t = normalizedTierIdEligibility(tierId);
  return t === "hero" || t === "titanic";
}

const HERO_STYLE_CALLING_SLOT_ROW_COUNT = 3;

/**
 * Hero / Titanic: always three Calling rows.
 * Demigod and God (deity or Titan welcome line): keep the same three `callingSlots` when carried
 * forward from Hero/Titanic so Calling / Knacks / export stay aligned. Sorcerer tiers never use this.
 */
export function heroUsesCallingSlotRows(character) {
  const t = normalizedTierIdEligibility(character?.tier);
  if (t === "hero" || t === "titanic") return true;
  const slots = character?.callingSlots;
  if (Array.isArray(slots) && slots.length === HERO_STYLE_CALLING_SLOT_ROW_COUNT && isPostHeroBandCallingTierId(t)) {
    return true;
  }
  return false;
}

function sumHeroCallingSlotDots(character) {
  const slots = character?.callingSlots;
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(slots) || slots.length === 0) return null;
  let sum = 0;
  for (const s of slots) {
    sum += Math.max(1, Math.min(5, Math.round(Number(s?.dots) || 1)));
  }
  return sum;
}

/** Largest dot rating among Hero Calling rows (for Hero-band Immortal Knack gate). */
function maxHeroCallingSlotDotCount(character) {
  const slots = character?.callingSlots;
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(slots)) return null;
  let m = 0;
  for (const s of slots) {
    const d = Math.max(1, Math.min(5, Math.round(Number(s?.dots) || 1)));
    if (d > m) m = d;
  }
  return m;
}

/**
 * @param {CharacterLike} character
 * @param {{ pantheons?: Record<string, unknown>; purviews?: Record<string, unknown> }} [bundle]
 */
function patronPurviewIdsFromDeity(character, bundle) {
  const pantId = String(character?.pantheonId ?? "").trim();
  const deityId = String(character?.parentDeityId ?? "").trim();
  if (!pantId || !deityId || !bundle?.pantheons || typeof bundle.pantheons !== "object") return null;
  const pant = bundle.pantheons[pantId];
  if (!pant || typeof pant !== "object") return null;
  const deities = Array.isArray(pant.deities) ? pant.deities : [];
  const deity = deities.find((d) => d && typeof d === "object" && d.id === deityId);
  const raw = Array.isArray(deity?.purviews) ? deity.purviews : [];
  const ids = raw.filter((x) => typeof x === "string" && x.trim());
  return ids.length ? ids : null;
}

/**
 * Purview ids used for Knack/Boon gates: merged sheet list plus any Patron Purview slots
 * (Paths) so eligibility stays aligned if `purviewIds` and slots are briefly out of sync.
 * Mythos: committed Awareness Innate is always included. A draft Awareness Purview (dropdown
 * before commit) counts when it is on the divine parent’s patron list and does not conflict with
 * a different patron chip in slot 0, so Boons match the Purview the player is selecting.
 *
 * @param {CharacterLike} character
 * @param {{ pantheons?: Record<string, unknown>; purviews?: Record<string, unknown> }} [bundle] — pass from callers that have bundle (Boons/Knacks); optional for back-compat
 */
export function characterPurviewIdSet(character, bundle) {
  const out = new Set((character.purviewIds || []).filter((id) => typeof id === "string" && id.trim()));
  for (const s of character.patronPurviewSlots || []) {
    if (typeof s === "string" && s.trim()) out.add(s.trim());
  }
  const mi = character.mythosInnatePower;
  if (mi && typeof mi === "object") {
    const ap = String(mi.awarenessPurviewId || "").trim();
    if (!ap) return out;
    if (mi.awarenessLocked === true) {
      out.add(ap);
    } else if (String(character.pantheonId || "").trim() === "mythos" && bundle?.purviews?.[ap]) {
      const parentList = patronPurviewIdsFromDeity(character, bundle);
      if (parentList && parentList.includes(ap)) {
        const slot0 = String(character.patronPurviewSlots?.[0] || "").trim();
        if (!slot0 || slot0 === ap) out.add(ap);
      }
    }
  }
  return out;
}

/** MotM inverted ↔ normal Calling pairs (see `data/callings.json`). */
const MYTHOS_INVERTED_CALLING_TWIN = {
  creator: "destroyer",
  destroyer: "creator",
  guardian: "corruptor",
  corruptor: "guardian",
  healer: "defiler",
  defiler: "healer",
  lover: "adversary",
  adversary: "lover",
  leader: "tyrant",
  tyrant: "leader",
  sage: "cosmos",
  cosmos: "sage",
  warrior: "torturer",
  torturer: "warrior",
};

/** Standard Storypath Calling ids that MotM replaces with an inverted Calling in the chooser. */
const MYTHOS_NORMAL_CALLING_IDS = new Set([
  "creator",
  "guardian",
  "healer",
  "lover",
  "leader",
  "sage",
  "warrior",
]);

/**
 * MotM Mythos: patron data may list a standard Calling id; the wizard only offers the inverted Calling (e.g. Sage → Cosmos).
 * @param {string} [callingId]
 * @returns {string}
 */
export function mythosPatronCallingIdForChooser(callingId) {
  const id = String(callingId ?? "").trim();
  if (!id) return id;
  const twin = mythosCallingTwinId(id);
  if (twin && MYTHOS_NORMAL_CALLING_IDS.has(id)) return twin;
  return id;
}

/**
 * True for the MotM inverted side of a normal↔inverted pair (Cosmos, Destroyer, …). False for standard Callings and unpaired ids (Liminal, Monster, …).
 * @param {string} [callingId]
 */
export function isMythosInvertedTwinCallingId(callingId) {
  const id = String(callingId ?? "").trim();
  if (!id) return false;
  const twin = mythosCallingTwinId(id);
  return !!(twin && MYTHOS_NORMAL_CALLING_IDS.has(twin));
}

/**
 * Wizard Calling pickers: non-Mythos omits MotM inverted twins; Mythos omits the standard side when an inverted twin exists in the bundle.
 * @param {string} callingId
 * @param {{ callings?: Record<string, unknown> }} bundle
 * @param {boolean} mythosPantheon
 */
export function callingIdInWizardLibraryChooser(callingId, bundle, mythosPantheon) {
  const cid = String(callingId || "").trim();
  if (!cid || cid.startsWith("_") || !bundle?.callings?.[cid]) return false;
  if (mythosPantheon) return cid === mythosPatronCallingIdForChooser(cid);
  return !isMythosInvertedTwinCallingId(cid);
}

/**
 * @param {string} [callingId]
 * @returns {string | null}
 */
export function mythosCallingTwinId(callingId) {
  const id = String(callingId ?? "").trim();
  if (!id) return null;
  return MYTHOS_INVERTED_CALLING_TWIN[id] || null;
}

/**
 * MotM pp. 47–48 Knacks: if the knack lists one member of an inverted pair, the paired Calling also qualifies.
 * @param {Record<string, unknown>} knack
 * @param {string[]} list
 */
function expandMotmMythosKnackCallingIds(knack, list) {
  if (!Array.isArray(list) || !list.length) return list;
  const kid = String(knack?.id ?? "");
  if (!kid.startsWith("mythos_")) return list;
  const pant = Array.isArray(knack?.pantheonAnyOf) ? knack.pantheonAnyOf : [];
  if (!pant.includes("mythos")) return list;
  const out = new Set(list);
  for (const cid of list) {
    const t = mythosCallingTwinId(cid);
    if (t) out.add(t);
  }
  return [...out];
}

/**
 * Calling ids used for Knack eligibility. Mythos (MotM): includes the paired normal/inverted Calling so e.g. Cosmos also counts as Sage for core-book Knacks.
 * @param {CharacterLike} character
 * @returns {Set<string>}
 */
export function mythosCharacterCallingIdsForKnacks(character) {
  const out = new Set();
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    for (const s of character.callingSlots) {
      const id = String(s?.id ?? "").trim();
      if (id) out.add(id);
    }
  } else {
    const cid = String(character?.callingId ?? "").trim();
    if (cid) out.add(cid);
  }
  if (String(character?.pantheonId ?? "").trim() === "mythos") {
    const extras = new Set();
    for (const cid of out) {
      const twin = mythosCallingTwinId(cid);
      if (twin) extras.add(twin);
    }
    for (const e of extras) out.add(e);
  }
  return out;
}

/**
 * Resolve a Knack row from the merged deity/titan catalog or the Dragon Heir Calling catalog.
 * @param {string} kid
 * @param {{ knacks?: Record<string, unknown>; dragonCallingKnacks?: Record<string, unknown> }} [bundle]
 * @returns {Record<string, unknown> | null}
 */
export function bundleKnackById(kid, bundle) {
  const k = String(kid ?? "").trim();
  if (!k || k.startsWith("_")) return null;
  const main = bundle?.knacks?.[k];
  if (main && typeof main === "object") return /** @type {Record<string, unknown>} */ (main);
  const dr = bundle?.dragonCallingKnacks?.[k];
  if (dr && typeof dr === "object") return /** @type {Record<string, unknown>} */ (dr);
  return null;
}

/**
 * Calling-dot–equivalent cost per Knack.
 * Hero-band: Heroic = 1; Immortal = 2 (Hero p.184). Post-Hero: Immortal and Heroic each = 1 (Demigod pp.149–150).
 * @param {Record<string, unknown> | null} k
 * @param {{ tier?: string } | null} [character] — omit for legacy callers (treated as Hero-band costs).
 */
export function knackCallingSlotCost(k, character) {
  if (!k || typeof k !== "object") return 1;
  if (k.knackKind !== "immortal") return 1;
  if (character?.tier != null && !immortalKnackCostsTwoCallingSlots(character.tier)) return 1;
  return 2;
}

function heroCallingSlotRowDots(character, rowIdx) {
  const slots = character?.callingSlots;
  if (!Array.isArray(slots) || rowIdx < 0 || rowIdx >= slots.length) return 0;
  return Math.max(1, Math.min(5, Math.round(Number(slots[rowIdx]?.dots) || 1)));
}

/** Tokens for “this row’s Calling” when matching Knack data: row id plus MotM twin when Mythos. */
function slotRowCallingTokenSet(rowCallingId, character) {
  const cid = String(rowCallingId ?? "").trim();
  if (!cid) return new Set();
  const out = new Set([cid]);
  if (String(character?.pantheonId ?? "").trim() === "mythos") {
    const t = mythosCallingTwinId(cid);
    if (t) out.add(t);
  }
  return out;
}

/**
 * Knacks shown under Origin / Finishing “Any Calling” (general pool): explicit any-Calling, no list,
 * or PB-style “one of several Callings” rows. These may sit on a Hero `callingSlots` row whose Calling
 * is not chosen yet (`id: ""`) until Visitation rows are filled — same idea as {@link originCallingKnackChipGroupKey}.
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} [_character]
 */
export function knackMayUsePendingHeroCallingRow(k, _character) {
  if (!k || typeof k !== "object") return false;
  if (k.callingsAny === true || k.calling === "any") return true;
  const raw = knackRawCallingIdList(k);
  if (raw.length === 0) return true;
  if (new Set(raw).size >= 2) return true;
  return false;
}

/**
 * Origin / single-Calling Calling step: chip group heading (mirrors Hero row vs “Any Calling”).
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 * @returns {"selected" | "any"}
 */
export function originCallingKnackChipGroupKey(k, character) {
  if (!k || typeof k !== "object") return "any";
  if (knackMayUsePendingHeroCallingRow(k, character)) return "any";
  const knTok = knackCallingTokensForRowMatch(k, character);
  if (knTok === null || knTok.size === 0) return "any";
  const cid = String(character?.callingId ?? "").trim();
  if (!cid) return "any";
  const rowTok = slotRowCallingTokenSet(cid, character);
  for (const x of knTok) {
    if (rowTok.has(x)) return "selected";
  }
  return "any";
}

/**
 * Calling ids from Knack JSON (MotM twin expansion for `mythos_` MotM Knacks only).
 * @param {Record<string, unknown>} k
 * @returns {string[]}
 */
function knackRawCallingIdList(k) {
  if (!k || typeof k !== "object") return [];
  if (k.callingsAny === true || k.calling === "any") return [];
  const list = Array.isArray(k.callings) ? k.callings : k.calling ? [k.calling] : [];
  return list.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
}

/**
 * Expanded Calling ids for matching a Hero Calling row (same rules as `knackEligible` + row twin set).
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 * @returns {Set<string> | null} `null` = any Calling (all filled rows may pay).
 */
export function knackCallingTokensForRowMatch(k, character) {
  if (!k || typeof k !== "object") return new Set();
  if (k.callingsAny === true || k.calling === "any") return null;
  const raw = knackRawCallingIdList(k);
  if (!raw.length) return new Set();
  const expanded = expandMotmMythosKnackCallingIds(k, raw);
  return new Set(expanded);
}

/**
 * @param {Record<string, unknown>} k
 * @param {{ callings?: Record<string, { name?: string }> }} [bundle]
 * @returns {string} Short line for tooltips: “Applies to: …”.
 */
export function knackAppliesToCallingsLine(k, bundle) {
  if (!k || typeof k !== "object") return "";
  if (k.callingsAny === true || k.calling === "any") return "Applies to: any Calling.";
  const raw = knackRawCallingIdList(k);
  if (!raw.length) return "";
  const expanded = expandMotmMythosKnackCallingIds(k, raw);
  const callings = bundle?.callings || {};
  const names = [...new Set(expanded)]
    .map((id) => (callings[id] && typeof callings[id] === "object" ? String(callings[id].name || "").trim() : "") || id)
    .filter(Boolean);
  if (!names.length) return "";
  return `Applies to: ${names.join(", ")}.`;
}

export function heroCallingRowMatchesKnack(rowIdx, k, character, _bundle) {
  const slots = character?.callingSlots;
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(slots)) return false;
  if (rowIdx < 0 || rowIdx >= slots.length) return false;
  const rowId = String(slots[rowIdx]?.id ?? "").trim();
  const knTok = knackCallingTokensForRowMatch(k, character);
  /**
   * After Mortal→Hero, `initHeroCallingSlotsAfterVisitation` leaves rows 1–2 at 1 dot each with `id: ""`
   * until the Calling step picks Visitation Callings. Only row 0 has a Calling id, so without this rule
   * `solveHeroKnackSlotAssignment` could place at most one Knack; `pruneKnackIdsToCallingSlotCap` then
   * drops trailing picks — including the two Origin Finishing bonus Knacks merged into `knackIds`.
   * Match the Finishing “Any Calling” bucket ({@link knackMayUsePendingHeroCallingRow}), not only
   * `knTok === null` — multi-Calling (“one of …”) rows use a non-null Set and still belong in that pool.
   */
  if (!rowId) return knackMayUsePendingHeroCallingRow(k, character);
  const rowTok = slotRowCallingTokenSet(rowId, character);
  if (knTok === null) return true;
  for (const x of knTok) {
    if (rowTok.has(x)) return true;
  }
  return false;
}

/**
 * Assign each main Knack to a Calling row so each row’s spent cost ≤ that row’s dots (Hero `callingSlots`).
 * Hero-band: Immortal only on rows with two+ dots, costs two slots, at most one Immortal in the list.
 * Post-Hero: Immortal costs one slot per row dot like Heroic; multiple Immortals allowed if rows allow.
 * @param {string[]} knackIds
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {Record<string, number> | null}
 */
export function solveHeroKnackSlotAssignment(knackIds, character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return {};
  const ids = [...(knackIds || [])].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  const heroImm = immortalKnackCostsTwoCallingSlots(character.tier);
  if (heroImm && immortalKnackCountInList(ids, bundle) > 1) return null;
  if (ids.length === 0) return {};
  const slots = character.callingSlots;
  const rowCount = slots.length;
  const rowCaps = slots.map((_, i) => heroCallingSlotRowDots(character, i));
  const n = ids.length;
  const minDotsForImmortalRow = heroImm ? 2 : 1;

  function dfs(i, rowUsed, slotMap) {
    if (i >= n) return { ...slotMap };
    const kid = ids[i];
    const kn = bundleKnackById(kid, bundle);
    if (!kn) return null;
    const cost = knackCallingSlotCost(kn, character);
    for (let r = 0; r < rowCount; r += 1) {
      if (!heroCallingRowMatchesKnack(r, kn, character, bundle)) continue;
      if (kn.knackKind === "immortal" && rowCaps[r] < minDotsForImmortalRow) continue;
      if (rowUsed[r] + cost > rowCaps[r]) continue;
      rowUsed[r] += cost;
      slotMap[kid] = r;
      const solved = dfs(i + 1, rowUsed, slotMap);
      if (solved) return solved;
      rowUsed[r] -= cost;
      delete slotMap[kid];
    }
    return null;
  }
  return dfs(0, rowCaps.map(() => 0), {});
}

/**
 * Whether each main Knack can be assigned to some row without exceeding that row’s dots (and Hero-band Immortal count).
 * @param {string[]} knackIds
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function heroKnackSlotAssignmentExists(knackIds, character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return true;
  return solveHeroKnackSlotAssignment(knackIds, character, bundle) != null;
}

/**
 * Sync `character.knackSlotById` with `character.knackIds` for Hero three-row mode; drop trailing Knacks if no assignment fits.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function syncHeroKnackSlotAssignments(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) {
    if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
    else for (const k of Object.keys(character.knackSlotById)) delete character.knackSlotById[k];
    return;
  }
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const map = character.knackSlotById;
  let cur = [...(character.knackIds || [])].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  for (const key of Object.keys(map)) {
    if (!cur.includes(key)) delete map[key];
  }
  while (cur.length > 0) {
    const sol = solveHeroKnackSlotAssignment(cur, character, bundle);
    if (sol) {
      for (const key of Object.keys(map)) delete map[key];
      Object.assign(map, sol);
      character.knackIds = cur;
      return;
    }
    cur.pop();
  }
  for (const key of Object.keys(map)) delete map[key];
  character.knackIds = cur;
}

/**
 * Max Knack “slots” from Calling rating: Origin / Mortal / Sorcerer = 1; Hero with `callingSlots` = sum of row dots (cap 5 for core Scion Hero); other Hero+ = `callingDots` (1–5).
 * Dragon Heir (`dragonHeirCallingKnackShell`) can exceed five total Calling dots across three rows (Scion: Dragon); use the same upper bound as post–Hero-band rows (15) so slot totals match `sumHeroCallingSlotDots`.
 */
export function callingKnackSlotCap(character) {
  const t = String(character?.tier ?? "mortal").trim().toLowerCase();
  const norm = t === "origin" ? "mortal" : t;
  if (norm === "mortal" || norm === "sorcerer") return 1;
  const sumSlots = sumHeroCallingSlotDots(character);
  if (sumSlots != null && sumSlots > 0) {
    const dragonHeirShell = character?.dragonHeirCallingKnackShell === true;
    const cap = isPostHeroBandCallingTierId(norm) || dragonHeirShell ? 15 : 5;
    return Math.max(1, Math.min(cap, sumSlots));
  }
  const d = Math.round(Number(character?.callingDots) || 1);
  return Math.max(1, Math.min(5, d));
}

/** Sum of slot costs for the given knack id list. */
export function knackIdsCallingSlotsUsed(knackIds, bundle, character) {
  let sum = 0;
  for (const id of knackIds || []) {
    if (typeof id !== "string" || !id.trim() || id.startsWith("_")) continue;
    const kn = bundleKnackById(id, bundle);
    sum += knackCallingSlotCost(kn, character);
  }
  return sum;
}

export function immortalKnackCountInList(knackIds, bundle) {
  let n = 0;
  for (const id of knackIds || []) {
    const kn = bundleKnackById(id, bundle);
    if (kn?.knackKind === "immortal") n += 1;
  }
  return n;
}

/**
 * Hero+ (Scion: Hero / Saints & Monsters Step Five): total slot cost ≤ Calling dots.
 * Hero-band: at most one Immortal (two slots); needs two+ Calling dots if any Immortal.
 * Post-Hero: Immortal and Heroic each one slot; no cap on Immortal count beyond dot budget.
 */
export function knackSetWithinCallingSlots(knackIds, character, bundle) {
  const cap = callingKnackSlotCap(character);
  const used = knackIdsCallingSlotsUsed(knackIds, bundle, character);
  if (used > cap) return false;
  const tr = tierRank(character.tier);
  const imm = immortalKnackCountInList(knackIds, bundle);
  if (tr <= 0) return imm === 0;
  const heroImm = immortalKnackCostsTwoCallingSlots(character.tier);
  if (heroImm) {
    if (imm > 1) return false;
    if (cap < 2 && imm > 0) return false;
  }
  return true;
}

/** Drop picks from the end until the set fits Calling slot rules (import / lower Calling dots). */
export function pruneKnackIdsToCallingSlotCap(knackIds, character, bundle) {
  const arr = [...(knackIds || [])].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    while (arr.length > 0 && solveHeroKnackSlotAssignment(arr, character, bundle) == null) {
      arr.pop();
    }
    return arr;
  }
  while (arr.length > 0 && !knackSetWithinCallingSlots(arr, character, bundle)) {
    arr.pop();
  }
  return arr;
}

/**
 * Hero+ Finishing “extra” Knacks (e.g. Hero p. 99): same data gates as `knackEligible`, do **not**
 * spend Calling dot budget. Hero-band: combined Calling + Finishing Immortal count capped at one
 * (and Immortal needs two+ Calling dots). Post-Hero: no separate Immortal count cap.
 */
export function knackEligibleForFinishingExtraKnack(k, character, bundle) {
  if (!knackEligible(k, character, bundle)) return false;
  const kid = String(k?.id ?? "").trim();
  if (!kid) return false;
  const main = character.knackIds || [];
  const finRaw = character.finishing?.finishingKnackIds;
  const fin = Array.isArray(finRaw) ? finRaw : [];
  if (main.includes(kid)) return false;
  if (fin.includes(kid)) return false;

  const tr = tierRank(character.tier);
  if (tr < 1) return true;

  const combined = [...main, ...fin, kid];
  const imm = immortalKnackCountInList(combined, bundle);
  const heroImm = immortalKnackCostsTwoCallingSlots(character.tier);
  if (heroImm && imm > 1) return false;
  const minCapForImm = heroImm ? 2 : 1;
  if (k.knackKind === "immortal" && callingKnackSlotCap(character) < minCapForImm) return false;
  return true;
}

/**
 * Whether a Knack id already listed in `finishingKnackIds` is still valid to keep (gates + Hero-band Immortal cap in Calling ∪ Finishing).
 */
export function knackFinishingPickIsValidHeld(k, character, bundle) {
  if (!k || typeof k !== "object") return false;
  const kid = String(k.id ?? "").trim();
  if (!kid) return false;
  const finRaw = character.finishing?.finishingKnackIds;
  const fin = Array.isArray(finRaw) ? finRaw : [];
  if (!fin.includes(kid)) return false;
  if (!knackEligible(k, character, bundle)) return false;
  const main = character.knackIds || [];
  if (main.includes(kid)) return false;
  const tr = tierRank(character.tier);
  if (tr < 1) return true;
  if (!immortalKnackCostsTwoCallingSlots(character.tier)) return true;
  const combined = [...main, ...fin];
  return immortalKnackCountInList(combined, bundle) <= 1;
}

/**
 * Knack can be shown / toggled on the Calling step: passes data gates and fits Calling slot budget.
 * (Finishing “extra Knacks” use `knackEligibleForFinishingExtraKnack` — they do not spend Calling dots.)
 */
export function knackEligibleForCallingStep(k, character, bundle) {
  if (!knackEligible(k, character, bundle)) return false;
  const kid = String(k?.id ?? "").trim();
  if (!kid) return false;
  const cur = character.knackIds || [];
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    const list = cur.includes(kid) ? cur : [...cur, kid];
    return solveHeroKnackSlotAssignment(list, character, bundle) != null;
  }
  if (cur.includes(kid)) return true;
  return knackSetWithinCallingSlots([...cur, kid], character, bundle);
}

/**
 * @param {Record<string, unknown>} k — one knack object from bundle.knacks
 * @param {CharacterLike} character
 * @param {Record<string, unknown>} [_bundle]
 */
export function knackEligible(k, character, _bundle) {
  if (!k || typeof k !== "object") return false;
  if (isSorcererLineTierId(character?.tier)) return false;

  const callingsAny = k.callingsAny === true || k.calling === "any";
  const list = Array.isArray(k.callings) ? k.callings : k.calling ? [k.calling] : null;
  if (!callingsAny) {
    let allowed = list || [];
    if (allowed.length) {
      allowed = expandMotmMythosKnackCallingIds(k, allowed);
      const charCallings = mythosCharacterCallingIdsForKnacks(character);
      if (!allowed.some((kc) => typeof kc === "string" && charCallings.has(kc))) return false;
    }
  }

  const tr = tierRank(character.tier);
  const tMin = k.tierMin != null ? tierRank(k.tierMin) : 0;
  const tMax = k.tierMax != null ? tierRank(k.tierMax) : 3;
  if (tr < tMin || tr > tMax) return false;

  /** Origin / Mortal (and Sorcerer) play tier: only Mortal Knacks, never Immortal (two-slot) Knacks. */
  if (tr === 0 && k.knackKind === "immortal") return false;

  const pv = k.purviewAnyOf;
  if (Array.isArray(pv) && pv.length) {
    const set = characterPurviewIdSet(character, _bundle);
    if (!pv.some((id) => set.has(id))) return false;
  }

  const pant = k.pantheonAnyOf;
  if (Array.isArray(pant) && pant.length) {
    if (!pant.includes(character.pantheonId)) return false;
  }

  const deityReq = k.deityAnyOf;
  if (Array.isArray(deityReq) && deityReq.length) {
    if (!deityReq.includes(character.parentDeityId)) return false;
  }

  const patronKinds = k.patronKindAnyOf;
  if (Array.isArray(patronKinds) && patronKinds.length) {
    const cur = String(character?.patronKind ?? "deity").trim() === "titan" ? "titan" : "deity";
    if (!patronKinds.includes(cur)) return false;
  }

  const leg = k.legendMin != null ? Number(k.legendMin) : null;
  if (leg != null && !Number.isNaN(leg)) {
    const lr = Math.round(Number(character.legendRating) || 0);
    if (lr < leg) return false;
  }

  /** Hero-band Immortal Knacks need a Calling row (or single Calling rating) of at least two dots (Hero p.184). */
  if (k.knackKind === "immortal" && immortalKnackCostsTwoCallingSlots(character.tier)) {
    const maxRow = maxHeroCallingSlotDotCount(character);
    if (maxRow != null) {
      if (maxRow < 2) return false;
    } else if (callingKnackSlotCap(character) < 2) return false;
  }

  return true;
}

/**
 * Purview ids that gate a Boon (any match to the character’s Purview set allows the pick).
 * @param {Record<string, unknown>} b
 * @returns {string[]}
 */
export function boonPurviewGateIds(b) {
  if (!b || typeof b !== "object") return [];
  const multi = Array.isArray(b.purviews) ? b.purviews.filter((x) => typeof x === "string" && x.trim()) : [];
  if (multi.length) return [...new Set(multi.map((x) => String(x).trim()))];
  const any = Array.isArray(b.purviewAnyOf) ? b.purviewAnyOf.filter((x) => typeof x === "string" && x.trim()) : [];
  if (any.length) return [...new Set(any.map((x) => String(x).trim()))];
  const p = typeof b.purview === "string" && b.purview.trim() ? b.purview.trim() : "";
  return p ? [p] : [];
}

/**
 * Primary Purview id for sorting / section headings (`purview` if set, else first gate id).
 * @param {Record<string, unknown>} b
 */
export function boonPrimaryPurview(b) {
  const p = typeof b?.purview === "string" && b.purview.trim() ? b.purview.trim() : "";
  if (p) return p;
  const g = boonPurviewGateIds(b);
  return g[0] || "";
}

/** Epic Attribute Purviews: first catalog Boon is a normal pick, not bundled Purview-Innate UX. */
const EPIC_PURVIEW_IDS = new Set(["epicDexterity", "epicStamina", "epicStrength"]);

/**
 * True when this `*_dot_01` catalog row is the Purview Innate (or an unfilled catalog placeholder where Innate is separate in PB).
 * Do not offer as a wizard chip, do not store in `character.boonIds`, and do not list under "Boons" on the sheet.
 * Arcane Calculus dot 1 (Mythos) and Epic Attribute dot 1 remain real Boon picks.
 * @param {Record<string, unknown>} b
 * @param {{ purviews?: Record<string, Record<string, unknown>> }} [bundle]
 */
export function boonIsPurviewInnateAutomaticGrant(b, bundle) {
  if (!b || typeof b !== "object") return false;
  if (Number(b.dot) !== 1) return false;
  const pv = boonPrimaryPurview(b);
  if (!pv || String(b.id) !== `${pv}_dot_01`) return false;
  if (pv === "arcaneCalculus") return false;
  if (EPIC_PURVIEW_IDS.has(pv)) return false;
  const row = bundle?.purviews?.[pv];
  if (!row || typeof row !== "object") return false;
  const ladder = Array.isArray(row.boonLadderNames) ? row.boonLadderNames : null;
  const rung1 = ladder != null && ladder.length >= 1 ? String(ladder[0] ?? "").trim() : "";
  if (rung1) return false;
  const innateSummary = typeof row.purviewInnateSummary === "string" && row.purviewInnateSummary.trim();
  const innateName = typeof row.purviewInnateName === "string" && row.purviewInnateName.trim();
  return Boolean(innateSummary || innateName);
}

/**
 * @param {Record<string, unknown>} b — one boon object from bundle.boons
 * @param {CharacterLike} character
 * @param {{ purviews?: Record<string, unknown> }} [bundle]
 */
export function boonEligible(b, character, bundle) {
  if (!b || typeof b !== "object") return false;

  const gateIds = boonPurviewGateIds(b);
  if (!gateIds.length) return false;
  for (const pv of gateIds) {
    if (bundle?.purviews && !bundle.purviews[pv]) return false;
  }
  const set = characterPurviewIdSet(character, bundle);
  if (!gateIds.some((id) => set.has(id))) return false;

  const tr = tierRank(character.tier);
  const tMin = b.tierMin != null ? tierRank(b.tierMin) : tierRank("hero");
  const tMax = b.tierMax != null ? tierRank(b.tierMax) : 3;
  if (tr < tMin || tr > tMax) return false;

  const callingReq = b.callingAnyOf;
  if (Array.isArray(callingReq) && callingReq.length) {
    const charCallings = mythosCharacterCallingIdsForKnacks(character);
    if (!callingReq.some((c) => typeof c === "string" && charCallings.has(c))) return false;
  }

  const pantheonReq = b.pantheonAnyOf;
  if (Array.isArray(pantheonReq) && pantheonReq.length) {
    if (!pantheonReq.includes(character.pantheonId)) return false;
  }

  const deityBoonReq = b.deityAnyOf;
  if (Array.isArray(deityBoonReq) && deityBoonReq.length) {
    if (!deityBoonReq.includes(character.parentDeityId)) return false;
  }

  const patronKindsB = b.patronKindAnyOf;
  if (Array.isArray(patronKindsB) && patronKindsB.length) {
    const curB = String(character?.patronKind ?? "deity").trim() === "titan" ? "titan" : "deity";
    if (!patronKindsB.includes(curB)) return false;
  }

  const pathPrimaryReq = b.pathRankPrimaryAnyOf;
  if (Array.isArray(pathPrimaryReq) && pathPrimaryReq.length) {
    const pk = character.pathRank?.primary;
    if (!pathPrimaryReq.includes(pk)) return false;
  }

  /** Legend and `requiresBoonIds` are not enforced — both change or belong at the table; tier, Purview, and optional tags still gate picks. */
  return true;
}
