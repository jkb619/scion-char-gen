/**
 * Knack / Boon eligibility for chargen UI (data-driven gates in JSON + character state).
 * @typedef {{ tier?: string; callingId?: string; callingDots?: number; callingSlots?: { id?: string; dots?: number }[]; pantheonId?: string; parentDeityId?: string; patronKind?: string; purviewIds?: string[]; patronPurviewSlots?: string[]; mythosInnatePower?: { style?: string; awarenessPurviewId?: string; awarenessLocked?: boolean }; legendRating?: number; awarenessRating?: number; boonIds?: string[]; pathRank?: { primary?: string }; knackIds?: string[]; knackSlotById?: Record<string, number>; lockedKnackIds?: string[]; finishingBonusKnackIds?: string[]; experienceKnackIds?: string[]; dragonHeirCallingKnackShell?: boolean }} CharacterLike
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

/**
 * Active chargen line for knack pools (`chargenLines` on knack rows).
 * @param {CharacterLike} character
 * @returns {"deity" | "titan" | "sorcerer" | "draconic" | "denizen"}
 */
export function characterChargenLineForKnacks(character) {
  const lineage = String(character?.chargenLineage ?? "scion").trim();
  if (lineage === "dragonHeir") return "draconic";
  if (isSorcererLineTierId(character?.tier)) return "sorcerer";
  return String(character?.patronKind ?? "deity").trim() === "titan" ? "titan" : "deity";
}

/**
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 */
export function knackMatchesChargenLine(k, character) {
  if (!k || typeof k !== "object") return false;
  const lines = k.chargenLines;
  if (!Array.isArray(lines) || lines.length === 0) return true;
  const cur = characterChargenLineForKnacks(character);
  if (lines.includes("any")) return cur === "deity" || cur === "titan";
  return lines.some((line) => typeof line === "string" && line.trim() === cur);
}

/**
 * PB knack band on the row: heroic | immortal (`originMortal` gates Origin picks on heroic rows).
 * @param {Record<string, unknown> | null | undefined} k
 * @returns {"mortal" | "heroic" | "immortal"}
 */
export function knackRuleTier(k) {
  if (!k || typeof k !== "object") return "immortal";
  const t = String(k.tier ?? "").trim().toLowerCase();
  if (t === "mortal" || t === "heroic" || t === "immortal") return t;
  const kind = String(k.knackKind ?? "").trim().toLowerCase();
  const tmin = String(k.tierMin ?? "").trim().toLowerCase();
  if (kind === "mortal" || tmin === "mortal") return "mortal";
  if (kind === "heroic" || tmin === "hero") return "heroic";
  return "immortal";
}

/** True when a PB HEROIC row is also on an Origin Mortal knack list (`originMortal` in data). */
export function knackOriginMortalPick(k) {
  return !!(k && typeof k === "object" && k.originMortal === true);
}

/**
 * @param {"mortal" | "heroic" | "immortal"} tier
 * @returns {string}
 */
export function knackTierBadgeLabel(tier) {
  if (tier === "mortal") return "Mortal";
  if (tier === "heroic") return "Heroic";
  return "Immortal";
}

/**
 * @param {"mortal" | "heroic" | "immortal"} tier
 * @returns {string}
 */
export function knackTierBadgeClass(tier) {
  if (tier === "mortal") return "knack-kind-badge knack-kind-mortal";
  if (tier === "heroic") return "knack-kind-badge knack-kind-heroic";
  return "knack-kind-badge knack-kind-immortal";
}

/**
 * Hero-band Calling-dot cost for a knack (Hero p.183–184). Uses `callingSlotCost` when present.
 * @param {Record<string, unknown> | null | undefined} k
 * @returns {1 | 2}
 */
export function knackHeroBandSlotCost(k) {
  if (!k || typeof k !== "object") return 1;
  const tier = knackRuleTier(k);
  if (tier === "mortal" || tier === "heroic") return 1;
  const raw = k.callingSlotCost;
  if (raw != null) {
    const n = Math.round(Number(raw));
    if (n === 2) return 2;
    return 1;
  }
  const kind = String(k.knackKind ?? "").trim().toLowerCase();
  const tmin = String(k.tierMin ?? "").trim().toLowerCase();
  if (kind === "immortal" && (tmin === "demigod" || tmin === "god")) return 2;
  if (String(k.tier ?? "").trim().toLowerCase() === "immortal" && kind === "immortal") return 2;
  return 1;
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

/** Pandora's Box “GENERAL” knack pool (characters of any Calling). */
export const GENERAL_CALLING_LABEL = "General Calling";

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

/**
 * MotM inverted ↔ standard Calling pairs (Masks of the Mythos p. 46).
 * Unpaired on MotM: Hunter, Judge, Liminal, Trickster (no standard twin).
 */
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

/** Standard Calling id for each MotM inverted Calling in the wizard chooser. */
const MYTHOS_NORMAL_CALLING_IDS = new Set([
  "creator",
  "guardian",
  "healer",
  "lover",
  "leader",
  "sage",
  "warrior",
]);

/** MotM Callings with no inverted/standard pair (knacks from that Calling only). */
export const MYTHOS_UNPAIRED_CALLING_IDS = new Set(["hunter", "judge", "liminal", "trickster"]);

/** PB Denizen companion types — knack pools for NPC companions, not player Calling picks. */
const DENIZEN_CALLING_IDS_FALLBACK = new Set([
  "c_sith",
  "kitsune",
  "satyr",
  "therianthrope",
  "wolf_warrior",
]);

/**
 * @param {{ callings?: Record<string, unknown> }} [bundle]
 * @returns {Set<string>}
 */
export function denizenCallingIds(bundle) {
  const fromMeta = bundle?.callings?._meta?.denizenCallingIds;
  if (Array.isArray(fromMeta) && fromMeta.length) {
    return new Set(fromMeta.map((id) => String(id).trim()).filter(Boolean));
  }
  return DENIZEN_CALLING_IDS_FALLBACK;
}

/**
 * True for PB Denizen companion types (Kitsune, Satyr, …) — excluded from Calling choosers.
 * @param {string} [callingId]
 * @param {{ callings?: Record<string, { denizenCalling?: boolean }> }} [bundle]
 */
export function isDenizenCallingId(callingId, bundle) {
  const cid = String(callingId ?? "").trim();
  if (!cid) return false;
  if (bundle?.callings?.[cid]?.denizenCalling === true) return true;
  return denizenCallingIds(bundle).has(cid);
}

/**
 * MotM Mythos: patron data may list a standard Calling id; the wizard offers the inverted twin when one exists (e.g. Sage → Cosmos, Warrior → Torturer).
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
 * True for the MotM standard side of a normal↔inverted pair (Sage, Creator, …).
 * @param {string} [callingId]
 */
export function isMythosStandardTwinCallingId(callingId) {
  return MYTHOS_NORMAL_CALLING_IDS.has(String(callingId ?? "").trim());
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
 * MotM paired Calling on the opposite side of a MotM twin pair for knack access (MotM p. 46).
 * Pairs: Creator↔Destroyer, Guardian↔Corruptor, Healer↔Defiler, Leader↔Tyrant, Lover↔Adversary,
 * Sage↔Cosmos, Warrior↔Torturer (Hunter / Judge / Liminal / Trickster unpaired).
 * Mythos pantheon: both directions (standard↔inverted). Elsewhere: inverted Callings still reach the
 * standard twin’s PB knack pool; standard Callings do not gain inverted-only Mythos knacks.
 * @param {string} [callingId]
 * @param {boolean} mythosPantheon
 * @returns {string | null}
 */
function motmKnackAccessTwinId(callingId, mythosPantheon) {
  const cid = String(callingId ?? "").trim();
  const twin = mythosCallingTwinId(cid);
  if (!twin) return null;
  if (mythosPantheon) return twin;
  if (isMythosInvertedTwinCallingId(cid)) return twin;
  return null;
}

/**
 * Wizard Calling pickers: non-Mythos omits MotM inverted twins.
 * Mythos: both standard and inverted twins are choosable (MotM p. 46 — e.g. Sage and Cosmos).
 * @param {string} callingId
 * @param {{ callings?: Record<string, unknown> }} bundle
 * @param {boolean} mythosPantheon
 */
export function callingIdInWizardLibraryChooser(callingId, bundle, mythosPantheon) {
  const cid = String(callingId || "").trim();
  if (!cid || cid.startsWith("_") || !bundle?.callings?.[cid]) return false;
  if (isDenizenCallingId(cid, bundle)) return false;
  if (mythosPantheon) return true;
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
 * Mythos pantheon active for MotM (explicit pantheon pick, or divine parent listed under `pantheons.mythos`).
 * @param {CharacterLike} character
 * @param {{ pantheons?: Record<string, { deities?: { id?: string }[] }> }} [bundle]
 */
export function isMythosPantheonForCharacter(character, bundle) {
  const pid = String(character?.pantheonId ?? "").trim();
  if (pid === "mythos") return true;
  const patron = String(character?.parentDeityId ?? "").trim();
  if (!patron) return false;
  const deities = bundle?.pantheons?.mythos?.deities;
  if (!Array.isArray(deities)) return false;
  return deities.some((d) => d && String(d.id ?? "").trim() === patron);
}

/** Pantheon id for knack gates (infers `mythos` when parent is a Mythos deity). */
function characterPantheonIdForKnackGates(character, bundle) {
  const pid = String(character?.pantheonId ?? "").trim();
  if (pid) return pid;
  return isMythosPantheonForCharacter(character, bundle) ? "mythos" : "";
}

/**
 * MotM pp. 46–48: if a MotM knack lists one member of a pair, the twin Calling id also qualifies.
 * @param {Record<string, unknown>} knack
 * @param {string[]} list
 */
function expandMotmMythosKnackCallingIds(knack, list) {
  if (!Array.isArray(list) || !list.length) return list;
  const kid = String(knack?.id ?? "");
  const pant = Array.isArray(knack?.pantheonAnyOf) ? knack.pantheonAnyOf : [];
  const motmKnack = kid.startsWith("mythos_") || pant.includes("mythos");
  if (!motmKnack) return list;
  const out = new Set(list);
  for (const cid of list) {
    const t = mythosCallingTwinId(cid);
    if (t) out.add(t);
  }
  return [...out];
}

/**
 * Calling ids used for Knack eligibility. Mythos (MotM p. 46): each paired Calling also counts its twin
 * (Sage↔Cosmos, Creator↔Destroyer, …) in both directions.
 * @param {CharacterLike} character
 * @returns {Set<string>}
 */
export function mythosCharacterCallingIdsForKnacks(character, bundle) {
  const out = new Set();
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    for (const s of character.callingSlots) {
      const id = String(s?.id ?? "").trim();
      if (id) out.add(id);
    }
    if (!out.size) {
      const cid = String(character?.callingId ?? "").trim();
      if (cid) out.add(cid);
    }
  } else {
    const cid = String(character?.callingId ?? "").trim();
    if (cid) out.add(cid);
  }
  const mythosPan = isMythosPantheonForCharacter(character, bundle);
  const extras = new Set();
  for (const cid of out) {
    const twin = motmKnackAccessTwinId(cid, mythosPan);
    if (twin) extras.add(twin);
  }
  for (const e of extras) out.add(e);
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
 * Knack point cost: Heroic (and Mortal) = 1; Immortal = 2 (Origin p. 96; Hero p. 183–184).
 * @param {Record<string, unknown> | null | undefined} k
 * @returns {1 | 2}
 */
export function knackPointCost(k) {
  if (!k || typeof k !== "object") return 1;
  return knackRuleTier(k) === "immortal" ? 2 : 1;
}

/**
 * Calling-dot–equivalent cost per Knack.
 * Three Calling rows: Heroic = 1 point, Immortal = 2 points per row budget (row dots = point cap).
 * Single-Calling Hero-band: Immortal = 2 when `immortalKnackCostsTwoCallingSlots`. Post-Hero single row: 1.
 * @param {Record<string, unknown> | null} k
 * @param {{ tier?: string; callingSlots?: { dots?: number }[] } | null} [character]
 */
export function knackCallingSlotCost(k, character) {
  if (!k || typeof k !== "object") return 1;
  if (knackRuleTier(k) === "mortal") return 1;
  if (character && heroUsesCallingSlotRows(character)) return knackPointCost(k);
  if (character?.tier != null && !immortalKnackCostsTwoCallingSlots(character.tier)) return 1;
  return knackHeroBandSlotCost(k);
}

function heroCallingSlotRowDots(character, rowIdx) {
  const slots = character?.callingSlots;
  if (!Array.isArray(slots) || rowIdx < 0 || rowIdx >= slots.length) return 0;
  return Math.max(1, Math.min(5, Math.round(Number(slots[rowIdx]?.dots) || 1)));
}

/** Tokens for “this row’s Calling” when matching Knack data: row id plus MotM twin (both directions on Mythos). */
function slotRowCallingTokenSet(rowCallingId, character, bundle) {
  const cid = String(rowCallingId ?? "").trim();
  if (!cid) return new Set();
  const out = new Set([cid]);
  const mythosPan = isMythosPantheonForCharacter(character, bundle);
  const t = motmKnackAccessTwinId(cid, mythosPan);
  if (t) out.add(t);
  return out;
}

/**
 * Knacks shown under Origin / Finishing “General Calling” pool: explicit General Calling, no list,
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
 * Origin / single-Calling Calling step: chip group heading (mirrors Hero row vs “General Calling”).
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 * @returns {"selected" | "any"}
 */
export function originCallingKnackChipGroupKey(k, character, bundle) {
  if (!k || typeof k !== "object") return "any";
  if (k.callingsAny === true || k.calling === "any") return "any";
  const knTok = knackCallingTokensForRowMatch(k, character);
  if (knTok === null || knTok.size === 0) return "any";
  const cid = String(character?.callingId ?? "").trim();
  if (cid) {
    const rowTok = slotRowCallingTokenSet(cid, character, bundle);
    for (const x of knTok) {
      if (rowTok.has(x)) return "selected";
    }
  }
  if (knackMayUsePendingHeroCallingRow(k, character)) return "any";
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
 * @returns {Set<string> | null} `null` = General Calling (all filled rows may pay).
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
 * MotM paired Calling (e.g. Sage or Cosmos): split eligible knacks into inverted Mythos vs standard twin pool.
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 * @param {string} [rowCallingId] — Hero row Calling; defaults to `character.callingId`
 * @param {string} [knackId] — bundle key when `k.id` is absent
 * @returns {"inverted" | "standard-twin" | null}
 */
export function motmInvertedKnackSubpoolKey(k, character, rowCallingId, knackId, bundle) {
  const cid = String(rowCallingId ?? character?.callingId ?? "").trim();
  if (!cid || !isMythosPantheonForCharacter(character, bundle)) return null;
  const twin = mythosCallingTwinId(cid);
  if (!twin) return null;
  const invertedId = isMythosInvertedTwinCallingId(cid)
    ? cid
    : isMythosStandardTwinCallingId(cid)
      ? twin
      : null;
  const standardId = isMythosStandardTwinCallingId(cid)
    ? cid
    : isMythosInvertedTwinCallingId(cid)
      ? twin
      : null;
  if (!invertedId || !standardId) return null;
  const kid = String(knackId ?? k?.id ?? "").trim();
  const pant = Array.isArray(k?.pantheonAnyOf) ? k.pantheonAnyOf : [];
  if (kid.startsWith("mythos_") && pant.includes("mythos")) return "inverted";
  const raw = knackRawCallingIdList(k);
  if (raw.includes(invertedId) && raw.includes(standardId)) {
    if (isMythosInvertedTwinCallingId(cid)) return "inverted";
    if (isMythosStandardTwinCallingId(cid)) return "standard-twin";
  }
  if (raw.includes(standardId)) return "standard-twin";
  if (raw.includes(invertedId)) return "inverted";
  return null;
}

/** @param {[string, Record<string, unknown>]} entry */
function knackChipDisplayNameKey(entry) {
  const [kid, k] = entry;
  return String(k?.name || kid).trim().toLowerCase();
}

/**
 * MotM twin pairs often ship the same Knack twice (PB standard + `mythos_*` inverted). Keep one chip per display name.
 * @param {[string, Record<string, unknown>][]} inverted
 * @param {[string, Record<string, unknown>][]} standard
 * @param {string} anchorCallingId — Calling on this row / your Calling
 */
export function dedupeMotmTwinKnackSubpoolLists(inverted, standard, anchorCallingId) {
  const invNames = new Set(inverted.map(knackChipDisplayNameKey));
  const stdNames = new Set(standard.map(knackChipDisplayNameKey));
  const dup = new Set([...invNames].filter((n) => stdNames.has(n)));
  if (!dup.size) return { inverted, standard };
  const anchorInv = isMythosInvertedTwinCallingId(anchorCallingId);
  if (anchorInv) {
    return {
      inverted,
      standard: standard.filter((e) => !dup.has(knackChipDisplayNameKey(e))),
    };
  }
  return {
    inverted: inverted.filter((e) => !dup.has(knackChipDisplayNameKey(e))),
    standard,
  };
}

/**
 * Hero Calling rows: prefer a filled Calling row over General Calling or empty rows for multi-Calling Knacks.
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {number | "any"}
 */
export function heroKnackChipBucketKey(k, character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return "any";
  const rowCount = character.callingSlots.length;
  const tok = knackCallingTokensForRowMatch(k, character);
  if (tok === null) return "any";
  const raw = knackRawCallingIdList(k);
  const kid = String(k?.id ?? "").trim();
  const pant = Array.isArray(k?.pantheonAnyOf) ? k.pantheonAnyOf : [];
  for (let ri = 0; ri < rowCount; ri += 1) {
    const rowId = String(character.callingSlots[ri]?.id ?? "").trim();
    if (!rowId || !raw.includes(rowId)) continue;
    if (heroCallingRowMatchesKnack(ri, k, character, bundle)) return ri;
  }
  if (kid.startsWith("mythos_") && pant.includes("mythos")) {
    for (let ri = 0; ri < rowCount; ri += 1) {
      const rowId = String(character.callingSlots[ri]?.id ?? "").trim();
      if (!rowId || !isMythosInvertedTwinCallingId(rowId)) continue;
      if (heroCallingRowMatchesKnack(ri, k, character, bundle)) return ri;
    }
  }
  for (let ri = 0; ri < rowCount; ri += 1) {
    const rowId = String(character.callingSlots[ri]?.id ?? "").trim();
    if (!rowId) continue;
    if (heroCallingRowMatchesKnack(ri, k, character, bundle)) return ri;
  }
  for (let ri = 0; ri < rowCount; ri += 1) {
    const rowId = String(character.callingSlots[ri]?.id ?? "").trim();
    if (rowId) continue;
    if (heroCallingRowMatchesKnack(ri, k, character, bundle)) return ri;
  }
  return "any";
}

/**
 * Hero Calling knack panel row sections. Primary bucket from {@link heroKnackChipBucketKey}; on Mythos, also list on
 * the other twin’s row when both Sage and Cosmos (etc.) are on the sheet so either row can pay.
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 * @param {{ callings?: Record<string, unknown> }} bundle
 * @returns {(number | "any")[]}
 */
export function heroKnackChipPanelBucketKeys(k, character, bundle) {
  const primary = heroKnackChipBucketKey(k, character, bundle);
  const keys = new Set([primary]);
  if (primary === "any" || !heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) {
    return [...keys];
  }
  if (!isMythosPantheonForCharacter(character, bundle)) return [...keys];
  const primaryRowId = String(character.callingSlots[primary]?.id ?? "").trim();
  const twinRowCallingId = mythosCallingTwinId(primaryRowId);
  if (!twinRowCallingId || !motmCallingPairForRow(primaryRowId, bundle)) return [...keys];
  const rowCount = character.callingSlots.length;
  for (let ri = 0; ri < rowCount; ri += 1) {
    if (ri === primary) continue;
    const rowId = String(character.callingSlots[ri]?.id ?? "").trim();
    if (rowId !== twinRowCallingId) continue;
    if (heroCallingRowMatchesKnack(ri, k, character, bundle)) keys.add(ri);
  }
  return [...keys];
}

/**
 * MotM paired Calling metadata for a row / Origin Calling id (e.g. Sage ↔ Cosmos).
 * @param {string} callingId
 * @param {{ callings?: Record<string, { name?: string }> }} bundle
 */
export function motmCallingPairForRow(callingId, bundle) {
  const cid = String(callingId ?? "").trim();
  if (!cid) return null;
  const twin = mythosCallingTwinId(cid);
  if (!twin || (!isMythosInvertedTwinCallingId(cid) && !isMythosStandardTwinCallingId(cid))) return null;
  const invertedId = isMythosInvertedTwinCallingId(cid) ? cid : twin;
  const standardId = isMythosStandardTwinCallingId(cid) ? cid : twin;
  const callings = bundle?.callings || {};
  return {
    rowCallingId: cid,
    invertedId,
    standardId,
    invName: String(callings[invertedId]?.name || invertedId).trim(),
    stdName: String(callings[standardId]?.name || standardId).trim(),
  };
}

/**
 * Sub-heading inside a MotM knack group (inverted vs standard twin pool).
 * @param {"inverted" | "standard-twin"} subKey
 * @param {ReturnType<typeof motmCallingPairForRow>} pair
 * @param {string} [anchorCallingId] — Calling on this row / “your Calling”; tags that side in the title.
 */
export function motmKnackSubpoolSectionTitle(subKey, pair, anchorCallingId) {
  if (!pair) return "";
  const anchor = String(anchorCallingId ?? pair.rowCallingId ?? "").trim();
  if (subKey === "inverted") {
    const tag = anchor === pair.invertedId ? "your Calling" : "MotM inverted";
    return `Inverted — ${pair.invName} (${tag})`;
  }
  if (subKey === "standard-twin") {
    const tag = anchor === pair.standardId ? "your Calling" : "standard twin";
    return `${pair.stdName} (${tag})`;
  }
  return "";
}

/**
 * Section heading for a Calling knack group (Origin / Finishing / Hero row).
 * @param {string} callingId
 * @param {{ callings?: Record<string, { name?: string }> }} bundle
 * @param {{ yourCalling?: boolean; budgetSuffix?: string }} [opts]
 */
export function motmCallingKnackGroupTitle(callingId, bundle, opts = {}) {
  const cid = String(callingId ?? "").trim();
  const callings = bundle?.callings || {};
  const name = cid ? String(callings[cid]?.name || cid).trim() : "";
  const pair = motmCallingPairForRow(cid, bundle);
  const budget = opts.budgetSuffix ? ` — ${opts.budgetSuffix}` : "";
  if (!cid) return "Your Calling — pick above";
  if (!pair) {
    const lead = opts.yourCalling ? `${name} (your Calling)` : name;
    return `${lead}${budget}`;
  }
  const lead = opts.yourCalling ? `${name} (your Calling)` : name;
  return `${lead} — ${pair.stdName} / ${pair.invName} pair${budget}`;
}

/**
 * @param {Record<string, unknown>} k
 * @param {{ callings?: Record<string, { name?: string }> }} [bundle]
 * @param {CharacterLike} [character] — when set, notes MotM twin access (Cosmos ↔ Sage, etc.)
 * @returns {string} Short line for tooltips: “Applies to: …”.
 */
export function knackAppliesToCallingsLine(k, bundle, character) {
  if (!k || typeof k !== "object") return "";
  if (k.callingsAny === true || k.calling === "any") return `Applies to: ${GENERAL_CALLING_LABEL}.`;
  const raw = knackRawCallingIdList(k);
  if (!raw.length) return "";
  const expanded = expandMotmMythosKnackCallingIds(k, raw);
  const callings = bundle?.callings || {};
  const names = [...new Set(expanded)]
    .map((id) => (callings[id] && typeof callings[id] === "object" ? String(callings[id].name || "").trim() : "") || id)
    .filter(Boolean);
  if (!names.length) return "";
  let line = `Applies to: ${names.join(", ")}.`;
  const cid = String(character?.callingId ?? "").trim();
  const mythosPan = String(character?.pantheonId ?? "").trim() === "mythos";
  const twin = mythosCallingTwinId(cid);
  if (
    cid &&
    mythosPan &&
    twin &&
    (isMythosInvertedTwinCallingId(cid) || isMythosStandardTwinCallingId(cid))
  ) {
    const sub = motmInvertedKnackSubpoolKey(k, character, cid);
    const invertedId = isMythosInvertedTwinCallingId(cid) ? cid : twin;
    const standardId = isMythosStandardTwinCallingId(cid) ? cid : twin;
    const invName = (callings[invertedId] && String(callings[invertedId].name || "").trim()) || invertedId;
    const stdName = (callings[standardId] && String(callings[standardId].name || "").trim()) || standardId;
    const yours = isMythosInvertedTwinCallingId(cid) ? invName : stdName;
    if (sub === "standard-twin" && stdName) {
      line += ` Available with your ${yours} Calling via the ${stdName}/${invName} pair (MotM p. 46).`;
    } else if (sub === "inverted" && invName) {
      line += ` Inverted ${invName} knack (MotM); ${stdName} standard knacks are also available via the pair.`;
    }
  }
  return line;
}

/** Knack ids that cannot be deselected after tier advancement (Origin → Hero+, etc.). */
export function knackLockedIdSet(character) {
  const raw = character?.lockedKnackIds;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")));
}

/** @param {CharacterLike} character @param {string} knackId */
export function isKnackLocked(character, knackId) {
  const kid = String(knackId ?? "").trim();
  return kid ? knackLockedIdSet(character).has(kid) : false;
}

/**
 * Locked Origin / Finishing Knacks carried into Hero+ may fail `knackEligible` (e.g. Mortal-tier rows) but stay on the sheet.
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 * @param {Record<string, unknown>} bundle
 */
export function knackEligibleOrLockedHeld(k, character, bundle) {
  const kid = String(k?.id ?? "").trim();
  if (!kid || !bundle?.knacks?.[kid]) return false;
  if (isKnackLocked(character, kid)) return true;
  return knackEligible(k, character, bundle);
}

/** Origin Finishing “extra” Knacks merged at Hero+ — locked, but do not spend Calling row knack points. */
export function finishingBonusKnackIdSet(character) {
  const raw = character?.finishingBonusKnackIds;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")));
}

/** Exp Leveling purchases — on the sheet but free against Calling dot / row knack budgets. */
export function experienceKnackIdSet(character) {
  const raw = character?.experienceKnackIds;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")));
}

/** @param {CharacterLike} character @param {string} knackId */
export function knackCountsAgainstCallingRowBudget(character, knackId) {
  const kid = String(knackId ?? "").trim();
  if (!kid) return true;
  if (finishingBonusKnackIdSet(character).has(kid)) return false;
  if (experienceKnackIdSet(character).has(kid)) return false;
  return true;
}

/**
 * Snapshot current main + Finishing Knack picks into `lockedKnackIds` (cumulative across advances).
 * @param {CharacterLike} character
 */
export function lockKnacksAtTierAdvance(character) {
  if (!character || typeof character !== "object") return;
  const locked = knackLockedIdSet(character);
  for (const id of character.knackIds || []) locked.add(id);
  const fin = character.finishing?.finishingKnackIds;
  if (Array.isArray(fin)) {
    for (const id of fin) {
      if (typeof id === "string" && id.trim() && !id.startsWith("_")) locked.add(id);
    }
  }
  character.lockedKnackIds = [...locked];
}

/**
 * @param {string[]} knackIds
 * @param {CharacterLike} character
 * @returns {string | null}
 */
function popLastUnlockedKnackId(knackIds, character) {
  const arr = knackIds;
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    if (!isKnackLocked(character, arr[i])) return arr.splice(i, 1)[0];
  }
  return null;
}

/** PB General Calling knack — may be paid from any Calling row the player chooses. */
export function isGeneralCallingKnack(k) {
  if (!k || typeof k !== "object") return false;
  if (k.callingsAny === true || k.calling === "any") return true;
  return knackRawCallingIdList(k).length === 0;
}

/** Dot budget for one Hero `callingSlots` row (also knack point cap for that Calling). */
export function callingRowDotCap(character, rowIdx) {
  return heroCallingSlotRowDots(character, rowIdx);
}

/**
 * Knack points already spent on a Calling row (from `knackSlotById` assignments).
 * @param {number} rowIdx
 * @param {string[]} knackIds
 * @param {Record<string, number>} slotMap
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @param {CharacterLike} character
 */
export function rowKnackPointsUsed(rowIdx, knackIds, slotMap, bundle, character) {
  let used = 0;
  for (const id of knackIds || []) {
    if (typeof id !== "string" || !id.trim() || slotMap[id] !== rowIdx) continue;
    if (!knackCountsAgainstCallingRowBudget(character, id)) continue;
    used += knackCallingSlotCost(bundleKnackById(id, bundle), character);
  }
  return used;
}

/**
 * Knack point cost charged to a Calling row (0 for Finishing extras carried forward).
 * @param {CharacterLike} character
 * @param {string} knackId
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function knackRowBudgetCost(character, knackId, bundle) {
  const kid = String(knackId ?? "").trim();
  if (!kid || !knackCountsAgainstCallingRowBudget(character, kid)) return 0;
  return knackCallingSlotCost(bundleKnackById(kid, bundle), character);
}

/**
 * @param {string[]} knackIds
 * @param {Record<string, number>} slotMap
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function validateKnackSlotAssignments(knackIds, slotMap, character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return true;
  const slots = character.callingSlots;
  const ids = (knackIds || []).filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  for (const id of ids) {
    const r = slotMap[id];
    if (r == null || !Number.isFinite(r) || r < 0 || r >= slots.length) return false;
    const kn = bundleKnackById(id, bundle);
    if (!kn || !heroCallingRowMatchesKnack(r, kn, character, bundle)) return false;
  }
  for (let ri = 0; ri < slots.length; ri += 1) {
    const cap = callingRowDotCap(character, ri);
    if (rowKnackPointsUsed(ri, ids, slotMap, bundle, character) > cap) return false;
  }
  return true;
}

/**
 * Calling rows that can pay for `k` without exceeding that row’s dot budget.
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @param {string[]} knackIds — proposed full list (including `k` when toggling on)
 * @param {Record<string, number>} slotMap
 * @param {string} [excludeKnackId] — omit this id from usage on rows (re-pick payer)
 * @returns {number[]}
 */
export function callingRowsThatCanPayForKnack(k, character, bundle, knackIds, slotMap, excludeKnackId) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return [];
  const kid = String(k?.id ?? "").trim();
  const cost = knackCallingSlotCost(k, character);
  const ids = (knackIds || []).filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  const map = slotMap && typeof slotMap === "object" ? slotMap : {};
  const out = [];
  for (let ri = 0; ri < character.callingSlots.length; ri += 1) {
    if (!heroCallingRowMatchesKnack(ri, k, character, bundle)) continue;
    const cap = callingRowDotCap(character, ri);
    const usageIds = ids.filter((id) => id !== excludeKnackId);
    const used = rowKnackPointsUsed(ri, usageIds, map, bundle, character);
    if (used + cost <= cap) out.push(ri);
  }
  return out;
}

/**
 * Short label for sheet / tooltips: which Calling row pays for a knack.
 * @param {CharacterLike} character
 * @param {{ callings?: Record<string, { name?: string }> }} bundle
 * @param {string} knackId
 * @returns {string}
 */
export function knackPayingCallingRowLabel(character, bundle, knackId) {
  const kid = String(knackId ?? "").trim();
  if (!kid || !character?.knackSlotById || !Array.isArray(character.callingSlots)) return "";
  const ri = character.knackSlotById[kid];
  if (ri == null || !Number.isFinite(ri) || ri < 0 || ri >= character.callingSlots.length) return "";
  const rowId = String(character.callingSlots[ri]?.id ?? "").trim();
  const name = (rowId && bundle?.callings?.[rowId]?.name) || rowId || `Calling ${ri + 1}`;
  const cap = callingRowDotCap(character, ri);
  const used = rowKnackPointsUsed(ri, character.knackIds || [], character.knackSlotById, bundle, character);
  const finExempt = finishingBonusKnackIdSet(character).has(kid);
  const xpExempt = experienceKnackIdSet(character).has(kid);
  const suffix = finExempt
    ? " — Finishing extra (no point cost)"
    : xpExempt
      ? " — Experience purchase (no point cost)"
      : "";
  return `Paid from ${name} (${used}/${cap} knack points)${suffix}`;
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
   * Match the Finishing “General Calling” bucket ({@link knackMayUsePendingHeroCallingRow}), not only
   * `knTok === null` — multi-Calling (“one of …”) rows use a non-null Set and still belong in that pool.
   */
  if (!rowId) return knackMayUsePendingHeroCallingRow(k, character);
  const rowTok = slotRowCallingTokenSet(rowId, character, _bundle);
  if (knTok === null) return true;
  for (const x of knTok) {
    if (rowTok.has(x)) return true;
  }
  return false;
}

/**
 * Assign each main Knack to a Calling row so each row’s spent cost ≤ that row’s dots (Hero `callingSlots`).
 * Hero-band: two-dot knacks only on rows with two+ dots; at most one two-dot knack in the list.
 * Post-Hero: all immortal knacks cost one dot per row.
 * @param {string[]} knackIds
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {Record<string, number> | null}
 */
export function solveHeroKnackSlotAssignment(knackIds, character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return {};
  const ids = [...(knackIds || [])].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  if (ids.length === 0) return {};
  const existing =
    character.knackSlotById && typeof character.knackSlotById === "object" ? { ...character.knackSlotById } : {};
  if (validateKnackSlotAssignments(ids, existing, character, bundle)) {
    const out = {};
    for (const id of ids) {
      if (existing[id] != null) out[id] = existing[id];
    }
    if (Object.keys(out).length === ids.length) return out;
  }
  const slots = character.callingSlots;
  const rowCount = slots.length;
  const rowCaps = slots.map((_, i) => callingRowDotCap(character, i));
  const n = ids.length;

  function dfs(i, rowUsed, slotMap) {
    if (i >= n) return { ...slotMap };
    const kid = ids[i];
    const kn = bundleKnackById(kid, bundle);
    if (!kn) return null;
    const cost = knackRowBudgetCost(character, kid, bundle);
    for (let r = 0; r < rowCount; r += 1) {
      if (!heroCallingRowMatchesKnack(r, kn, character, bundle)) continue;
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
/**
 * Assign every `knackIds` entry to a Calling row; Finishing extras use 0 budget cost.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function ensureHeroKnackSlotAssignments(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const ids = [...(character.knackIds || [])].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  if (!ids.length) return;
  const solved = solveHeroKnackSlotAssignment(ids, character, bundle);
  if (!solved) return;
  const map = character.knackSlotById;
  for (const id of ids) {
    if (solved[id] != null) map[id] = solved[id];
  }
}

/**
 * Keep locked Knacks in `knackIds` even when Hero-tier gates would drop them (e.g. Mortal-tier Origin picks).
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function reconcileLockedKnackIds(character, bundle) {
  const locked = knackLockedIdSet(character);
  if (!locked.size || !bundle?.knacks) return;
  const cur = [...(character.knackIds || [])];
  let changed = false;
  for (const id of locked) {
    if (!bundle.knacks[id] || cur.includes(id)) continue;
    cur.push(id);
    changed = true;
  }
  if (changed) character.knackIds = cur;
}

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
  while (cur.length > 0 && !validateKnackSlotAssignments(cur, map, character, bundle)) {
    const removed = popLastUnlockedKnackId(cur, character);
    if (!removed) break;
    delete map[removed];
  }
  character.knackIds = cur;
  ensureHeroKnackSlotAssignments(character, bundle);
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
    if (!knackCountsAgainstCallingRowBudget(character, id)) continue;
    const kn = bundleKnackById(id, bundle);
    sum += knackCallingSlotCost(kn, character);
  }
  return sum;
}

/** Knacks that cost two Calling dots at Hero tier (`callingSlotCost` 2). */
export function heavyImmortalKnackCountInList(knackIds, bundle) {
  let n = 0;
  for (const id of knackIds || []) {
    const kn = bundleKnackById(id, bundle);
    if (knackHeroBandSlotCost(kn) === 2) n += 1;
  }
  return n;
}

/** @deprecated Use {@link heavyImmortalKnackCountInList} — counts two-dot Hero-band knacks, not all immortal tier. */
export function immortalKnackCountInList(knackIds, bundle) {
  return heavyImmortalKnackCountInList(knackIds, bundle);
}

/**
 * Hero+ (Scion: Hero / Saints & Monsters Step Five): total slot cost ≤ Calling dots.
 * Hero-band: at most one two-dot knack; needs two+ Calling dots if any two-dot knack.
 * Post-Hero: all immortal knacks one dot; no separate two-dot cap beyond dot budget.
 */
export function knackSetWithinCallingSlots(knackIds, character, bundle) {
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    const map =
      character.knackSlotById && typeof character.knackSlotById === "object" ? character.knackSlotById : {};
    return validateKnackSlotAssignments(knackIds, map, character, bundle);
  }
  const cap = callingKnackSlotCap(character);
  const used = knackIdsCallingSlotsUsed(knackIds, bundle, character);
  if (used > cap) return false;
  const tr = tierRank(character.tier);
  const heavy = heavyImmortalKnackCountInList(knackIds, bundle);
  if (tr <= 0) return heavy === 0;
  const heroImm = immortalKnackCostsTwoCallingSlots(character.tier);
  if (heroImm) {
    if (heavy > 1) return false;
    if (cap < 2 && heavy > 0) return false;
  }
  return true;
}

/** Drop picks from the end until the set fits Calling slot rules (import / lower Calling dots). */
export function pruneKnackIdsToCallingSlotCap(knackIds, character, bundle) {
  const arr = [...(knackIds || [])].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    while (arr.length > 0 && solveHeroKnackSlotAssignment(arr, character, bundle) == null) {
      if (!popLastUnlockedKnackId(arr, character)) break;
    }
    return arr;
  }
  while (arr.length > 0 && !knackSetWithinCallingSlots(arr, character, bundle)) {
    if (!popLastUnlockedKnackId(arr, character)) break;
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
  const heavy = heavyImmortalKnackCountInList(combined, bundle);
  const heroImm = immortalKnackCostsTwoCallingSlots(character.tier);
  if (heroImm && heavy > 1) return false;
  const minCapForHeavy = heroImm ? 2 : 1;
  if (knackHeroBandSlotCost(k) === 2 && callingKnackSlotCap(character) < minCapForHeavy) return false;
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
  return heavyImmortalKnackCountInList(combined, bundle) <= 1;
}

/**
 * Knack can be shown / toggled on the Calling step: passes data gates and fits Calling slot budget.
 * (Finishing “extra Knacks” use `knackEligibleForFinishingExtraKnack` — they do not spend Calling dots.)
 */
export function knackEligibleForCallingStep(k, character, bundle) {
  const kid = String(k?.id ?? "").trim();
  if (!kid) return false;
  const cur = character.knackIds || [];
  const lockedHeld = cur.includes(kid) && isKnackLocked(character, kid);
  if (!knackEligible(k, character, bundle) && !lockedHeld) return false;
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    const map =
      character.knackSlotById && typeof character.knackSlotById === "object" ? { ...character.knackSlotById } : {};
    if (cur.includes(kid)) {
      if (lockedHeld) return true;
      return validateKnackSlotAssignments(cur, map, character, bundle);
    }
    if (!callingRowsThatCanPayForKnack(k, character, bundle, [...cur, kid], map).length) return false;
    const trial = solveHeroKnackSlotAssignment([...cur, kid], character, bundle);
    return trial != null;
  }
  if (cur.includes(kid)) return true;
  return knackSetWithinCallingSlots([...cur, kid], character, bundle);
}

/**
 * MotM chargen (ch. 2 Step Five, pp. 47–49): Mythos Scions may take inverted **Heroic** Knacks at Origin
 * (one knack, one Calling dot — same as other Mortal Scions). Immortal inverted Knacks wait until Hero+.
 * @param {Record<string, unknown>} k
 * @param {CharacterLike} character
 */
function motmInvertedChargenKnackAtOrigin(k, character, bundle) {
  if (!isMythosPantheonForCharacter(character, bundle)) return false;
  if (knackRuleTier(k) !== "heroic") return false;
  const kid = String(k?.id ?? "");
  const pant = Array.isArray(k?.pantheonAnyOf) ? k.pantheonAnyOf : [];
  if (!kid.startsWith("mythos_") && !pant.includes("mythos")) return false;
  const raw = knackRawCallingIdList(k);
  if (!raw.length) return false;
  const expanded = expandMotmMythosKnackCallingIds(k, raw);
  const charCallings = mythosCharacterCallingIdsForKnacks(character, bundle);
  return expanded.some((kc) => typeof kc === "string" && charCallings.has(kc));
}

/**
 * @param {Record<string, unknown>} k — one knack object from bundle.knacks
 * @param {CharacterLike} character
 * @param {Record<string, unknown>} [_bundle]
 */
export function knackEligible(k, character, _bundle) {
  if (!k || typeof k !== "object") return false;
  if (isSorcererLineTierId(character?.tier)) return false;
  if (!knackMatchesChargenLine(k, character)) return false;

  const callingsAny = k.callingsAny === true || k.calling === "any";
  const list = Array.isArray(k.callings) ? k.callings : k.calling ? [k.calling] : null;
  if (!callingsAny) {
    let allowed = list || [];
    if (allowed.length) {
      allowed = expandMotmMythosKnackCallingIds(k, allowed);
      const charCallings = mythosCharacterCallingIdsForKnacks(character, _bundle);
      if (!allowed.some((kc) => typeof kc === "string" && charCallings.has(kc))) return false;
    }
  }

  const tr = tierRank(character.tier);
  const kt = knackRuleTier(k);
  /** Origin: one Heroic knack (originMortal PB rows or MotM inverted Heroic on Mythos). No Immortal picks until Hero+. */
  if (tr === 0) {
    if (kt === "immortal") return false;
    if (kt !== "mortal" && !knackOriginMortalPick(k) && !motmInvertedChargenKnackAtOrigin(k, character, _bundle)) {
      return false;
    }
  } else if (kt === "mortal") {
    return false;
  }

  const pv = k.purviewAnyOf;
  if (Array.isArray(pv) && pv.length) {
    const set = characterPurviewIdSet(character, _bundle);
    if (!pv.some((id) => set.has(id))) return false;
  }

  const pant = k.pantheonAnyOf;
  if (Array.isArray(pant) && pant.length) {
    const pantheonForGates = characterPantheonIdForKnackGates(character, _bundle);
    if (!pantheonForGates || !pant.includes(pantheonForGates)) return false;
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

  /** Immortal knacks (2 points) need at least one Calling with 2+ dots (Hero p.184). */
  if (knackPointCost(k) === 2) {
    if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
      const anyWide = character.callingSlots.some((_, i) => callingRowDotCap(character, i) >= 2);
      if (!anyWide) return false;
    } else if (immortalKnackCostsTwoCallingSlots(character.tier)) {
      const maxRow = maxHeroCallingSlotDotCount(character);
      if (maxRow != null) {
        if (maxRow < 2) return false;
      } else if (callingKnackSlotCap(character) < 2) return false;
    }
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
    const charCallings = mythosCharacterCallingIdsForKnacks(character, bundle);
    if (!callingReq.some((c) => typeof c === "string" && charCallings.has(c))) return false;
  }

  const pantheonReq = b.pantheonAnyOf;
  if (Array.isArray(pantheonReq) && pantheonReq.length) {
    const pantheonForGates = characterPantheonIdForKnackGates(character, bundle);
    if (!pantheonForGates || !pantheonReq.includes(pantheonForGates)) return false;
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
