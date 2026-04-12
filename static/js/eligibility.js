/**
 * Knack / Boon eligibility for chargen UI (data-driven gates in JSON + character state).
 * @typedef {{ tier?: string; callingId?: string; callingDots?: number; callingSlots?: { id?: string; dots?: number }[]; pantheonId?: string; parentDeityId?: string; patronKind?: string; purviewIds?: string[]; patronPurviewSlots?: string[]; mythosInnatePower?: { style?: string; awarenessPurviewId?: string; awarenessLocked?: boolean }; legendRating?: number; awarenessRating?: number; boonIds?: string[]; pathRank?: { primary?: string }; knackIds?: string[]; knackSlotById?: Record<string, number> }} CharacterLike
 */

const TIER_RANK = { mortal: 0, sorcerer: 0, hero: 1, titanic: 1, demigod: 2, god: 3 };

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

/** Hero and Titanic tiers use three Calling rows in the wizard (`callingSlots`); Knacks use per-row dot budgets. */
export function heroUsesCallingSlotRows(character) {
  const t = normalizedTierIdEligibility(character?.tier);
  return t === "hero" || t === "titanic";
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

/** Largest dot rating among Hero Calling rows (for Immortal Knack gate). */
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

/** Calling-dot–equivalent cost: Heroic (Mortal) Knack = 1; Immortal Knack = 2 (Hero+). */
export function knackCallingSlotCost(k) {
  if (!k || typeof k !== "object") return 1;
  return k.knackKind === "immortal" ? 2 : 1;
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

function heroCallingRowMatchesKnack(rowIdx, k, character, _bundle) {
  const slots = character?.callingSlots;
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(slots)) return false;
  if (rowIdx < 0 || rowIdx >= slots.length) return false;
  const rowId = String(slots[rowIdx]?.id ?? "").trim();
  if (!rowId) return false;
  const rowTok = slotRowCallingTokenSet(rowId, character);
  const knTok = knackCallingTokensForRowMatch(k, character);
  if (knTok === null) return true;
  for (const x of knTok) {
    if (rowTok.has(x)) return true;
  }
  return false;
}

/**
 * Assign each main Knack to a Calling row so each row’s spent cost ≤ that row’s dots (Hero `callingSlots`);
 * Immortal Knacks only on rows with two+ dots; Hero+ at most one Immortal in the list.
 * @param {string[]} knackIds
 * @param {CharacterLike} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @returns {Record<string, number> | null}
 */
export function solveHeroKnackSlotAssignment(knackIds, character, bundle) {
  if (!heroUsesCallingSlotRows(character) || !Array.isArray(character.callingSlots)) return {};
  const ids = [...(knackIds || [])].filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_"));
  const tr = tierRank(character.tier);
  if (tr > 0 && immortalKnackCountInList(ids, bundle) > 1) return null;
  if (ids.length === 0) return {};
  const slots = character.callingSlots;
  const rowCount = slots.length;
  const rowCaps = slots.map((_, i) => heroCallingSlotRowDots(character, i));
  const n = ids.length;

  function dfs(i, rowUsed, slotMap) {
    if (i >= n) return { ...slotMap };
    const kid = ids[i];
    const kn = bundle?.knacks?.[kid];
    if (!kn) return null;
    const cost = knackCallingSlotCost(kn);
    for (let r = 0; r < rowCount; r += 1) {
      if (!heroCallingRowMatchesKnack(r, kn, character, bundle)) continue;
      if (kn.knackKind === "immortal" && rowCaps[r] < 2) continue;
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
 * Whether each main Knack can be assigned to some row without exceeding that row’s dots (and Immortal count).
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
 * Max Knack “slots” from Calling rating: Origin / Mortal / Sorcerer = 1; Hero with `callingSlots` = sum of row dots (cap 5); other Hero+ = `callingDots` (1–5).
 */
export function callingKnackSlotCap(character) {
  const t = String(character?.tier ?? "mortal").trim().toLowerCase();
  const norm = t === "origin" ? "mortal" : t;
  if (norm === "mortal" || norm === "sorcerer") return 1;
  const sumSlots = sumHeroCallingSlotDots(character);
  if (sumSlots != null && sumSlots > 0) return Math.max(1, Math.min(5, sumSlots));
  const d = Math.round(Number(character?.callingDots) || 1);
  return Math.max(1, Math.min(5, d));
}

/** Sum of slot costs for the given knack id list. */
export function knackIdsCallingSlotsUsed(knackIds, bundle) {
  let sum = 0;
  for (const id of knackIds || []) {
    if (typeof id !== "string" || !id.trim() || id.startsWith("_")) continue;
    const kn = bundle?.knacks?.[id];
    sum += knackCallingSlotCost(kn);
  }
  return sum;
}

export function immortalKnackCountInList(knackIds, bundle) {
  let n = 0;
  for (const id of knackIds || []) {
    const kn = bundle?.knacks?.[id];
    if (kn?.knackKind === "immortal") n += 1;
  }
  return n;
}

/**
 * Hero+ (Scion: Hero / Saints & Monsters Step Five): total slot cost ≤ Calling dots;
 * at most one Immortal Knack (it replaces two Heroic slots) when Calling has two+ dots.
 */
export function knackSetWithinCallingSlots(knackIds, character, bundle) {
  const cap = callingKnackSlotCap(character);
  const used = knackIdsCallingSlotsUsed(knackIds, bundle);
  if (used > cap) return false;
  const tr = tierRank(character.tier);
  const imm = immortalKnackCountInList(knackIds, bundle);
  if (tr <= 0) return imm === 0;
  if (imm > 1) return false;
  if (cap < 2 && imm > 0) return false;
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
 * spend Calling dot budget, but **do** count toward the global “at most one Immortal Knack” rule
 * together with `knackIds` and other finishing picks.
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
  if (imm > 1) return false;
  if (k.knackKind === "immortal" && callingKnackSlotCap(character) < 2) return false;
  return true;
}

/**
 * Whether a Knack id already listed in `finishingKnackIds` is still valid to keep (gates + at most one Immortal in Calling ∪ Finishing).
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

  /** Immortal Knacks need a Calling row (or single Calling rating) of at least two dots. */
  if (k.knackKind === "immortal") {
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

/** Epic Attribute Purviews: ladder dot 1 is a normal Boon pick, not bundled Purview-Innate UX. */
const EPIC_PURVIEW_IDS = new Set(["epicDexterity", "epicStamina", "epicStrength"]);

/**
 * True when this `*_dot_01` catalog row is the Purview Innate (or an unfilled ladder placeholder where Innate is separate in PB).
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
  const innateSummary = typeof row.purviewInnateSummary === "string" && row.purviewInnateSummary.trim();
  const innateName = typeof row.purviewInnateName === "string" && row.purviewInnateName.trim();
  if (innateSummary || innateName) return true;
  const desc = typeof b.description === "string" ? b.description : "";
  return desc.includes("Add the proper name");
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
