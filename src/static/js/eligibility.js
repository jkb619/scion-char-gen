/**
 * Knack / Boon eligibility for chargen UI (data-driven gates in JSON + character state).
 * @typedef {{ tier?: string; callingId?: string; callingDots?: number; callingSlots?: { id?: string; dots?: number }[]; pantheonId?: string; parentDeityId?: string; patronKind?: string; purviewIds?: string[]; patronPurviewSlots?: string[]; mythosInnatePower?: { style?: string; awarenessPurviewId?: string; awarenessLocked?: boolean }; legendRating?: number; awarenessRating?: number; boonIds?: string[]; pathRank?: { primary?: string }; knackIds?: string[]; knackSlotById?: Record<string, number>; knackLockedRowBudgetCostById?: Record<string, number>; lockedKnackIds?: string[]; finishingBonusKnackIds?: string[]; experienceKnackIds?: string[]; dragonHeirCallingKnackShell?: boolean }} CharacterLike
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
  /** MotM inverted knacks (`mythos_*`) apply on deity- and Titan-line Mythos Scions alike. */
  const kid = String(k?.id ?? "").trim();
  const pant = Array.isArray(k?.pantheonAnyOf) ? k.pantheonAnyOf : [];
  if (kid.startsWith("mythos_") && pant.includes("mythos") && (cur === "deity" || cur === "titan")) {
    return true;
  }
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
 * Pandora's Box GENERAL pool at the HEROIC band (`callingsAny` / any Calling) — selectable at Origin
 * the same as Aura of Greatness; PB labels these Heroic General, not a separate post-Visitation list.
 * @param {Record<string, unknown>} k
 */
export function knackHeroicGeneralPick(k) {
  if (!k || typeof k !== "object") return false;
  if (!isGeneralCallingKnack(k)) return false;
  return knackRuleTier(k) === "heroic";
}

/** Origin / Mortal play tier: Origin Mortal Calling list or PB Heroic General pool. */
export function knackOriginPlayHeroicPick(k) {
  return knackOriginMortalPick(k) || knackHeroicGeneralPick(k);
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
 * Hero-band Calling-dot cost for a knack (Hero p.183–184): Immortal = 2, all other bands = 1.
 * @param {Record<string, unknown> | null | undefined} k
 * @returns {1 | 2}
 */
export function knackHeroBandSlotCost(k) {
  return knackPointCost(k);
}

/** Hero-band tiers: Visitation layout (three Calling rows, five shared dots). Deity line uses Hero; Titan line uses Titanic. */
export function isHeroBandCallingTierId(tierId) {
  const t = normalizedTierIdEligibility(tierId);
  return t === "hero" || t === "titanic" || t === "sorcerer_hero";
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
    if (isHeroBandCallingTierId(t)) return MAX_HERO_BAND_WIZARD_BOON_PICKS;
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
  /** Hero and Titanic (Titan line hero-band) share the double-slot Immortal Knack rule (Hero p.184). */
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
  if (isHeroBandCallingTierId(t)) return true;
  /** Demigod / God (deity or Titan welcome line): same three-row Calling + per-row Knack UI as Hero/Titanic. */
  if (isPostHeroBandCallingTierId(t)) return true;
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
  const tierNorm = normalizedTierIdEligibility(character?.tier);
  if (isHeroBandCallingTierId(tierNorm) || tierNorm === "titanic") {
    const pantId = String(character?.pantheonId ?? "").trim();
    const pant = pantId && bundle?.pantheons?.[pantId];
    const sig =
      pant && typeof pant === "object" && typeof pant.signaturePurviewId === "string"
        ? pant.signaturePurviewId.trim()
        : "";
    if (sig) out.add(sig);
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
 * @param {Record<string, unknown>} b
 * @param {{ masksOfTheMythos?: { mythosAwarenessBoonByPurview?: Record<string, string> } }} [bundle]
 * @returns {string | null} catalog Purview id when this row is MotM's Awareness Boon for that Purview
 */
export function mythosAwarenessCatalogPurviewForBoon(b, bundle) {
  const bid = String(b?.id ?? "").trim();
  if (!bid) return null;
  const catalog = bundle?.masksOfTheMythos?.mythosAwarenessBoonByPurview;
  if (!catalog || typeof catalog !== "object") return null;
  for (const [pv, mappedId] of Object.entries(catalog)) {
    if (String(mappedId ?? "").trim() === bid) return String(pv).trim() || null;
  }
  return null;
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
 * True when the character sheet uses an inverted MotM Calling (Cosmos, Destroyer, …).
 * Only choosable on the Mythos line — use for knack gates when pantheon/parent fields are stale.
 * @param {CharacterLike} character
 */
export function characterHasMotmInvertedCalling(character) {
  const cid = String(character?.callingId ?? "").trim();
  if (cid && isMythosInvertedTwinCallingId(cid)) return true;
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    for (const s of character.callingSlots) {
      const id = String(s?.id ?? "").trim();
      if (id && isMythosInvertedTwinCallingId(id)) return true;
    }
  }
  return false;
}

/**
 * True when the sheet uses a standard MotM twin Calling (Sage, Creator, …).
 * @param {CharacterLike} character
 */
export function characterHasMotmStandardTwinCalling(character) {
  const cid = String(character?.callingId ?? "").trim();
  if (cid && isMythosStandardTwinCallingId(cid)) return true;
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    for (const s of character.callingSlots) {
      const id = String(s?.id ?? "").trim();
      if (id && isMythosStandardTwinCallingId(id)) return true;
    }
  }
  return false;
}

/**
 * Pantheon id that owns `character.parentDeityId` (any patron row in bundle data).
 * @param {CharacterLike} character
 * @param {{ pantheons?: Record<string, { deities?: { id?: string }[]; titans?: { id?: string }[] }> }} [bundle]
 * @returns {string}
 */
function parentDeityPantheonId(character, bundle) {
  const patron = String(character?.parentDeityId ?? "").trim();
  if (!patron || !bundle?.pantheons || typeof bundle.pantheons !== "object") return "";
  for (const [pid, pant] of Object.entries(bundle.pantheons)) {
    if (!pid || pid.startsWith("_") || !pant || typeof pant !== "object") continue;
    for (const key of ["deities", "titans"]) {
      const rows = Array.isArray(pant[key]) ? pant[key] : [];
      if (rows.some((d) => d && String(d.id ?? "").trim() === patron)) return pid;
    }
  }
  return "";
}

/**
 * Mythos pantheon active for MotM (explicit pantheon pick, or divine parent listed under `pantheons.mythos`).
 * @param {CharacterLike} character
 * @param {{ pantheons?: Record<string, { deities?: { id?: string }[] }> }} [bundle]
 */
export function isMythosPantheonForCharacter(character, bundle) {
  const pid = String(character?.pantheonId ?? "").trim();
  if (pid === "mythos") return true;
  if (characterHasMotmInvertedCalling(character)) return true;
  if (parentDeityPantheonId(character, bundle) === "mythos") return true;
  return false;
}

/** Pantheon id for knack gates (infers `mythos` when parent is a Mythos deity). */
function characterPantheonIdForKnackGates(character, bundle) {
  const pid = String(character?.pantheonId ?? "").trim();
  if (pid) return pid;
  return isMythosPantheonForCharacter(character, bundle) ? "mythos" : "";
}

/**
 * MotM pp. 46–48: expand knack Calling ids with paired twins.
 * Mythos pantheon: both sides of each pair (Sage↔Cosmos, …) on every knack row.
 * mythos_* / pantheonAnyOf mythos rows always expand; non-Mythos inverted Callings reach the standard twin pool.
 * @param {Record<string, unknown>} knack
 * @param {string[]} list
 * @param {CharacterLike} [character]
 * @param {{ pantheons?: Record<string, { deities?: { id?: string }[] }> }} [bundle]
 */
function expandMotmKnackAccessCallingIds(knack, list, character, bundle) {
  if (!Array.isArray(list) || !list.length) return list;
  const out = new Set(list);
  const mythosPan =
    isMythosPantheonForCharacter(character, bundle) ||
    characterHasMotmInvertedCalling(character) ||
    (characterHasMotmStandardTwinCalling(character) && parentDeityPantheonId(character, bundle) === "mythos");
  const kid = String(knack?.id ?? "");
  const pant = Array.isArray(knack?.pantheonAnyOf) ? knack.pantheonAnyOf : [];
  const motmKnack = kid.startsWith("mythos_") || pant.includes("mythos");
  if (motmKnack || mythosPan) {
    for (const cid of list) {
      const t = mythosCallingTwinId(cid);
      if (t) out.add(t);
    }
  } else {
    for (const cid of list) {
      if (isMythosInvertedTwinCallingId(cid)) {
        const t = mythosCallingTwinId(cid);
        if (t) out.add(t);
      }
    }
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
 * Calling-dot–equivalent cost per Knack against a three-row knack point pool.
 * Heroic/Mortal = 1; Immortal = 2 (`knackPointCost`) on every tier that uses `callingSlots` rows.
 * Legacy single-row Calling (no three-row layout): Demigod+ Immortal = 1.
 * @param {Record<string, unknown> | null} k
 * @param {{ tier?: string; callingSlots?: { dots?: number }[] } | null} [character]
 */
export function knackCallingSlotCost(k, character) {
  if (!k || typeof k !== "object") return 1;
  if (knackRuleTier(k) === "mortal") return 1;
  if (character && heroUsesCallingSlotRows(character)) {
    return knackPointCost(k);
  }
  if (character?.tier != null && !immortalKnackCostsTwoCallingSlots(character.tier)) return 1;
  return knackPointCost(k);
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
  const knTok = knackCallingTokensForRowMatch(k, character, bundle);
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
export function knackCallingTokensForRowMatch(k, character, bundle) {
  if (!k || typeof k !== "object") return new Set();
  if (k.callingsAny === true || k.calling === "any") return null;
  const raw = knackRawCallingIdList(k);
  if (!raw.length) return new Set();
  const expanded = expandMotmKnackAccessCallingIds(k, raw, character, bundle);
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
  if (!cid) return null;
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
 * Split a knack chip list into MotM standard vs inverted twin pools (Sage vs Cosmos, etc.).
 * @param {[string, Record<string, unknown>][]} list
 * @param {CharacterLike} character
 * @param {string} [rowCallingId]
 * @param {{ callings?: Record<string, unknown> }} [bundle]
 * @returns {{ pair: NonNullable<ReturnType<typeof motmCallingPairForRow>>; rowCallingId: string; inverted: [string, Record<string, unknown>][]; standard: [string, Record<string, unknown>][]; other: [string, Record<string, unknown>][] } | null}
 */
export function splitMotmKnackEntriesBySubpool(list, character, rowCallingId, bundle) {
  const cid = String(rowCallingId ?? character?.callingId ?? "").trim();
  const pair = motmCallingPairForRow(cid, bundle);
  if (!cid || !pair) return null;
  /** @type {[string, Record<string, unknown>][]} */
  const inverted = [];
  /** @type {[string, Record<string, unknown>][]} */
  const standard = [];
  /** @type {[string, Record<string, unknown>][]} */
  const other = [];
  for (const entry of list) {
    if (isGeneralCallingKnack(entry[1])) continue;
    const sub = motmInvertedKnackSubpoolKey(entry[1], character, cid, entry[0], bundle);
    if (sub === "inverted") inverted.push(entry);
    else if (sub === "standard-twin") standard.push(entry);
    else other.push(entry);
  }
  const deduped = dedupeMotmTwinKnackSubpoolLists(inverted, standard, cid);
  return {
    pair,
    rowCallingId: cid,
    inverted: deduped.inverted,
    standard: deduped.standard,
    other,
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
  const tok = knackCallingTokensForRowMatch(k, character, bundle);
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
  return motmTwinKnackPoolSectionTitle(subKey, pair, anchorCallingId);
}

/**
 * Peer section heading for a MotM knack pool (Sage vs Cosmos, etc.).
 * @param {"inverted" | "standard-twin"} subKey
 * @param {ReturnType<typeof motmCallingPairForRow>} pair
 * @param {string} [anchorCallingId]
 */
export function motmTwinKnackPoolSectionTitle(subKey, pair, anchorCallingId) {
  if (!pair) return "";
  const anchor = String(anchorCallingId ?? pair.rowCallingId ?? "").trim();
  if (subKey === "standard-twin") {
    const yours = anchor === pair.standardId ? " (your Calling)" : "";
    return `${pair.stdName}${yours}`;
  }
  if (subKey === "inverted") {
    const yours = anchor === pair.invertedId ? " (your Calling)" : "";
    return `${pair.invName}${yours}`;
  }
  return "";
}

/**
 * One-line help under a MotM twin knack pool heading.
 * @param {"inverted" | "standard-twin"} subKey
 */
export function motmTwinKnackPoolSectionHelp(subKey) {
  if (subKey === "standard-twin") {
    return "Standard Calling knacks from Scion: Origin / Pandora's Box.";
  }
  if (subKey === "inverted") {
    return "Inverted Mythos knacks (Masks of the Mythos pp. 47–49).";
  }
  return "";
}

/**
 * MotM twin knack pool display order: your Calling’s pool first, paired twin second.
 * @param {string} [anchorCallingId] — Calling on this row / your Calling
 * @param {ReturnType<typeof motmCallingPairForRow>} pair
 * @returns {("standard-twin" | "inverted")[]}
 */
export function motmTwinKnackPoolOrder(anchorCallingId, pair) {
  if (!pair) return ["standard-twin", "inverted"];
  const anchor = String(anchorCallingId ?? pair.rowCallingId ?? "").trim();
  if (anchor === pair.invertedId) return ["inverted", "standard-twin"];
  if (anchor === pair.standardId) return ["standard-twin", "inverted"];
  return ["standard-twin", "inverted"];
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
  const expanded = expandMotmKnackAccessCallingIds(k, raw, character, bundle);
  const callings = bundle?.callings || {};
  const names = [...new Set(expanded)]
    .map((id) => (callings[id] && typeof callings[id] === "object" ? String(callings[id].name || "").trim() : "") || id)
    .filter(Boolean);
  if (!names.length) return "";
  let line = `Applies to: ${names.join(", ")}.`;
  const cid = String(character?.callingId ?? "").trim();
  const mythosPan = isMythosPantheonForCharacter(character, bundle);
  const twin = mythosCallingTwinId(cid);
  if (
    cid &&
    mythosPan &&
    twin &&
    (isMythosInvertedTwinCallingId(cid) || isMythosStandardTwinCallingId(cid))
  ) {
    const sub = motmInvertedKnackSubpoolKey(k, character, cid, undefined, bundle);
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

/**
 * The single Origin Calling-dot Knack carried forward at Hero+ (not Finishing extras / Experience).
 * @param {CharacterLike} character
 * @returns {string | null}
 */
export function heroOriginCallingBudgetKnackId(character) {
  const locked = knackLockedIdSet(character);
  const fin = finishingBonusKnackIdSet(character);
  const xp = new Set([...experienceKnackIdSet(character), ...carriedExperienceKnackIdSet(character)]);
  for (const id of character.knackIds || []) {
    if (typeof id !== "string" || !id.trim() || id.startsWith("_")) continue;
    if (!locked.has(id)) continue;
    if (fin.has(id) || xp.has(id)) continue;
    return id;
  }
  return null;
}

/**
 * Origin Finishing extras recorded on tier-advance log entries (union across advances).
 * @param {CharacterLike} character
 * @returns {Set<string>}
 */
export function carriedFinishingBonusKnackIdsFromTierLog(character) {
  const out = new Set();
  const log = character.tierAdvancementLog;
  if (!Array.isArray(log)) return out;
  for (const entry of log) {
    const carried = entry?.carriedFinishingBonusKnackIds;
    if (!Array.isArray(carried)) continue;
    for (const id of carried) {
      const kid = String(id ?? "").trim();
      if (kid) out.add(kid);
    }
  }
  return out;
}

/**
 * Tier the character was on when a Knack was first carried forward (advance `fromTier`).
 * @param {CharacterLike} character
 * @param {string} knackId
 * @returns {string | null}
 */
export function tierWhenKnackFirstCarriedForward(character, knackId) {
  const kid = String(knackId ?? "").trim();
  if (!kid) return null;
  const log = character.tierAdvancementLog;
  if (!Array.isArray(log)) return null;
  const seen = new Set();
  for (const entry of log) {
    const carried = (entry?.carriedKnackIds || []).filter(
      (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
    );
    const set = new Set(carried);
    if (!seen.has(kid) && set.has(kid)) return String(entry.fromTier ?? "").trim() || null;
    for (const id of carried) seen.add(id);
  }
  return null;
}

/**
 * Hero / Titanic band only: Origin may have several locked Knacks but only one spends Calling dots.
 * @param {CharacterLike} character
 */
function isOriginThroughHeroBandTier(character) {
  return tierRank(character.tier) <= 1;
}

/**
 * Keep `finishingBonusKnackIds` aligned with tier-advance data.
 * Hero-band: infer Origin Finishing extras (all locked Knacks except the one Origin budget pick).
 * Demigod+: only tier-log / explicit ids — never re-tag later-tier chargen purchases as Finishing.
 * @param {CharacterLike} character
 * @returns {boolean}
 */
export function ensureFinishingBonusKnackIds(character) {
  if (!Array.isArray(character.finishingBonusKnackIds)) character.finishingBonusKnackIds = [];
  const locked = knackLockedIdSet(character);
  const held = new Set(character.knackIds || []);
  const xp = new Set([...experienceKnackIdSet(character), ...carriedExperienceKnackIdSet(character)]);
  const logFin = carriedFinishingBonusKnackIdsFromTierLog(character);
  let fin;
  if (isOriginThroughHeroBandTier(character) && locked.size > 1) {
    const lockedInOrder = (character.knackIds || []).filter(
      (id) => typeof id === "string" && id.trim() && locked.has(id),
    );
    const budgetKnack = lockedInOrder.find((id) => !xp.has(id)) || lockedInOrder[0];
    fin = new Set();
    for (const id of lockedInOrder) {
      if (id !== budgetKnack && !xp.has(id)) fin.add(id);
    }
  } else {
    fin = new Set([...finishingBonusKnackIdSet(character), ...logFin]);
    if (!logFin.size && !finishingBonusKnackIdSet(character).size && locked.size > 1) {
      const lockedInOrder = (character.knackIds || []).filter(
        (id) => typeof id === "string" && id.trim() && locked.has(id),
      );
      const budgetKnack = lockedInOrder.find((id) => !xp.has(id)) || lockedInOrder[0];
      for (const id of lockedInOrder) {
        if (id !== budgetKnack && !xp.has(id)) fin.add(id);
      }
    }
  }
  const next = [...fin].filter((id) => locked.has(id) && held.has(id));
  const prev = finishingBonusKnackIdSet(character);
  const changed = next.length !== prev.size || next.some((id) => !prev.has(id));
  character.finishingBonusKnackIds = next;
  return changed;
}

/**
 * Record Calling-row knack point costs for Knacks about to lock at tier advance (old tier rules).
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @param {string} fromTier
 */
export function snapshotKnackRowBudgetCostsBeforeTierAdvance(character, bundle, fromTier) {
  if (!character.knackLockedRowBudgetCostById || typeof character.knackLockedRowBudgetCostById !== "object") {
    character.knackLockedRowBudgetCostById = {};
  }
  const map = character.knackLockedRowBudgetCostById;
  const locked = knackLockedIdSet(character);
  const charAtTier = { ...character, tier: fromTier };
  for (const id of character.knackIds || []) {
    if (typeof id !== "string" || !id.trim() || id.startsWith("_") || locked.has(id)) continue;
    if (!knackCountsAgainstCallingRowBudget(character, id)) continue;
    const cost = knackCallingSlotCost(bundleKnackById(id, bundle), charAtTier);
    map[id] = cost === 2 ? 2 : 1;
  }
}

/**
 * Backfill locked Knack row-budget costs for saves that advanced before snapshots existed.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {boolean}
 */
export function snapshotMissingLockedKnackRowBudgetCosts(character, bundle) {
  if (!character.knackLockedRowBudgetCostById || typeof character.knackLockedRowBudgetCostById !== "object") {
    character.knackLockedRowBudgetCostById = {};
  }
  const map = character.knackLockedRowBudgetCostById;
  const locked = knackLockedIdSet(character);
  let changed = false;
  for (const id of locked) {
    if (map[id] != null && Number.isFinite(Number(map[id]))) continue;
    if (!knackCountsAgainstCallingRowBudget(character, id)) continue;
    if (!(character.knackIds || []).includes(id)) continue;
    const tier = tierWhenKnackFirstCarriedForward(character, id) ?? character.tier;
    const cost = knackCallingSlotCost(bundleKnackById(id, bundle), { ...character, tier });
    map[id] = cost === 2 ? 2 : 1;
    changed = true;
  }
  return changed;
}

/**
 * Calling row index for the Origin Mortal Calling (`callingId`), defaulting to row 0.
 * @param {CharacterLike} character
 * @returns {number}
 */
export function heroOriginCallingRowIndex(character) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots) || !character.callingSlots.length) {
    return 0;
  }
  const originCalling = String(character.callingId || "").trim();
  if (!originCalling) return 0;
  for (let i = 0; i < character.callingSlots.length; i += 1) {
    if (String(character.callingSlots[i]?.id || "").trim() === originCalling) return i;
  }
  return 0;
}

/**
 * Origin Mortal Calling-dot Knack pays from the row matching `callingId` (usually row 0 after Visitation).
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {boolean}
 */
export function pinLockedOriginBudgetKnackToPrimaryRow(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots) || !character.callingSlots.length) {
    return false;
  }
  const originId = heroOriginCallingBudgetKnackId(character);
  if (!originId) return false;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const map = character.knackSlotById;
  const targetRow = heroOriginCallingRowIndex(character);
  const cost = knackRowBudgetCost(character, originId, bundle);
  const cap = callingRowDotCap(character, targetRow);
  if (cost === 2 && cap < 2) return false;
  const curRow = map[originId];
  if (curRow != null && Number.isFinite(Number(curRow)) && Number(curRow) === targetRow) return false;
  const trialMap = { ...map, [originId]: targetRow };
  if (rowKnackPointsUsed(targetRow, character.knackIds || [], trialMap, bundle, character) > cap) return false;
  map[originId] = targetRow;
  return true;
}

/** Exp Leveling purchases — on the sheet but free against Calling dot / row knack budgets. */
export function experienceKnackIdSet(character) {
  const raw = character?.experienceKnackIds;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")));
}

/**
 * Origin / prior-tier Experience knack buys carried on `knackIds` after tier advance — still free
 * against Hero Calling row knack budgets (no longer listed in `experienceKnackIds`).
 */
export function carriedExperienceKnackIdSet(character) {
  const raw = character?.carriedExperienceKnackIds;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")));
}

/**
 * Finishing extras and Experience knacks do not spend row budget; at Hero+ they may not match any
 * Visitation Calling row (Origin pick vs new rows). Allow any row for slot bookkeeping only.
 * @param {CharacterLike} character
 * @param {string} knackId
 */
export function knackRowAssignmentCallingExempt(character, knackId) {
  const kid = String(knackId ?? "").trim();
  if (!kid) return false;
  if (finishingBonusKnackIdSet(character).has(kid)) return true;
  if (experienceKnackIdSet(character).has(kid)) return true;
  if (carriedExperienceKnackIdSet(character).has(kid)) return true;
  return false;
}

/**
 * After any tier advance (Origin→Hero, Hero→Demigod, Titanic→Demigod, etc.): XP knack picks
 * carried forward stay on `knackIds` / `lockedKnackIds` only — not on Exp Leveling.
 * @param {CharacterLike} character
 * @param {string[]} carriedKnackIds
 */
export function settleExperienceKnacksAfterTierAdvance(character, carriedKnackIds) {
  if (!character || typeof character !== "object") return;
  if (!Array.isArray(character.experienceKnackIds) || !character.experienceKnackIds.length) return;
  const carried = new Set(
    (carriedKnackIds || []).filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")),
  );
  if (!carried.size) return;
  const xpCarriedForward = character.experienceKnackIds.filter((id) => carried.has(id));
  if (!Array.isArray(character.carriedExperienceKnackIds)) character.carriedExperienceKnackIds = [];
  if (xpCarriedForward.length) {
    character.carriedExperienceKnackIds = [
      ...new Set([...character.carriedExperienceKnackIds, ...xpCarriedForward]),
    ];
  }
  character.experienceKnackIds = character.experienceKnackIds.filter((id) => !carried.has(id));
}

/**
 * On load / ensureExperienceShape: drop locked or off-sheet ids from active Exp Leveling knack list.
 * @param {CharacterLike} character
 */
export function settleLockedExperienceKnacks(character) {
  if (!character || typeof character !== "object") return;
  if (!Array.isArray(character.experienceKnackIds)) {
    character.experienceKnackIds = [];
    return;
  }
  const main = new Set(
    (character.knackIds || []).filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")),
  );
  const locked = knackLockedIdSet(character);
  character.experienceKnackIds = [
    ...new Set(
      character.experienceKnackIds.filter(
        (id) => typeof id === "string" && id.trim() && main.has(id) && !locked.has(id),
      ),
    ),
  ];
}

/**
 * Knack already on the sheet from chargen or locked after tier advance — not an Exp Leveling target.
 * @param {CharacterLike} character
 * @param {string} knackId
 */
export function knackOwnedFromPriorChargenPick(character, knackId) {
  const id = String(knackId ?? "").trim();
  if (!id) return false;
  if ((character.finishing?.finishingKnackIds || []).includes(id)) return true;
  if (finishingBonusKnackIdSet(character).has(id)) return true;
  if (!(character.knackIds || []).includes(id)) return false;
  if (!experienceKnackIdSet(character).has(id)) return true;
  if (isKnackLocked(character, id)) return true;
  return false;
}

/** @param {CharacterLike} character @param {string} knackId */
export function knackCountsAgainstCallingRowBudget(character, knackId) {
  const kid = String(knackId ?? "").trim();
  if (!kid) return true;
  if (finishingBonusKnackIdSet(character).has(kid)) return false;
  if (experienceKnackIdSet(character).has(kid)) return false;
  if (carriedExperienceKnackIdSet(character).has(kid)) return false;
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
function popLastUnlockedKnackId(knackIds, character, slotMap = null) {
  const arr = knackIds;
  for (let i = arr.length - 1; i >= 0; i -= 1) {
    const id = arr[i];
    if (isKnackLocked(character, id)) continue;
    if (slotMap && slotMap[id] != null) continue;
    return arr.splice(i, 1)[0];
  }
  return null;
}

/** PB General Calling knack — may be paid from any Calling row the player chooses. */
export function isGeneralCallingKnack(k) {
  if (!k || typeof k !== "object") return false;
  if (k.callingsAny === true || k.calling === "any") return true;
  return knackRawCallingIdList(k).length === 0;
}

/** Dot budget for one Hero `callingSlots` row — equals that Calling’s dot rating (1–5). */
export function callingRowDotCap(character, rowIdx) {
  return heroCallingSlotRowDots(character, rowIdx);
}

/**
 * Knack points already spent on a Calling row (from `knackSlotById` assignments).
 * Uses {@link knackRowBudgetCost} so locked chargen picks keep their tier-of-purchase cost;
 * Finishing extras and Experience knacks contribute 0.
 * @param {number} rowIdx
 * @param {string[]} knackIds
 * @param {Record<string, number>} slotMap
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @param {CharacterLike} character
 */
export function rowKnackPointsUsed(rowIdx, knackIds, slotMap, bundle, character) {
  const row = Number(rowIdx);
  if (!Number.isFinite(row)) return 0;
  let used = 0;
  for (const id of knackIds || []) {
    if (typeof id !== "string" || !id.trim()) continue;
    if (Number(slotMap?.[id]) !== row) continue;
    used += knackRowBudgetCost(character, id, bundle);
  }
  return used;
}

/**
 * Hero-band Immortal knacks that already have a payer row (orphans in `knackIds` alone do not count).
 * @param {string[]} knackIds
 * @param {Record<string, number>} slotMap
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function heavyImmortalKnackCountAssigned(knackIds, slotMap, bundle) {
  let n = 0;
  for (const id of knackIds || []) {
    if (typeof id !== "string" || !id.trim() || id.startsWith("_")) continue;
    const r = slotMap?.[id];
    if (r == null || !Number.isFinite(Number(r))) continue;
    const kn = bundleKnackById(id, bundle);
    if (knackHeroBandSlotCost(kn) === 2) n += 1;
  }
  return n;
}

/**
 * Hero-band Immortal knacks already assigned to one Calling row (per-row cap, not global).
 * @param {number} rowIdx
 * @param {string[]} knackIds
 * @param {Record<string, number>} slotMap
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function heavyImmortalKnackCountAssignedOnRow(rowIdx, knackIds, slotMap, bundle) {
  const row = Number(rowIdx);
  if (!Number.isFinite(row)) return 0;
  let n = 0;
  for (const id of knackIds || []) {
    if (typeof id !== "string" || !id.trim() || id.startsWith("_")) continue;
    if (Number(slotMap?.[id]) !== row) continue;
    const kn = bundleKnackById(id, bundle);
    if (knackHeroBandSlotCost(kn) === 2) n += 1;
  }
  return n;
}

/**
 * Validate a single new or moved payer-row assignment (does not require every held Knack to be mapped yet).
 * @param {string} knackId
 * @param {number} rowIdx
 * @param {string[]} knackIds
 * @param {Record<string, number>} slotMap
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function validateCommittedKnackRowAssignment(knackId, rowIdx, knackIds, slotMap, character, bundle) {
  const id = String(knackId ?? "").trim();
  const ri = Number(rowIdx);
  if (!id || !Number.isFinite(ri) || ri < 0) return false;
  const slots = character?.callingSlots;
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(slots) || ri >= slots.length) return false;
  const kn = bundleKnackById(id, bundle);
  if (!kn) return false;
  if (!knackRowAssignmentCallingExempt(character, id) && !heroCallingRowMatchesKnack(ri, kn, character, bundle)) {
    return false;
  }
  const cost = knackCallingSlotCost(kn, character);
  const cap = callingRowDotCap(character, ri);
  if (cost === 2 && cap < 2) return false;
  if (immortalKnackCostsTwoCallingSlots(character.tier) && knackPointCost(kn) === 2) {
    const assignedOnRow = heavyImmortalKnackCountAssignedOnRow(ri, knackIds, slotMap, bundle);
    if (assignedOnRow > 1) return false;
  }
  if (rowKnackPointsUsed(ri, knackIds, slotMap, bundle, character) > cap) return false;
  return true;
}

/**
 * Hero Calling-step purchases with a payer row must not stay in Experience pools (budget-exempt).
 * Row-assigned Experience / carried-Experience knacks keep their pool tags — assignment is display only.
 * @param {CharacterLike} character
 * @returns {boolean}
 */
export function stripRowPaidKnacksFromExperiencePools(character) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return false;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") return false;
  const map = character.knackSlotById;
  const xpPoolIds = new Set([...experienceKnackIdSet(character), ...carriedExperienceKnackIdSet(character)]);
  const rowPaidCallingBudget = (/** @type {string} */ id) => {
    if (map[id] == null || !Number.isFinite(Number(map[id]))) return false;
    if (xpPoolIds.has(id)) return false;
    return true;
  };
  let changed = false;
  if (Array.isArray(character.experienceKnackIds)) {
    const next = character.experienceKnackIds.filter((id) => !rowPaidCallingBudget(id));
    if (next.length !== character.experienceKnackIds.length) {
      character.experienceKnackIds = next;
      changed = true;
    }
  }
  if (Array.isArray(character.carriedExperienceKnackIds)) {
    const next = character.carriedExperienceKnackIds.filter((id) => !rowPaidCallingBudget(id));
    if (next.length !== character.carriedExperienceKnackIds.length) {
      character.carriedExperienceKnackIds = next;
      changed = true;
    }
  }
  return changed;
}

/**
 * Older saves: `stripRowPaidKnacksFromExperiencePools` cleared XP pool tags when row assignments were
 * written for display. Re-tag from `experiencePurchaseLog` Knack lines when the pick is still on the sheet.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {boolean}
 */
export function reassertExperienceKnackPoolTags(character, bundle) {
  if (!character || typeof character !== "object" || !bundle?.knacks) return false;
  const log = character.experiencePurchaseLog;
  if (!Array.isArray(log) || !log.length) return false;
  /** @type {Set<string>} */
  const knackLogNames = new Set();
  for (const line of log) {
    if (typeof line !== "string" || !line.trim()) continue;
    const m = line.match(/^Knack:\s*(.+?)\s*\(\d+\s*XP\)$/);
    if (m) knackLogNames.add(m[1].trim());
  }
  if (!knackLogNames.size) return false;
  const xpTagged = new Set([...experienceKnackIdSet(character), ...carriedExperienceKnackIdSet(character)]);
  const fin = finishingBonusKnackIdSet(character);
  let changed = false;
  for (const id of character.knackIds || []) {
    if (typeof id !== "string" || !id.trim() || xpTagged.has(id) || fin.has(id)) continue;
    const name = String(bundle.knacks[id]?.name || "").trim();
    if (!name || !knackLogNames.has(name)) continue;
    if (isKnackLocked(character, id)) {
      if (!Array.isArray(character.carriedExperienceKnackIds)) character.carriedExperienceKnackIds = [];
      if (!carriedExperienceKnackIdSet(character).has(id)) {
        character.carriedExperienceKnackIds.push(id);
        changed = true;
      }
    } else {
      if (!Array.isArray(character.experienceKnackIds)) character.experienceKnackIds = [];
      if (!experienceKnackIdSet(character).has(id)) {
        character.experienceKnackIds.push(id);
        changed = true;
      }
    }
  }
  if (changed) {
    character.carriedExperienceKnackIds = [...new Set(character.carriedExperienceKnackIds || [])];
    character.experienceKnackIds = [...new Set(character.experienceKnackIds || [])];
  }
  return changed;
}

/**
 * Re-home held Knacks whose payer row does not match the knack's Calling pool (MotM twin rows, etc.).
 * Fixes saves that parked knacks on the Origin Cosmos row when they belong on Corruptor (Guardian), etc.
 * Experience / carried-Experience knacks keep 0 budget cost after the move.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {boolean}
 */
export function repairMisassignedKnackCallingRows(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return false;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const map = character.knackSlotById;
  let changed = false;
  for (const id of character.knackIds || []) {
    const kn = bundleKnackById(id, bundle);
    if (!kn) continue;
    const cur = map[id];
    if (cur != null && Number.isFinite(Number(cur)) && heroCallingRowMatchesKnack(Number(cur), kn, character, bundle)) {
      continue;
    }
    for (let ri = 0; ri < character.callingSlots.length; ri += 1) {
      if (!heroCallingRowMatchesKnack(ri, kn, character, bundle)) continue;
      if (map[id] !== ri) {
        map[id] = ri;
        changed = true;
      }
      break;
    }
  }
  return changed;
}

/** @deprecated Use {@link repairMisassignedKnackCallingRows}; kept for existing imports. */
export function repairExperienceKnackCallingRows(character, bundle) {
  return repairMisassignedKnackCallingRows(character, bundle);
}

/**
 * Drop unlocked, non-exempt Knacks held in `knackIds` without a payer row (stale clicks / failed commits).
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {boolean}
 */
export function pruneOrphanUnmappedKnackPurchases(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return false;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const map = character.knackSlotById;
  const held = [...(character.knackIds || [])].filter(
    (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
  );
  let changed = false;
  const next = held.filter((id) => {
    if (isKnackLocked(character, id)) return true;
    if (knackRowAssignmentCallingExempt(character, id)) return true;
    if (map[id] != null && Number.isFinite(Number(map[id]))) return true;
    changed = true;
    delete map[id];
    return false;
  });
  if (changed) character.knackIds = next;
  return changed;
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
  if (isKnackLocked(character, kid)) {
    const snap = character.knackLockedRowBudgetCostById?.[kid];
    if (snap != null && Number.isFinite(Number(snap))) return Number(snap) === 2 ? 2 : 1;
  }
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
    if (
      !kn ||
      (!knackRowAssignmentCallingExempt(character, id) &&
        !heroCallingRowMatchesKnack(r, kn, character, bundle))
    ) {
      return false;
    }
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
  const mapForCap = {
    ...knackSlotMapForRowBudgetUi(character, bundle),
    ...(slotMap && typeof slotMap === "object" ? slotMap : {}),
  };
  const omit = new Set(
    [kid, excludeKnackId].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")),
  );
  /** Knacks already on the character — never budget-solve the pick being evaluated (avoids double-counting its cost). */
  const heldIds = ids.filter((id) => !omit.has(id));
  /** Only count explicit payer rows — provisional solves blocked first picks on other Callings. */
  const map = mapForCap;
  const out = [];
  const heroImm = immortalKnackCostsTwoCallingSlots(character.tier) && knackPointCost(k) === 2;
  for (let ri = 0; ri < character.callingSlots.length; ri += 1) {
    if (!heroCallingRowMatchesKnack(ri, k, character, bundle)) continue;
    const cap = callingRowDotCap(character, ri);
    if (cost === 2 && cap < 2) continue;
    if (heroImm) {
      const alreadyPaidHere = ids.includes(kid) && Number(mapForCap[kid]) === ri;
      if (!alreadyPaidHere && heavyImmortalKnackCountAssignedOnRow(ri, ids, mapForCap, bundle) > 0) continue;
    }
    const used = rowKnackPointsUsed(ri, heldIds, map, bundle, character);
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
  const xpExempt = experienceKnackIdSet(character).has(kid) || carriedExperienceKnackIdSet(character).has(kid);
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
  const knTok = knackCallingTokensForRowMatch(k, character, _bundle);
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
 * Hero-band: two-dot knacks only on rows with two+ dots; at most one two-dot knack per Calling row.
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

  /** Keep explicit payer rows (e.g. just chosen in the Calling knack panel) when they still fit. */
  /** @type {Record<string, number>} */
  const pinned = {};
  const rowUsed = rowCaps.map(() => 0);
  const allHeld = [...(character.knackIds || [])].filter(
    (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
  );
  for (const id of allHeld) {
    if (ids.includes(id)) continue;
    const r = existing[id];
    if (r == null || !Number.isFinite(r) || r < 0 || r >= rowCount) continue;
    if (!knackCountsAgainstCallingRowBudget(character, id)) continue;
    rowUsed[r] += knackRowBudgetCost(character, id, bundle);
  }
  const originBudgetId = heroOriginCallingBudgetKnackId(character);
  const originRow = heroOriginCallingRowIndex(character);
  if (originBudgetId && ids.includes(originBudgetId) && existing[originBudgetId] == null) {
    const cost = knackRowBudgetCost(character, originBudgetId, bundle);
    if ((cost !== 2 || rowCaps[originRow] >= 2) && rowUsed[originRow] + cost <= rowCaps[originRow]) {
      pinned[originBudgetId] = originRow;
      rowUsed[originRow] += cost;
    }
  }

  /** @type {string[]} */
  const freeIds = [];
  for (const id of ids) {
    if (pinned[id] != null) continue;
    const r = existing[id];
    if (r != null && Number.isFinite(r) && r >= 0 && r < rowCount) {
      const kn = bundleKnackById(id, bundle);
      if (kn) {
        const cost = knackRowBudgetCost(character, id, bundle);
        const callingExempt = knackRowAssignmentCallingExempt(character, id);
        if (
          (callingExempt || heroCallingRowMatchesKnack(r, kn, character, bundle)) &&
          (cost !== 2 || rowCaps[r] >= 2) &&
          rowUsed[r] + cost <= rowCaps[r]
        ) {
          pinned[id] = r;
          rowUsed[r] += cost;
          continue;
        }
      }
    }
    freeIds.push(id);
  }
  if (freeIds.length === 0) {
    return validateKnackSlotAssignments(ids, pinned, character, bundle) ? pinned : null;
  }

  function dfsFree(i, slotMap) {
    if (i >= freeIds.length) return { ...slotMap };
    const kid = freeIds[i];
    const kn = bundleKnackById(kid, bundle);
    if (!kn) return null;
    const cost = knackRowBudgetCost(character, kid, bundle);
    const callingExempt = knackRowAssignmentCallingExempt(character, kid);
    for (let r = 0; r < rowCount; r += 1) {
      if (!callingExempt && !heroCallingRowMatchesKnack(r, kn, character, bundle)) continue;
      if (cost === 2 && rowCaps[r] < 2) continue;
      if (rowUsed[r] + cost > rowCaps[r]) continue;
      rowUsed[r] += cost;
      slotMap[kid] = r;
      const solved = dfsFree(i + 1, slotMap);
      if (solved) return solved;
      rowUsed[r] -= cost;
      delete slotMap[kid];
    }
    return null;
  }
  const solvedFree = dfsFree(0, {});
  if (!solvedFree) {
    return Object.keys(pinned).length ? pinned : null;
  }
  return { ...pinned, ...solvedFree };
}

/**
 * Assign only held Knacks that lack a payer row — never overwrites explicit player picks.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function settleUnassignedHeldKnackSlots(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const map = character.knackSlotById;
  const heldIds = [...(character.knackIds || [])].filter(
    (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
  );
  const unassigned = heldIds.filter((id) => map[id] == null);
  if (!unassigned.length) return;
  /** Solve the full held list so row budgets account for every explicit payer row. */
  const solved = solveHeroKnackSlotAssignment(heldIds, character, bundle);
  if (!solved) return;
  for (const id of unassigned) {
    if (map[id] == null && solved[id] != null) map[id] = solved[id];
  }
}

/**
 * Assign payer rows for held Knacks that lack `knackSlotById` (e.g. after Origin→Hero merge).
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {boolean}
 */
export function repairUnmappedHeroKnackSlots(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return false;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const map = character.knackSlotById;
  const heldIds = [...(character.knackIds || [])].filter(
    (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
  );
  const orphans = heldIds.filter((id) => map[id] == null);
  if (!orphans.length) return false;
  const solved = solveHeroKnackSlotAssignment(heldIds, character, bundle);
  if (!solved) return false;
  let changed = false;
  for (const id of orphans) {
    if (solved[id] != null) {
      map[id] = solved[id];
      changed = true;
    }
  }
  return changed;
}

/**
 * Before the Hero Calling knack shop: assign payer rows for carried-forward (locked) Knacks so row budgets are accurate.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 */
export function seedHeroKnackRowAssignments(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const heldIds = [...(character.knackIds || [])].filter(
    (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
  );
  if (!heldIds.length) return;
  const map = character.knackSlotById;
  const needs = heldIds.some((id) => map[id] == null);
  if (!needs) return;
  const solved = solveHeroKnackSlotAssignment(heldIds, character, bundle);
  if (!solved) return;
  for (const id of heldIds) {
    if (map[id] != null && !isKnackLocked(character, id)) continue;
    if (solved[id] != null) map[id] = solved[id];
  }
}

/**
 * Pin a held Knack to a Calling row when that row can afford it (explicit payer — no provisional solve).
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @param {string} kid
 * @param {Record<string, unknown>} k
 * @param {number} rowIdx
 * @returns {boolean}
 */
/**
 * Hero three-row UI: chip is “on” only when this Calling row pays for the Knack (not merely held in `knackIds`).
 * @param {CharacterLike} character
 * @param {string} knackId
 * @param {number | null | undefined} rowIdx
 * @returns {boolean}
 */
export function knackSelectedOnCallingRow(character, knackId, rowIdx) {
  const id = String(knackId ?? "").trim();
  if (!id) return false;
  if (!(character.knackIds || []).includes(id)) return false;
  if (rowIdx == null || !Number.isFinite(Number(rowIdx))) return true;
  const pay = character.knackSlotById?.[id];
  if (pay == null || !Number.isFinite(Number(pay))) return false;
  return Number(pay) === Number(rowIdx);
}

export function pinHeldKnackToCallingRowIfAffordable(character, bundle, kid, k, rowIdx) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return false;
  const id = String(kid ?? "").trim();
  const ri = Number(rowIdx);
  if (!id || !Number.isFinite(ri) || ri < 0 || ri >= character.callingSlots.length) return false;
  if (!(character.knackIds || []).includes(id)) return false;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const map = character.knackSlotById;
  const rows = callingRowsThatCanPayForKnack(k, character, bundle, character.knackIds || [], map, id);
  if (!rows.includes(ri)) return false;
  map[id] = ri;
  return true;
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
  settleUnassignedHeldKnackSlots(character, bundle);
}

/**
 * Write a full, valid row assignment for locked / carried-forward Knacks so UI budgets match eligibility.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {boolean}
 */
/**
 * Row assignment map for knack budget display — held knacks only, solved when needed.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {Record<string, number>}
 */
export function knackSlotMapForRowBudgetUi(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return {};
  pinLockedOriginBudgetKnackToPrimaryRow(character, bundle);
  const heldIds = [...(character.knackIds || [])].filter(
    (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
  );
  const map =
    character.knackSlotById && typeof character.knackSlotById === "object" ? { ...character.knackSlotById } : {};
  if (!heldIds.length) return map;
  if (validateKnackSlotAssignments(heldIds, map, character, bundle)) return map;
  const unassigned = heldIds.filter((id) => map[id] == null);
  if (unassigned.length) {
    const solved = solveHeroKnackSlotAssignment(unassigned, character, bundle);
    if (solved) {
      for (const id of unassigned) {
        if (solved[id] != null) map[id] = solved[id];
      }
    }
  }
  return map;
}

export function persistHeroKnackSlotMapIfSolvable(character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return false;
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const ids = [...(character.knackIds || [])].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  if (!ids.length) return true;
  if (validateKnackSlotAssignments(ids, character.knackSlotById, character, bundle)) return true;
  const solved = solveHeroKnackSlotAssignment(ids, character, bundle);
  if (!solved || Object.keys(solved).length !== ids.length) return false;
  if (!validateKnackSlotAssignments(ids, solved, character, bundle)) return false;
  for (const id of ids) character.knackSlotById[id] = solved[id];
  return true;
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
  if (validateKnackSlotAssignments(cur, map, character, bundle)) {
    character.knackIds = cur;
    return;
  }
  /** Full re-solve (Finishing / XP extras may sit on any row — see {@link knackRowAssignmentCallingExempt}). */
  const solved = solveHeroKnackSlotAssignment(cur, character, bundle);
  if (solved) {
    for (const id of cur) {
      if (solved[id] == null) continue;
      if (map[id] != null && !isKnackLocked(character, id)) continue;
      map[id] = solved[id];
    }
    if (validateKnackSlotAssignments(cur, map, character, bundle)) {
      character.knackIds = cur;
      return;
    }
  }
  /** Assign locked / carried-forward Knacks to rows before pruning — empty `knackSlotById` blocks new picks. */
  settleUnassignedHeldKnackSlots(character, bundle);
  if (validateKnackSlotAssignments(cur, map, character, bundle)) {
    character.knackIds = cur;
    return;
  }
  while (cur.length > 0 && !validateKnackSlotAssignments(cur, map, character, bundle)) {
    const removed = popLastUnlockedKnackId(cur, character, map);
    if (!removed) {
      const solved = solveHeroKnackSlotAssignment(cur, character, bundle);
      if (solved) {
        for (const id of cur) {
          if (solved[id] != null) map[id] = solved[id];
        }
      }
      break;
    }
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
    sum += knackRowBudgetCost(character, id, bundle);
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
    const map =
      character.knackSlotById && typeof character.knackSlotById === "object" ? character.knackSlotById : {};
    while (arr.length > 0 && solveHeroKnackSlotAssignment(arr, character, bundle) == null) {
      if (!popLastUnlockedKnackId(arr, character, map)) break;
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
    return callingRowsThatCanPayForKnack(k, character, bundle, [...cur, kid], map).length > 0;
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
  const expanded = expandMotmKnackAccessCallingIds(k, raw, character, bundle);
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
      allowed = expandMotmKnackAccessCallingIds(k, allowed, character, _bundle);
      const charCallings = mythosCharacterCallingIdsForKnacks(character, _bundle);
      if (!allowed.some((kc) => typeof kc === "string" && charCallings.has(kc))) return false;
    }
  }

  const tr = tierRank(character.tier);
  const kt = knackRuleTier(k);
  /** Origin: one Heroic knack (Origin Mortal list, PB Heroic General, or MotM inverted Heroic on Mythos). No Immortal until Hero+. */
  if (tr === 0) {
    if (kt === "immortal") return false;
    if (kt !== "mortal" && !knackOriginPlayHeroicPick(k) && !motmInvertedChargenKnackAtOrigin(k, character, _bundle)) {
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

  /** Two-point knacks need at least one Calling row rated 2+ (Hero p.184). */
  const knackSlotCost = knackCallingSlotCost(k, character);
  if (knackSlotCost === 2) {
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
 * Origin Calling step: count knacks that pass gates and bucket to the selected Calling row.
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} [bundle]
 */
export function countOriginSelectedCallingKnacks(character, bundle) {
  let n = 0;
  const table = bundle?.knacks;
  if (!table || typeof table !== "object") return 0;
  for (const [kid, k] of Object.entries(table)) {
    if (kid.startsWith("_") || !k || typeof k !== "object") continue;
    if (!knackEligible(k, character, bundle)) continue;
    if (originCallingKnackChipGroupKey(k, character, bundle) !== "selected") continue;
    n += 1;
  }
  return n;
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

  const tierNorm = normalizedTierIdEligibility(character.tier);
  const mythosHeroAwareness =
    String(character.pantheonId || "").trim() === "mythos" && isHeroBandCallingTierId(tierNorm);
  const catalogPv = mythosHeroAwareness ? mythosAwarenessCatalogPurviewForBoon(b, bundle) : null;
  const purviewSet = characterPurviewIdSet(character, bundle);
  if (catalogPv) {
    if (!purviewSet.has(catalogPv)) return false;
  } else if (!gateIds.some((id) => purviewSet.has(id))) {
    return false;
  }

  const tr = tierRank(character.tier);
  const tMin = catalogPv ? tierRank("hero") : b.tierMin != null ? tierRank(b.tierMin) : tierRank("hero");
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
