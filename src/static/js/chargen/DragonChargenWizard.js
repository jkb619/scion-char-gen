/**
 * Scion: Dragon — Heir character wizard (parallel track; Scion deity/titan flow stays in app.js).
 * @typedef {{ stepIndex?: number; pastConcept?: boolean; dragonWizardVersion?: number; flightId?: string; paths?: { origin?: string; role?: string; flight?: string }; pathRank?: { primary?: string; secondary?: string; tertiary?: string }; pathSkills?: { origin?: string[]; role?: string[]; flight?: string[] }; pathSkillRedistribution?: Record<string, number>; pathSkillRedistSourceHash?: string | null; skillDots?: Record<string, number>; finishingSkillBonus?: Record<string, number>; skillSpecialties?: Record<string, string>; attributes?: Record<string, number>; finishingAttrBaseline?: Record<string, number> | null; arenaRank?: string[]; favoredApproach?: string; callingSlots?: { id?: string; dots?: number }[]; knackSlotById?: Record<string, number>; callingKnackIds?: string[]; draconicKnackIds?: string[]; knownMagics?: string[]; spellsByMagicId?: Record<string, string>; bonusSpell?: { magicId?: string; spellId?: string }; birthrightPicks?: { id?: string; dots?: number }[]; finishingFocus?: string; finishingCallingKnackIds?: string[]; finishingBirthrightPicks?: { id?: string; dots?: number }[]; inheritance?: number; deedName?: string; remembranceTrackCenter?: boolean }} DragonState
 */

import { applyGameDataHint, applyHint, applySkillSpecialtyHints } from "../fieldHelp.js";
import { birthrightTagLabels } from "../birthrightTags.js";
import { wirePickerRowFilter, wireSortableTableColumns } from "../pickerTableUtils.js";
import {
  knackEligible,
  knackEligibleForCallingStep,
  knackSetWithinCallingSlots,
  knackIdsCallingSlotsUsed,
  syncHeroKnackSlotAssignments,
  knackCallingTokensForRowMatch,
  knackAppliesToCallingsLine,
  heroCallingRowMatchesKnack,
  bundleKnackById,
} from "../eligibility.js";
import { originDefenseFromFinalAttrs, originMovementPoolDice, buildCharacterSheet } from "../characterSheet.js";
import { dragonSpellChipHintEntity } from "../dragonSpellUi.js";
import { downloadReviewSheetAsPdf } from "../reviewSheetPdf.js";
import {
  coerceFatebindingsStoredList,
  trimTrailingEmptyFatebindings,
  persistFatebindingEditorRowFromDom,
} from "../fatebindingsSheet.js";
import { appendFatebindingsFinishingEditor } from "../fatebindingsFinishingEditor.js";
import { appendFinishingExtendedNotesPanel } from "../finishingExtendedNotesPanel.js";
import { appendSkillRatingsTableThead, skillIdsSplitForSkillsTables } from "../skillTableColumns.js";
import {
  isChargenWizardHiddenBirthrightRow,
  isChargenWizardHiddenEquipmentRow,
} from "../chargenWizardCatalogFilters.js";

/** Fatebinding list + editor index (shared with main wizard `character.finishing`). */
function ensureDragonSheetFatebindingsShape(character) {
  character.finishing ||= {};
  character.fatebindings = coerceFatebindingsStoredList(character.fatebindings);
  const fi = character.finishing;
  const n = character.fatebindings.length;
  if (typeof fi.fatebindingEditorIndex !== "number" || Number.isNaN(fi.fatebindingEditorIndex)) fi.fatebindingEditorIndex = 0;
  else fi.fatebindingEditorIndex = Math.max(0, Math.round(fi.fatebindingEditorIndex));
  if (n === 0) fi.fatebindingEditorIndex = 0;
  else if (fi.fatebindingEditorIndex >= n) fi.fatebindingEditorIndex = n - 1;
}

/** Dragon wizard Review step: mirror main Review tab (sheet vs JSON). */
let dragonReviewViewMode = "sheet";

const ARENAS = {
  Physical: ["might", "dexterity", "stamina"],
  Mental: ["intellect", "cunning", "resolve"],
  Social: ["presence", "manipulation", "composure"],
};
const APPROACH_ATTRS = {
  Force: ["might", "intellect", "presence"],
  Finesse: ["dexterity", "cunning", "manipulation"],
  Resilience: ["stamina", "resolve", "composure"],
};
const ARENA_ORDER = ["Physical", "Mental", "Social"];

const ARENAS_SORTED = [...ARENA_ORDER].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
const FAVORED_APPROACHES_SORTED = ["Force", "Finesse", "Resilience"].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base" }),
);

/** @param {string} attrId */
function arenaForAttribute(attrId) {
  for (const arena of ARENA_ORDER) {
    if (ARENAS[arena].includes(attrId)) return arena;
  }
  return null;
}

/** @param {Record<string, unknown>} d */
function dragonArenaPools(d) {
  const r = d.arenaRank || [];
  const [a1, a2, a3] = r;
  return { [a1]: 6, [a2]: 4, [a3]: 2 };
}

/** Match primary / secondary / tertiary arena selects on the Attributes step. */
function dragonArenaRankForDisplay(d) {
  const r = d?.arenaRank;
  if (Array.isArray(r) && r.length === 3 && new Set(r).size === 3 && r.every((a) => a && ARENAS[a])) {
    return r;
  }
  return [...ARENA_ORDER];
}

/** Pre–Favored finishing bumps in one named arena (vs Attributes-step snapshot). */
function dragonFinishingArenaExtraDelta(attrs, baseline, arena) {
  if (!baseline || typeof baseline !== "object") return 0;
  let o = 0;
  for (const id of ARENAS[arena]) {
    o += Math.max(0, (attrs[id] ?? 1) - (baseline[id] ?? 1));
  }
  return o;
}

function dragonAttributesStepPreFavoredForTab(d, bundle) {
  const b = d.finishingAttrBaseline;
  if (b && typeof b === "object") {
    const o = {};
    for (const id of Object.keys(bundle.attributes || {})) {
      if (String(id).startsWith("_")) continue;
      const v = Math.round(Number(b[id]));
      o[id] = Number.isFinite(v) ? Math.max(1, Math.min(5, v)) : (d.attributes[id] ?? 1);
    }
    return o;
  }
  const o = {};
  for (const id of Object.keys(bundle.attributes || {})) {
    if (String(id).startsWith("_")) continue;
    o[id] = d.attributes[id] ?? 1;
  }
  return o;
}

function dragonSkillIdsMissingChargenSpecialties(d, bundle) {
  const out = [];
  for (const sid of skillIds(bundle)) {
    if ((d.skillDots[sid] || 0) < 3) continue;
    if (String(d.skillSpecialties?.[sid] || "").trim()) continue;
    out.push(sid);
  }
  return out;
}

function dragonSkillsMissingSpecialtyFinishingMessage(d, bundle) {
  const miss = dragonSkillIdsMissingChargenSpecialties(d, bundle);
  if (miss.length === 0) return null;
  const nm = bundle.skills?.[miss[0]]?.name || miss[0];
  if (miss.length === 1) {
    return `${nm} is at 3 or more dots — add a free chargen Specialty before leaving Finishing (Origin pp. 59–60, 97).`;
  }
  return `${miss.length} Skills are at 3 or more dots without a Specialty — add free chargen Specialties before leaving Finishing (Origin pp. 59–60, 97).`;
}

function dragonMaxAttrRatingForArena(attrId, attrs, d) {
  const arena = arenaForAttribute(attrId);
  if (!arena) return 5;
  const pool = dragonArenaPools(d)[arena];
  if (pool == null || Number.isNaN(Number(pool))) return 5;
  const baseline = d.finishingAttrBaseline && typeof d.finishingAttrBaseline === "object" ? d.finishingAttrBaseline : null;
  const finD = baseline ? dragonFinishingArenaExtraDelta(d.attributes, baseline, arena) : 0;
  let others = 0;
  for (const oid of ARENAS[arena]) {
    if (oid === attrId) continue;
    others += Math.max(0, (attrs[oid] ?? 1) - 1);
  }
  return Math.max(1, Math.min(5, 1 + pool + finD - others));
}

function dragonMaxFinalRatingForAttr(attrId, attrsPre, d) {
  const preMax = dragonMaxAttrRatingForArena(attrId, attrsPre, d);
  const fav = d.favoredApproach;
  const key = APPROACH_ATTRS[fav] ? fav : "Finesse";
  if (APPROACH_ATTRS[key].includes(attrId)) return Math.min(5, preMax + 2);
  return preMax;
}

/**
 * Minimum pre–Favored rating while trimming Dragon arenas; do not drop below the Attributes-step snapshot
 * when a Finishing Attribute dot is invested (mirrors `attrMinWhileNormalizingPools` in `app.js`).
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 * @param {string} attrId
 */
function dragonAttrMinWhileNormalizingPools(d, bundle, attrId) {
  if (dragonFinishingAttrDotsPlaced(d, bundle) <= 0) return 1;
  const b = d.finishingAttrBaseline;
  if (!b || typeof b !== "object") return 1;
  const v = Math.round(Number(b[attrId]));
  if (Number.isNaN(v)) return 1;
  return Math.max(1, Math.min(5, v));
}

/**
 * Trim pre–Favored attributes if an arena exceeds its 6/4/2 bucket (e.g. after priority change).
 * Honors the Finishing +1 Attribute dot vs `finishingAttrBaseline` (same flex as Origin p. 98 in `app.js`).
 * @param {Record<string, unknown>} d
 * @param {Record<string, unknown>} bundle
 */
function normalizeDragonAttributesToPools(d, bundle) {
  const attrs = d.attributes;
  const baseline = d.finishingAttrBaseline && typeof d.finishingAttrBaseline === "object" ? d.finishingAttrBaseline : null;
  for (const id of Object.keys(bundle.attributes || {})) {
    if (id.startsWith("_")) continue;
    if (attrs[id] == null || attrs[id] < 1) attrs[id] = 1;
    if (attrs[id] > 5) attrs[id] = 5;
  }
  for (const arena of ARENA_ORDER) {
    const pool = dragonArenaPools(d)[arena];
    if (pool == null || Number.isNaN(Number(pool))) continue;
    const ids = ARENAS[arena];
    let sum = ids.reduce((s, id) => s + Math.max(0, (attrs[id] ?? 1) - 1), 0);
    while (true) {
      const cap = pool + (baseline ? dragonFinishingArenaExtraDelta(attrs, baseline, arena) : 0);
      if (sum <= cap) break;
      let hi = null;
      for (const id of ids) {
        const v = attrs[id] ?? 1;
        const floor = dragonAttrMinWhileNormalizingPools(d, bundle, id);
        if (v > floor) {
          if (hi === null || v > (attrs[hi] ?? 1)) hi = id;
        }
      }
      if (hi === null) {
        hi = ids[0];
        for (const id of ids) {
          if ((attrs[id] ?? 1) > (attrs[hi] ?? 1)) hi = id;
        }
        if ((attrs[hi] ?? 1) <= 1) break;
        attrs[hi] -= 1;
        sum -= 1;
        continue;
      }
      attrs[hi] -= 1;
      sum -= 1;
    }
  }
}

/**
 * Dot row for final (post–Favored) display; same behavior as main `renderFinalAttrDotRow` (app.js).
 * @param {number | null} [lockedFinalThrough]
 * @param {boolean} [readOnly]
 */
function dragonRenderFinalAttrDotRow(
  label,
  finalValue,
  maxFinal,
  onPickFinal,
  attrMeta,
  minFinal = 1,
  ariaSuffix = "(after Favored Approach)",
  lockedFinalThrough = null,
  readOnly = false,
) {
  const row = document.createElement("div");
  row.className = "dot-row" + (readOnly ? " dot-row--readonly" : "");
  if (attrMeta) applyGameDataHint(row, attrMeta);
  const lab = document.createElement("div");
  lab.className = "label";
  lab.textContent = label;
  const dots = document.createElement("div");
  dots.className = "dots";
  const shown = Math.min(finalValue, maxFinal);
  const lockedCut =
    lockedFinalThrough != null ? Math.min(Math.max(0, lockedFinalThrough), shown) : null;
  for (let i = 1; i <= 5; i += 1) {
    const b = document.createElement("button");
    b.type = "button";
    const allowed = !readOnly && i >= minFinal && i <= maxFinal;
    b.disabled = !allowed;
    let cls = "dot" + (i <= shown ? " filled" : "") + (allowed ? "" : " dot-capped");
    if (lockedCut != null && i <= shown && i <= lockedCut) cls += " dot-finishing-locked-fill";
    b.className = cls;
    b.setAttribute("aria-label", `${label} ${i} of 5${ariaSuffix ? ` ${ariaSuffix}` : ""}`);
    if (allowed) {
      b.addEventListener("click", () => onPickFinal(i));
    }
    dots.appendChild(b);
  }
  row.appendChild(lab);
  row.appendChild(dots);
  return row;
}

/** Same cap logic as Hero `rebalanceHeroCallingSlotDotsOverFive` (app.js): trim from row 3→1 until sum ≤ 5. */
function rebalanceDragonCallingSlotDotsOverFive(d) {
  const s = d.callingSlots;
  if (!Array.isArray(s) || s.length !== 3) return;
  for (let guard = 0; guard < 12; guard += 1) {
    const sum = s[0].dots + s[1].dots + s[2].dots;
    if (sum <= 5) break;
    for (let idx = 2; idx >= 0 && s[0].dots + s[1].dots + s[2].dots > 5; idx -= 1) {
      if (s[idx].dots > 1) s[idx].dots -= 1;
    }
  }
}

const PATH_KEYS = ["origin", "role", "flight"];

/** Keep in sync with `DRAGON_INHERITANCE_MAX` in app.js and `data/dragonTier.json`. */
const DRAGON_INHERITANCE_MAX = 10;

/**
 * Post-concept Dragon Heir steps (tab ids match the unified main wizard nav).
 * Paths body: app `renderPaths` (Flight + phrases). Skills+: `renderDragonHeirStepInRoot` (Skills via `renderSkills` in app).
 * Same ids as Origin Mortal `tier.json` where possible (`calling` singular); Dragon inserts `magic` and `birthrights` before Finishing.
 */
export const DRAGON_HEIR_POST_CONCEPT_STEPS = ["paths", "skills", "attributes", "calling", "magic", "birthrights", "finishing", "review"];
/** Steps rendered inside `renderDragonHeirStepInRoot` (everything after Paths). */
export const DRAGON_HEIR_SUBMODULE_STEPS = ["skills", "attributes", "calling", "magic", "birthrights", "finishing", "review"];
const STEPS = DRAGON_HEIR_POST_CONCEPT_STEPS;

/**
 * Hatchling (Inheritance 1) uses the Finishing tab (Dragon p. 112); Asset+ omits it — same spine as Hero+ without Origin Finishing.
 * @param {Record<string, unknown>} character
 * @returns {string[]}
 */
export function dragonHeirPostConceptStepList(character) {
  const lineage = String(character?.chargenLineage ?? "").trim().toLowerCase();
  if (lineage !== "dragonheir" && lineage !== "dragon_heir") return [...DRAGON_HEIR_POST_CONCEPT_STEPS];
  const inh = Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(character?.dragon?.inheritance) || 1)));
  if (inh <= 1) return [...DRAGON_HEIR_POST_CONCEPT_STEPS];
  return DRAGON_HEIR_POST_CONCEPT_STEPS.filter((s) => s !== "finishing");
}

/**
 * Calling ids that have at least one Dragon Heir Calling Knack row (`bundle.dragonCallingKnacks`).
 * Scion: Dragon’s Calling Knacks chapter uses eleven archetypes (mapped in that JSON); there is no Lover/Warrior list there.
 * @param {Record<string, unknown>} bundle
 * @returns {Set<string>}
 */
function dragonHeirCallingIdsWithKnackCatalog(bundle) {
  const out = new Set();
  const dck = bundle?.dragonCallingKnacks;
  if (!dck || typeof dck !== "object") return out;
  for (const [kid, row] of Object.entries(dck)) {
    if (kid.startsWith("_") || !row || typeof row !== "object") continue;
    const arr = row.callings;
    if (!Array.isArray(arr)) continue;
    for (const c of arr) {
      const s = String(c ?? "").trim();
      if (s && !s.startsWith("_")) out.add(s);
    }
  }
  return out;
}

/**
 * Cumulative wizard budgets from `dragonTier.json` (milestone +Spell / +Draconic Knack paraphrases).
 * @param {Record<string, unknown>} bundle
 * @param {number} inh
 */
function dragonInheritanceWizardCaps(bundle, inh) {
  const n = Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(inh) || 1)));
  const row = bundle?.dragonTier?.inheritanceTrack?.[String(n)];
  const knRaw = row?.wizardDraconicKnackLimit;
  const spRaw = row?.wizardAdvancementSpellSlots;
  const draconicKnackLimit = Number.isFinite(Number(knRaw)) ? Math.max(1, Math.round(Number(knRaw))) : 2;
  const advancementSpellSlots = Number.isFinite(Number(spRaw)) ? Math.max(0, Math.round(Number(spRaw))) : 0;
  return { draconicKnackLimit, advancementSpellSlots };
}

/**
 * After advancing Inheritance on Review, jump the main wizard to the first tab that gains wizard-tracked unlocks
 * (extra Draconic Knack slots → Calling; extra milestone spell rows → Magic). Order follows `dragonHeirPostConceptStepList`.
 * @param {Record<string, unknown>} bundle
 * @param {Record<string, unknown>} character
 * @param {number} prevInh
 * @param {number} nextInh
 * @returns {string}
 */
export function firstDragonHeirStepAfterInheritanceAdvance(bundle, character, prevInh, nextInh) {
  const prevC = dragonInheritanceWizardCaps(bundle, prevInh);
  const nextC = dragonInheritanceWizardCaps(bundle, nextInh);
  const dKn = nextC.draconicKnackLimit - prevC.draconicKnackLimit;
  const dSpell = nextC.advancementSpellSlots - prevC.advancementSpellSlots;
  const inhN = Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(nextInh) || 1)));
  const charProbe = {
    ...character,
    dragon: { ...(character.dragon && typeof character.dragon === "object" ? character.dragon : {}), inheritance: inhN },
  };
  const steps = dragonHeirPostConceptStepList(charProbe);
  for (const sid of steps) {
    if (sid === "calling" && dKn > 0) return "calling";
    if (sid === "magic" && dSpell > 0) return "magic";
  }
  if (dKn === 0 && dSpell === 0) {
    const ri = steps.indexOf("review");
    if (ri >= 0) return "review";
  }
  return steps[0] || "paths";
}

/**
 * Dragon Heir birthright picker: `chargenLines` includes `dragonHeir` (merged from `birthrightsDragon.json`).
 * Generic “(blank template)” rows from the core library are omitted here like the deity/titan wizard.
 * @param {Record<string, unknown>} bundle
 * @returns {Record<string, unknown>}
 */
function birthrightsForDragonChargen(bundle) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [bid, b] of Object.entries(bundle.birthrights || {})) {
    if (bid.startsWith("_") || !b || typeof b !== "object") continue;
    if (isChargenWizardHiddenBirthrightRow(b, bid)) continue;
    const lines = /** @type {{ chargenLines?: unknown }} */ (b).chargenLines;
    if (Array.isArray(lines) && lines.includes("dragonHeir")) out[bid] = b;
  }
  return out;
}

/**
 * Hatchling (Inheritance 1): arena / approach / Attribute dots editable; Asset+ locked until a future tier-raise UI exists.
 * @param {Record<string, unknown>} character
 */
export function dragonHeirAttributesCoreLayoutLocked(character) {
  if (!isDragonHeirChargen(character)) return false;
  const inh = Math.max(1, Math.round(Number(character?.dragon?.inheritance) || 1));
  return inh > 1;
}

export function isDragonHeirChargen(character) {
  const x = String(character?.chargenLineage ?? "").trim().toLowerCase();
  return x === "dragonheir" || x === "dragon_heir";
}

export function defaultDragonState() {
  const attrs = {};
  for (const a of ["might", "dexterity", "stamina", "intellect", "cunning", "resolve", "presence", "manipulation", "composure"]) {
    attrs[a] = 1;
  }
  return {
    stepIndex: 0,
    flightId: "",
    paths: { origin: "", role: "", flight: "" },
    pathRank: { primary: "role", secondary: "flight", tertiary: "origin" },
    pathSkills: { origin: [], role: [], flight: [] },
    pathSkillRedistribution: {},
    pathSkillRedistSourceHash: null,
    skillDots: {},
    finishingSkillBonus: {},
    skillSpecialties: {},
    attributes: attrs,
    finishingAttrBaseline: null,
    arenaRank: ["Mental", "Social", "Physical"],
    favoredApproach: "Finesse",
    callingSlots: [
      { id: "", dots: 2 },
      { id: "", dots: 2 },
      { id: "", dots: 1 },
    ],
    knackSlotById: {},
    callingKnackIds: [],
    draconicKnackIds: [],
    knownMagics: ["", "", ""],
    spellsByMagicId: {},
    bonusSpell: { magicId: "", spellId: "" },
    advancementSpells: [],
    birthrightPicks: [],
    finishingFocus: "knacks",
    finishingCallingKnackIds: [],
    finishingBirthrightPicks: [],
    inheritance: 1,
    deedName: "",
    remembranceTrackCenter: true,
    /** Legacy field; wizard treats Dragon like Deity Mortal (all tabs usable anytime). Kept for JSON import. */
    pastConcept: true,
    dragonWizardVersion: 2,
  };
}

/**
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 */
export function ensureDragonShape(character, bundle) {
  if (!isDragonHeirChargen(character)) return;
  if (!character.dragon || typeof character.dragon !== "object") character.dragon = defaultDragonState();
  const d = character.dragon;
  if (!d.paths || typeof d.paths !== "object") d.paths = { origin: "", role: "", flight: "" };
  if (!d.pathRank || typeof d.pathRank !== "object") d.pathRank = { primary: "role", secondary: "flight", tertiary: "origin" };
  for (const rk of ["primary", "secondary", "tertiary"]) {
    const v = String(d.pathRank[rk] ?? "").trim();
    d.pathRank[rk] = PATH_KEYS.includes(v) ? v : "origin";
  }
  if (!d.pathSkills || typeof d.pathSkills !== "object") d.pathSkills = { origin: [], role: [], flight: [] };
  for (const k of PATH_KEYS) {
    if (!Array.isArray(d.pathSkills[k])) d.pathSkills[k] = [];
  }
  if (!d.pathSkillRedistribution || typeof d.pathSkillRedistribution !== "object") d.pathSkillRedistribution = {};
  if (d.pathSkillRedistSourceHash === undefined) d.pathSkillRedistSourceHash = null;
  if (!d.skillDots || typeof d.skillDots !== "object") d.skillDots = {};
  if (!d.finishingSkillBonus || typeof d.finishingSkillBonus !== "object") d.finishingSkillBonus = {};
  if (!d.skillSpecialties || typeof d.skillSpecialties !== "object") d.skillSpecialties = {};
  if (!d.attributes || typeof d.attributes !== "object") {
    d.attributes = {};
    for (const a of Object.keys(bundle?.attributes || {})) {
      if (!a.startsWith("_")) d.attributes[a] = 1;
    }
  }
  if (!Array.isArray(d.arenaRank) || d.arenaRank.length !== 3) d.arenaRank = ["Mental", "Social", "Physical"];
  if (!d.favoredApproach) d.favoredApproach = "Finesse";
  if (!Array.isArray(d.callingSlots) || d.callingSlots.length !== 3) {
    d.callingSlots = [
      { id: "", dots: 2 },
      { id: "", dots: 2 },
      { id: "", dots: 1 },
    ];
  }
  d.callingSlots = d.callingSlots.map((s) => ({
    id: String(s?.id ?? "").trim(),
    dots: Math.max(1, Math.min(5, Math.round(Number(s?.dots) || 1))),
  }));
  const dragonCallingIds = dragonHeirCallingIdsWithKnackCatalog(bundle);
  if (dragonCallingIds.size > 0) {
    for (const slot of d.callingSlots) {
      if (slot.id && !dragonCallingIds.has(slot.id)) slot.id = "";
    }
  }
  if (!d.knackSlotById || typeof d.knackSlotById !== "object") d.knackSlotById = {};
  if (!Array.isArray(d.callingKnackIds)) d.callingKnackIds = [];
  if (!Array.isArray(d.draconicKnackIds)) d.draconicKnackIds = [];
  if (!Array.isArray(d.knownMagics)) d.knownMagics = ["", "", ""];
  while (d.knownMagics.length < 3) d.knownMagics.push("");
  d.knownMagics = d.knownMagics.slice(0, 3).map((x) => String(x ?? "").trim());
  const fidForSig = String(d.flightId || "").trim();
  const flSig = bundle?.dragonFlights?.[fidForSig];
  if (flSig?.signatureMagicId && Array.isArray(d.knownMagics)) {
    const canon = String(flSig.signatureMagicId);
    const prev0 = d.knownMagics[0];
    d.knownMagics[0] = canon;
    if (prev0 && prev0 !== canon && d.spellsByMagicId && typeof d.spellsByMagicId === "object") {
      delete d.spellsByMagicId[prev0];
    }
  }
  sanitizeDragonSecondaryKnownMagics(d, bundle);
  if (!d.spellsByMagicId || typeof d.spellsByMagicId !== "object") d.spellsByMagicId = {};
  if (!d.bonusSpell || typeof d.bonusSpell !== "object") d.bonusSpell = { magicId: "", spellId: "" };
  if (!Array.isArray(d.birthrightPicks)) d.birthrightPicks = [];
  d.birthrightPicks = d.birthrightPicks
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      id: String(p.id ?? "").trim(),
      dots: Math.max(1, Math.min(5, Math.round(Number(p.dots) || 1))),
    }))
    .filter((p) => p.id);
  if (!d.finishingFocus) d.finishingFocus = "knacks";
  if (!Array.isArray(d.finishingCallingKnackIds)) d.finishingCallingKnackIds = [];
  if (!Array.isArray(d.finishingBirthrightPicks)) d.finishingBirthrightPicks = [];
  d.finishingBirthrightPicks = d.finishingBirthrightPicks
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      id: String(p.id ?? "").trim(),
      dots: Math.max(1, Math.min(5, Math.round(Number(p.dots) || 1))),
    }))
    .filter((p) => p.id);
  if (d.inheritance == null || Number.isNaN(Number(d.inheritance))) d.inheritance = 1;
  d.inheritance = Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(d.inheritance) || 1)));
  if (d.inheritance > 1) {
    d.finishingSkillBonus = {};
    d.finishingAttrBaseline = null;
    d.finishingCallingKnackIds = [];
    d.finishingBirthrightPicks = [];
  }
  const inhCaps = dragonInheritanceWizardCaps(bundle, d.inheritance);
  if (!Array.isArray(d.advancementSpells)) d.advancementSpells = [];
  while (d.advancementSpells.length < inhCaps.advancementSpellSlots) {
    d.advancementSpells.push({ magicId: "", spellId: "" });
  }
  while (d.advancementSpells.length > inhCaps.advancementSpellSlots) {
    d.advancementSpells.pop();
  }
  d.advancementSpells = d.advancementSpells.map((row) => ({
    magicId: String(row?.magicId ?? "").trim(),
    spellId: String(row?.spellId ?? "").trim(),
  }));
  const magicIdsKnownForAdv = new Set([
    ...d.knownMagics.filter(Boolean),
    String(d.bonusSpell?.magicId || "").trim(),
  ].filter(Boolean));
  for (const row of d.advancementSpells) {
    if (row.magicId && !magicIdsKnownForAdv.has(row.magicId)) {
      row.magicId = "";
      row.spellId = "";
    }
    if (row.magicId && row.spellId) {
      const mag = bundle?.dragonMagic?.[row.magicId];
      const sid = String(row.spellId).trim();
      const ok =
        Array.isArray(mag?.spells) && mag.spells.some((s) => s && String(s.id ?? "").trim() === sid);
      if (!ok) row.spellId = "";
    }
  }
  if (d.draconicKnackIds.length > inhCaps.draconicKnackLimit) {
    d.draconicKnackIds = d.draconicKnackIds.slice(0, inhCaps.draconicKnackLimit);
  }
  if (d.deedName == null) d.deedName = "";
  d.remembranceTrackCenter = d.remembranceTrackCenter !== false;
  /** v2: dropped leading placeholder step (Welcome lives on main wizard). Legacy saves used stepIndex ≥ 1 for Paths+. */
  const rawStepBeforeMigrate = Math.round(Number(d.stepIndex) || 0);
  if (d.dragonWizardVersion !== 2) {
    if (d.dragonWizardVersion == null && rawStepBeforeMigrate > 0) d.stepIndex = rawStepBeforeMigrate - 1;
    d.dragonWizardVersion = 2;
  }
  if (!Number.isFinite(Number(d.stepIndex)) || d.stepIndex < 0) d.stepIndex = 0;
  const navSteps = dragonHeirPostConceptStepList(character);
  if (d.stepIndex >= navSteps.length) d.stepIndex = navSteps.length - 1;
  /** Wizard no longer gates on this (same tab behavior as Deity Mortal); normalize so exports stay consistent. */
  d.pastConcept = d.pastConcept === true || String(d.pastConcept ?? "").trim().toLowerCase() === "true";
  const dck = bundle?.dragonCallingKnacks;
  if (dck && typeof dck === "object") {
    const allowed = new Set(Object.keys(dck).filter((k) => !k.startsWith("_")));
    d.callingKnackIds = (d.callingKnackIds || []).filter((id) => allowed.has(String(id || "").trim()));
    d.finishingCallingKnackIds = (d.finishingCallingKnackIds || []).filter((id) => allowed.has(String(id || "").trim()));
    for (const key of Object.keys(d.knackSlotById || {})) {
      if (!allowed.has(key)) delete d.knackSlotById[key];
    }
    const shell = dragonKnackShell(character);
    syncHeroKnackSlotAssignments(shell, bundle);
    d.callingKnackIds = [...(shell.knackIds || [])];
    d.knackSlotById = { ...shell.knackSlotById };
  }
  syncDragonFlightPathRequiredSkills(d, bundle);
  ensureDragonSheetFatebindingsShape(character);
  /** Main Scion wizard stays on the Origin-style spine (`stepDefsForTier` forces mortal for Dragon); `character.tier` is the sheet / Storypath band (Welcome). */
}

function skillIds(bundle) {
  return Object.keys(bundle?.skills || {}).filter((k) => !k.startsWith("_"));
}

/** @param {Record<string, unknown> | undefined} G */
function dragonSumPathSkillRedistribution(G) {
  let s = 0;
  if (!G || typeof G !== "object") return 0;
  for (const v of Object.values(G)) {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n > 0) s += n;
  }
  return s;
}

/**
 * @param {Record<string, number>} trimmed
 * @param {number} lost
 * @param {Set<string>} union
 * @param {Record<string, unknown>} G0
 */
function dragonSanitizePathSkillRedistribution(trimmed, lost, union, G0) {
  const G = {};
  if (lost <= 0) return G;
  for (const sid of union) {
    const g0 = Math.max(0, Math.round(Number(G0[sid]) || 0));
    if (g0 <= 0) continue;
    const cap = Math.max(0, 5 - (trimmed[sid] || 0));
    if (cap <= 0) continue;
    G[sid] = Math.min(g0, cap);
  }
  let sumG = dragonSumPathSkillRedistribution(G);
  if (sumG > lost) {
    const order = [...union].sort();
    let excess = sumG - lost;
    for (const sid of order) {
      while (excess > 0 && (G[sid] || 0) > 0) {
        G[sid] -= 1;
        excess -= 1;
      }
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(G)) {
    if (v > 0) out[k] = v;
  }
  return out;
}

/**
 * Uncapped Path-only totals (3/2/1 cumulative). Same rule as `computeRawPathSkillDots` in app.js (Origin p. 97).
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 */
function dragonComputeRawPathSkillDots(d, bundle) {
  const dots = {};
  for (const id of skillIds(bundle)) dots[id] = 0;
  const rankToDots = { primary: 3, secondary: 2, tertiary: 1 };
  for (const rank of ["primary", "secondary", "tertiary"]) {
    const pathKey = d.pathRank[rank];
    const list = (d.pathSkills[pathKey] || []).filter((x) => typeof x === "string");
    const add = rankToDots[rank];
    for (const sid of list) {
      if (!Object.prototype.hasOwnProperty.call(dots, sid)) continue;
      dots[sid] += add;
    }
  }
  return dots;
}

/** Union of Skills listed on any of the three Paths (redistribution targets only). */
function dragonPathSkillUnionSet(d, bundle) {
  const u = new Set();
  for (const pk of PATH_KEYS) {
    for (const sid of d.pathSkills[pk] || []) {
      if (!sid || String(sid).startsWith("_")) continue;
      if (bundle?.skills?.[sid]) u.add(sid);
    }
  }
  return u;
}

/**
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 */
function dragonPathSkillTrimmedLostAndUnion(d, bundle) {
  const raw = dragonComputeRawPathSkillDots(d, bundle);
  const trimmed = {};
  let lost = 0;
  for (const sid of skillIds(bundle)) {
    const r = raw[sid] || 0;
    const ex = Math.max(0, r - 5);
    lost += ex;
    trimmed[sid] = r - ex;
  }
  return { raw, trimmed, lost, union: dragonPathSkillUnionSet(d, bundle) };
}

/** @param {DragonState} d */
function dragonPathLayoutHash(d) {
  return JSON.stringify({
    ranks: [d.pathRank.primary, d.pathRank.secondary, d.pathRank.tertiary],
    origin: [...(d.pathSkills.origin || [])],
    role: [...(d.pathSkills.role || [])],
    flight: [...(d.pathSkills.flight || [])],
  });
}

/**
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 */
function dragonPathSkillOverflowDotsPending(d, bundle) {
  const { lost } = dragonPathSkillTrimmedLostAndUnion(d, bundle);
  if (lost <= 0) return 0;
  return Math.max(0, lost - dragonSumPathSkillRedistribution(d.pathSkillRedistribution));
}

/**
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 * @param {string} sid
 * @param {1 | -1} delta
 */
function dragonBumpPathSkillRedistribution(d, bundle, sid, delta) {
  const { trimmed, lost, union } = dragonPathSkillTrimmedLostAndUnion(d, bundle);
  if (!union.has(sid)) return;
  const G = { ...(d.pathSkillRedistribution || {}) };
  const cur = G[sid] || 0;
  const placed = dragonSumPathSkillRedistribution(G);
  const pending = lost - placed;
  if (delta > 0) {
    if (pending <= 0) return;
    const cap = Math.max(0, 5 - (trimmed[sid] || 0) - cur);
    if (cap <= 0) return;
    G[sid] = cur + 1;
  } else {
    if (cur <= 0) return;
    if (G[sid] <= 1) delete G[sid];
    else G[sid] = cur - 1;
  }
  d.pathSkillRedistribution = G;
  applyDragonPathMathToSkillDots(d, bundle);
}

/**
 * Same layout as main wizard `appendSkillRatingNameCell`.
 * @param {{ skillsTableSpecialty?: boolean; specialtyReadOnly?: boolean }} [opts] If true, same compact specialty cell as Skills + Finishing in main wizard.
 */
function appendDragonSkillRatingNameCell(tr, sid, skillMeta, val, d, opts) {
  const skillsTable = opts?.skillsTableSpecialty === true;
  const specReadOnly = opts?.specialtyReadOnly === true;
  const nameTd = document.createElement("td");
  nameTd.className = "skill-ratings-col-name" + (skillsTable ? " skill-ratings-col-name--skills-step" : "");
  const nameRow = document.createElement("div");
  nameRow.className = "skill-ratings-name-row";
  const nameSpan = document.createElement("span");
  nameSpan.className = "skill-ratings-skill-label";
  nameSpan.textContent = skillMeta?.name || sid;
  applyGameDataHint(nameSpan, skillMeta);
  nameRow.appendChild(nameSpan);
  if (val >= 3) {
    const specWrap = document.createElement("div");
    specWrap.className =
      "field skill-specialty-field skill-specialty-inline" +
      (skillsTable ? " skill-specialty-inline--skills-table" : "");
    const specIn = document.createElement("input");
    specIn.type = "text";
    specIn.id = `d-skill-specialty-${sid}`;
    specIn.autocomplete = "off";
    if (skillsTable) {
      specIn.placeholder = "specialty";
      specIn.setAttribute("aria-label", `${skillMeta?.name || sid} specialty`);
      specIn.value = d.skillSpecialties[sid] || "";
      const ghostLab = document.createElement("label");
      ghostLab.htmlFor = `d-skill-specialty-${sid}`;
      ghostLab.className = "skill-specialty-sr-only";
      ghostLab.textContent = "Specialty";
      specWrap.appendChild(ghostLab);
      specWrap.appendChild(specIn);
      applySkillSpecialtyHints(ghostLab, specIn, sid);
    } else {
      const specLab = document.createElement("label");
      specLab.htmlFor = `d-skill-specialty-${sid}`;
      specLab.textContent = "Specialties";
      specIn.placeholder = "e.g. Greek Mythology, Parkour…";
      specIn.value = d.skillSpecialties[sid] || "";
      specWrap.appendChild(specLab);
      specWrap.appendChild(specIn);
      applySkillSpecialtyHints(specLab, specIn, sid);
    }
    if (specReadOnly) {
      specIn.readOnly = true;
      specIn.disabled = true;
    } else {
      const syncSpec = () => {
        const t = specIn.value.trim();
        if (t) d.skillSpecialties[sid] = specIn.value;
        else delete d.skillSpecialties[sid];
      };
      specIn.addEventListener("input", syncSpec);
      specIn.addEventListener("change", syncSpec);
    }
    nameRow.appendChild(specWrap);
  }
  nameTd.appendChild(nameRow);
  tr.appendChild(nameTd);
}

/** Read-only 0–5 dot row (same as main wizard `appendSkillRatingDotsCell` with mode `"skills"`). */
function appendDragonSkillRatingDotsCell(tr, sid, skillMeta, val) {
  const dotsTd = document.createElement("td");
  dotsTd.className = "skill-ratings-col-dots";
  const dotsWrap = document.createElement("div");
  dotsWrap.className = "skill-ratings-dots-wrap";
  const dots = document.createElement("div");
  dots.className = "dots";
  for (let i = 1; i <= 5; i += 1) {
    const sp = document.createElement("span");
    sp.className = "dot dot-unmodifiable" + (i <= val ? " filled" : "");
    sp.setAttribute("aria-hidden", "true");
    dots.appendChild(sp);
  }
  dotsWrap.appendChild(dots);
  dotsTd.appendChild(dotsWrap);
  tr.appendChild(dotsTd);
  applyGameDataHint(dotsTd, skillMeta);
}

/**
 * Read-only Path-derived Skill ratings — shown on the Skills step with Path picks (Dragon Heir).
 * @param {HTMLElement} parent
 * @param {Record<string, unknown>} d
 * @param {Record<string, unknown>} bundle
 * @param {boolean} [specialtyReadOnly]
 */
function appendDragonReadonlyPathSkillRatingsPanel(parent, d, bundle, specialtyReadOnly = false) {
  const pathOnly = applyDragonPathMathToSkillDots(d, bundle);
  const list = document.createElement("div");
  list.className = "panel skill-ratings-panel";
  const head = document.createElement("h2");
  head.textContent = "Skill ratings (0–5)";
  list.appendChild(head);
  const ratingsHelp = document.createElement("p");
  ratingsHelp.className = "help";
  ratingsHelp.textContent =
    "Ratings follow Path priority 3/2/1 (Dragon p. 111; Origin p. 97). If overlap would exceed 5 in a Skill, use this step’s redistribution controls below. At 3+ dots, add free Specialties (Origin pp. 59–60).";
  list.appendChild(ratingsHelp);
  const { left: dSkLeft, right: dSkRight } = skillIdsSplitForSkillsTables(bundle);
  const dSkTwoCol = document.createElement("div");
  dSkTwoCol.className = "skill-ratings-two-cols";

  function appendDragonReadonlySkillTable(skillIdList) {
    const tbl = document.createElement("table");
    tbl.className = "skill-ratings-table skill-ratings-table--path-readonly";
    appendSkillRatingsTableThead(tbl);
    const tb = document.createElement("tbody");
    for (const sid of skillIdList) {
      const sk = bundle.skills[sid];
      const displayVal = Math.max(0, Math.min(5, Math.round(Number(pathOnly[sid]) || 0)));
      const mergedVal = Math.max(0, Math.min(5, Math.round(Number(d.skillDots[sid]) || 0)));
      const specGate = Math.max(displayVal, mergedVal);
      const tr = document.createElement("tr");
      tr.className = "skill-rating-row";
      appendDragonSkillRatingNameCell(tr, sid, sk, specGate, d, {
        skillsTableSpecialty: true,
        specialtyReadOnly,
      });
      appendDragonSkillRatingDotsCell(tr, sid, sk, displayVal);
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    dSkTwoCol.appendChild(tbl);
  }
  appendDragonReadonlySkillTable(dSkLeft);
  appendDragonReadonlySkillTable(dSkRight);
  list.appendChild(dSkTwoCol);
  parent.appendChild(list);
}

/**
 * Finishing-step Skill dots (mirrors main `appendSkillRatingDotsCell` mode `"finishing"`).
 * @param {HTMLTableRowElement} tr
 * @param {string} sid
 * @param {Record<string, unknown> | undefined} skillMeta
 * @param {number} val
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 * @param {Record<string, unknown>} character
 * @param {Record<string, number>} pathOnly
 * @param {() => void} render
 */
function appendDragonFinishingSkillDotsCell(tr, sid, skillMeta, val, d, bundle, character, pathOnly, render) {
  const dotsTd = document.createElement("td");
  dotsTd.className = "skill-ratings-col-dots";
  const dotsWrap = document.createElement("div");
  dotsWrap.className = "skill-ratings-dots-wrap";
  const dots = document.createElement("div");
  dots.className = "dots";
  const minV = pathOnly[sid] ?? 0;
  const maxV = maxDragonSkillFinishingValue(sid, d, bundle, pathOnly);
  const disp = Math.min(val, maxV);
  for (let i = 1; i <= 5; i += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    const allowed = i >= minV && i <= maxV;
    btn.disabled = !allowed;
    const baselineLocked = i <= disp && i <= minV;
    btn.className =
      "dot" + (i <= disp ? " filled" : "") + (allowed ? "" : " dot-capped") + (baselineLocked ? " dot-finishing-locked-fill" : "");
    if (allowed) {
      btn.addEventListener("click", () => {
        ensureDragonShape(character, bundle);
        const next = i === val ? minV : i;
        const base = pathOnly[sid] || 0;
        if (!d.finishingSkillBonus || typeof d.finishingSkillBonus !== "object") d.finishingSkillBonus = {};
        d.finishingSkillBonus[sid] = Math.max(0, next - base);
        if (d.finishingSkillBonus[sid] <= 0) delete d.finishingSkillBonus[sid];
        applyDragonPathMathToSkillDots(d, bundle);
        render();
      });
    }
    dots.appendChild(btn);
  }
  dotsWrap.appendChild(dots);
  dotsTd.appendChild(dotsWrap);
  tr.appendChild(dotsTd);
  applyGameDataHint(dotsTd, skillMeta);
}

/** @param {Record<string, unknown>} eq @param {Record<string, unknown>} bundle */
function dragonEquipmentHaystack(eid, eq, bundle) {
  const tagNames = (Array.isArray(eq?.tagIds) ? eq.tagIds : [])
    .map((tid) => String(bundle.tags?.[tid]?.name || tid))
    .filter(Boolean)
    .join(" ");
  const desc = typeof eq?.description === "string" ? eq.description : "";
  const mech = typeof eq?.mechanicalEffects === "string" ? eq.mechanicalEffects : "";
  return `${eq?.name || ""} ${eid} ${eq?.equipmentType || ""} ${tagNames} ${desc} ${mech}`.trim().toLowerCase();
}

/** @param {Record<string, unknown>} eq @param {Record<string, unknown>} bundle */
function dragonEquipmentPickerDescriptionLine(eq, bundle) {
  const desc = typeof eq?.description === "string" ? eq.description.trim() : "";
  const tags = (Array.isArray(eq?.tagIds) ? eq.tagIds : [])
    .map((tid) => String(bundle.tags?.[tid]?.name || tid))
    .filter(Boolean);
  const tagStr = tags.join(", ");
  const typ = typeof eq?.equipmentType === "string" ? eq.equipmentType.trim() : "";
  if (desc && tagStr) return `${desc} — Tags: ${tagStr}`;
  if (desc) return desc;
  if (tagStr) return `Tags: ${tagStr}`;
  if (typ) return `Type: ${typ}`;
  return "—";
}

/**
 * Equipment, Fatebindings, and extended notes — each in its own Finishing panel (matches main `renderFinishing`).
 * @param {HTMLElement} wrap
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {() => void} render
 */
function appendDragonFinishingSheetAppendix(wrap, character, bundle, render) {
  if (!Array.isArray(character.sheetEquipmentIds)) character.sheetEquipmentIds = [];
  character.sheetEquipmentIds = character.sheetEquipmentIds.filter(
    (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
  );
  if (character.sheetNotesExtra == null) character.sheetNotesExtra = "";

  const equipmentPanel = document.createElement("section");
  equipmentPanel.className = "panel finishing-place-panel";
  equipmentPanel.innerHTML =
    "<h2>Equipment</h2><p class='help'>Choose gear from the library.</p>";
  const eqLayout = document.createElement("div");
  eqLayout.className = "equipment-picker-layout";
  const eqCat = document.createElement("div");
  eqCat.className = "equipment-picker-catalog";
  const eqBar = document.createElement("div");
  eqBar.className = "picker-toolbar";
  const eqSearch = document.createElement("input");
  eqSearch.type = "search";
  eqSearch.className = "picker-search";
  eqSearch.placeholder = "Filter by name, type, tags…";
  eqSearch.autocomplete = "off";
  eqSearch.setAttribute("aria-label", "Filter equipment");
  eqBar.appendChild(eqSearch);
  eqCat.appendChild(eqBar);
  const eqScroll = document.createElement("div");
  eqScroll.className = "picker-scroll";
  const eqTbl = document.createElement("table");
  eqTbl.className = "skill-ratings-table equipment-picker-table";
  const eqThead = document.createElement("thead");
  const eqHr = document.createElement("tr");
  ["Name", "Description & tags", "Type", ""].forEach((lab, idx) => {
    const th = document.createElement("th");
    th.textContent = lab;
    if (idx === 3) th.className = "equipment-picker-actions";
    if (idx === 1) th.className = "equipment-picker-desc-th";
    eqHr.appendChild(th);
  });
  eqThead.appendChild(eqHr);
  eqTbl.appendChild(eqThead);
  const eqBody = document.createElement("tbody");
  const eqSet = new Set(character.sheetEquipmentIds || []);
  const eqEntries = Object.entries(bundle.equipment || {})
    .filter(([eid, eq]) => !eid.startsWith("_") && !isChargenWizardHiddenEquipmentRow(eq, eid))
    .sort((a, b) => String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0])));
  for (const [eid, eq] of eqEntries) {
    const tr = document.createElement("tr");
    tr.setAttribute("data-filter-text", dragonEquipmentHaystack(eid, eq, bundle));
    const nm = document.createElement("td");
    nm.textContent = /** @type {{ name?: string }} */ (eq).name || eid;
    const descTd = document.createElement("td");
    descTd.className = "equipment-picker-desc";
    descTd.textContent = dragonEquipmentPickerDescriptionLine(eq, bundle);
    const typ = document.createElement("td");
    typ.textContent = /** @type {{ equipmentType?: string }} */ (eq).equipmentType || "—";
    typ.className = "muted";
    const act = document.createElement("td");
    act.className = "equipment-picker-actions";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn secondary";
    addBtn.textContent = "Add";
    addBtn.disabled = eqSet.has(eid);
    if (addBtn.disabled) addBtn.title = "Already on your sheet — use Remove at right.";
    applyGameDataHint(addBtn, eq);
    addBtn.addEventListener("click", () => {
      if (eqSet.has(eid)) return;
      eqSet.add(eid);
      character.sheetEquipmentIds = [...eqSet];
      render();
    });
    act.appendChild(addBtn);
    tr.appendChild(nm);
    tr.appendChild(descTd);
    tr.appendChild(typ);
    tr.appendChild(act);
    eqBody.appendChild(tr);
  }
  eqTbl.appendChild(eqBody);
  wirePickerRowFilter(eqSearch, eqBody);
  wireSortableTableColumns(eqThead, eqBody, [
    { get: (tr2) => (tr2.cells[0]?.textContent || "").trim() },
    { get: (tr2) => (tr2.cells[1]?.textContent || "").trim() },
    { get: (tr2) => (tr2.cells[2]?.textContent || "").trim() },
    null,
  ]);
  eqScroll.appendChild(eqTbl);
  eqCat.appendChild(eqScroll);
  eqLayout.appendChild(eqCat);
  const eqSel = document.createElement("div");
  eqSel.className = "equipment-picker-selected";
  const selH = document.createElement("h3");
  selH.className = "equipment-picker-selected-heading";
  selH.textContent = "On your sheet";
  eqSel.appendChild(selH);
  const orderedIds = [...eqSet].sort((a, b) =>
    String(bundle.equipment?.[a]?.name || a).localeCompare(String(bundle.equipment?.[b]?.name || b), undefined, {
      sensitivity: "base",
    }),
  );
  if (orderedIds.length === 0) {
    const emptyEq = document.createElement("p");
    emptyEq.className = "help equipment-picker-empty";
    emptyEq.textContent = "No equipment yet — add from the catalog.";
    eqSel.appendChild(emptyEq);
  } else {
    const selList = document.createElement("ul");
    selList.className = "equipment-picker-selected-list";
    for (const eid of orderedIds) {
      const eq = bundle.equipment?.[eid];
      const li = document.createElement("li");
      const lab = document.createElement("span");
      lab.textContent = /** @type {{ name?: string }} */ (eq)?.name || eid;
      applyGameDataHint(lab, eq);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn secondary";
      rm.textContent = "Remove";
      rm.addEventListener("click", () => {
        const s2 = new Set(character.sheetEquipmentIds || []);
        s2.delete(eid);
        character.sheetEquipmentIds = [...s2];
        render();
      });
      li.appendChild(lab);
      li.appendChild(rm);
      selList.appendChild(li);
    }
    eqSel.appendChild(selList);
  }
  eqLayout.appendChild(eqSel);
  equipmentPanel.appendChild(eqLayout);
  wrap.appendChild(equipmentPanel);

  const fatebindingsPanel = document.createElement("section");
  fatebindingsPanel.className = "panel finishing-place-panel";
  appendFatebindingsFinishingEditor(fatebindingsPanel, character, {
    idPrefix: "d-fin-fb",
    render,
    prepareState: () => ensureDragonSheetFatebindingsShape(character),
    trackHint: "Dragon Heir: Fatebindings print on the Heir review sheet (Fatebinding section).",
  });
  wrap.appendChild(fatebindingsPanel);

  const extendedNotesPanel = document.createElement("section");
  extendedNotesPanel.className = "panel finishing-place-panel";
  appendFinishingExtendedNotesPanel(extendedNotesPanel, character, { textareaId: "d-fin-sheet-notes" });
  wrap.appendChild(extendedNotesPanel);
}

/**
 * Clickable 1–5 dot strip; dots above `maxDots` are disabled (Calling row pattern).
 * @param {HTMLElement} parent
 * @param {number} dotsValue
 * @param {number} maxDots
 * @param {string} ariaLabel
 * @param {(n: number) => void} onPick
 */
function appendDragonBirthrightDotStripCapped(parent, dotsValue, maxDots, ariaLabel, onPick) {
  const cap = Math.max(1, Math.min(5, Math.round(Number(maxDots) || 5)));
  const dotsWrapH = document.createElement("div");
  dotsWrapH.className = "dots calling-inline-dots";
  dotsWrapH.style.flex = "0 0 auto";
  dotsWrapH.setAttribute("role", "radiogroup");
  const v = Math.max(1, Math.min(cap, Math.round(Number(dotsValue) || 1)));
  dotsWrapH.setAttribute("aria-label", ariaLabel);
  for (let dotN = 1; dotN <= 5; dotN += 1) {
    const b = document.createElement("button");
    b.type = "button";
    const canPick = dotN <= cap;
    b.disabled = !canPick;
    b.className = "dot" + (dotN <= v ? " filled" : "") + (b.disabled ? " dot-capped" : "");
    b.setAttribute("aria-label", `${dotN} of 5`);
    if (canPick) {
      b.addEventListener("click", () => {
        onPick(dotN);
      });
    }
    dotsWrapH.appendChild(b);
  }
  parent.appendChild(dotsWrapH);
}

/** Clickable 1–5 dot strip (no cap beyond 5). */
function appendDragonBirthrightDotStrip(parent, dotsValue, ariaLabel, onPick) {
  appendDragonBirthrightDotStripCapped(parent, dotsValue, 5, ariaLabel, onPick);
}

/** @param {Record<string, unknown>} bundle @param {string} bid */
function dragonTablePointCost(bundle, bid) {
  const br = bundle.birthrights?.[bid];
  return Math.max(1, Math.min(5, Math.round(Number(/** @type {{ pointCost?: unknown }} */ (br)?.pointCost) || 1)));
}

/** @param {{ id?: string; dots?: number }[]} picks */
function dragonBirthrightsDotsPlaced(picks) {
  return picks.reduce((s, p) => {
    if (!String(p?.id || "").trim()) return s;
    return s + Math.max(1, Math.min(5, Math.round(Number(p.dots) || 1)));
  }, 0);
}

/** @param {{ id?: string; dots?: number }[]} picks */
function dragonBirthrightsOtherDotsSum(picks, skipIdx) {
  return picks.reduce((s, p, i) => {
    if (i === skipIdx) return s;
    if (!String(p?.id || "").trim()) return s;
    return s + Math.max(1, Math.min(5, Math.round(Number(p.dots) || 1)));
  }, 0);
}

/** @param {{ id?: string; dots?: number }[]} picks */
function dragonMaxDotsForPick(picks, cap, idx) {
  if (!String(picks[idx]?.id || "").trim()) return 1;
  const others = dragonBirthrightsOtherDotsSum(picks, idx);
  return Math.max(1, Math.min(5, cap - others));
}

/** @param {Record<string, unknown>} br @param {Record<string, unknown>} bundle */
function dragonBirthrightCatalogSummaryLine(br, bundle) {
  const desc = typeof br?.description === "string" ? br.description.trim() : "";
  const tagStr = birthrightTagLabels(br, bundle).join(", ");
  const typ = typeof br?.birthrightType === "string" ? br.birthrightType.trim() : "";
  const mech = typeof br?.mechanicalEffects === "string" ? br.mechanicalEffects.trim() : "";
  const parts = [];
  if (desc) parts.push(desc);
  if (tagStr) parts.push(`Tags: ${tagStr}`);
  if (typ) parts.push(`Type: ${typ}`);
  if (mech) parts.push(`Mechanical: ${mech}`);
  if (!parts.length) return "—";
  return parts.join(" · ");
}

/**
 * Deity-style Birthrights UI: PB meta panels, sortable catalog, picks list with dot tuning.
 * @param {HTMLElement} wrap
 * @param {Record<string, unknown>} bundle
 * @param {Record<string, unknown>} character
 * @param {"birthrightPicks" | "finishingBirthrightPicks"} picksKey
 * @param {number} cap
 * @param {() => void} render
 * @param {{ compact?: boolean }} [opts] If `compact`, skip shared PB intro/types (Finishing bonus reuses the same catalog only).
 */
function appendDragonHeirBirthrightDeityStyleBlock(wrap, bundle, character, picksKey, cap, render, opts = {}) {
  const compact = opts.compact === true;
  const d = /** @type {DragonState} */ (character.dragon);
  const picks = /** @type {{ id?: string; dots?: number }[]} */ (d[picksKey]);
  for (let i = 0; i < picks.length; i += 1) {
    const mx = dragonMaxDotsForPick(picks, cap, i);
    const v = Math.max(1, Math.min(mx, Math.round(Number(picks[i].dots) || 1)));
    if (picks[i].dots !== v) picks[i].dots = v;
  }

  const meta = bundle.birthrights?._meta || {};
  if (!compact) {
    const p = document.createElement("p");
    p.className = "help";
    p.innerHTML =
      "Dragon Heirs use the same <strong>Birthright categories</strong> as Pandora’s Box—Relics, Guides, Followers, Cults, Creatures, and so on—for hoard, lair, flight, and cult fiction (<cite>Scion: Dragon</cite> pp. 42–93, 112). This step spends <strong>seven Birthright dots</strong> at chargen (Dragon p. 112), not the deity/titan Visitation Hero pool.";
    wrap.appendChild(p);
    const p2 = document.createElement("p");
    p2.className = "help";
    p2.innerHTML =
      "<strong>Point cost</strong> on each row is the template’s chargen cost; <strong>Add</strong> only lets you take a row if your placed dots plus that cost stay at or under seven. Later, <strong>Finishing</strong> applies separate bonuses on this wizard—including either <strong>+4 Birthright dots</strong> <em>or</em> <strong>+2 Calling Knacks</strong> (Dragon p. 112), not the Mortal-only / Hero Finishing text from the core <code>birthrights.json</code> blurb.";
    wrap.appendChild(p2);
  }
  if (!compact && Array.isArray(meta.typesTable) && meta.typesTable.length > 0) {
    const sec = document.createElement("section");
    sec.className = "panel birthrights-types-panel";
    const h = document.createElement("h2");
    h.textContent = "Birthright types (overview)";
    sec.appendChild(h);
    const tbl = document.createElement("table");
    tbl.className = "skill-ratings-table birthrights-table";
    const thead = document.createElement("thead");
    const thr = document.createElement("tr");
    ["Type", "What it is", "Typical dots"].forEach((lab) => {
      const th = document.createElement("th");
      th.textContent = lab;
      thr.appendChild(th);
    });
    thead.appendChild(thr);
    tbl.appendChild(thead);
    const tb = document.createElement("tbody");
    for (const row of meta.typesTable) {
      const tr = document.createElement("tr");
      for (const key of ["type", "what", "typicalDots"]) {
        const td = document.createElement("td");
        td.textContent = row[key] != null ? String(row[key]) : "—";
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    sec.appendChild(tbl);
    wrap.appendChild(sec);
  }

  const catalog = document.createElement("section");
  catalog.className = "panel birthrights-catalog-panel";
  const h2 = document.createElement("h2");
  h2.textContent = "Templates & examples";
  catalog.appendChild(h2);
  const used = dragonBirthrightsDotsPlaced(picks);
  const sum = document.createElement("p");
  sum.className = "help";
  sum.textContent = `Dots placed: ${used} / ${cap}. “Add” only when that row’s point cost fits what you have left. The same catalog entry may be added more than once (separate picks); tune dots on each pick below.`;
  catalog.appendChild(sum);

  const pickBar = document.createElement("div");
  pickBar.className = "picker-toolbar";
  const brSearch = document.createElement("input");
  brSearch.type = "search";
  brSearch.className = "picker-search";
  brSearch.placeholder = "Filter by name, type, or id…";
  brSearch.autocomplete = "off";
  brSearch.setAttribute("aria-label", "Filter birthright templates");
  pickBar.appendChild(brSearch);
  catalog.appendChild(pickBar);
  const brScroll = document.createElement("div");
  brScroll.className = "picker-scroll";

  const tbl2 = document.createElement("table");
  tbl2.className = "skill-ratings-table birthrights-table";
  const thead2 = document.createElement("thead");
  const hr2 = document.createElement("tr");
  ["Entry", "Type", "Pts", "Summary", ""].forEach((lab, idx) => {
    const th = document.createElement("th");
    th.textContent = lab;
    if (idx === 4) th.className = "birthrights-th-action";
    hr2.appendChild(th);
  });
  thead2.appendChild(hr2);
  tbl2.appendChild(thead2);
  const body2 = document.createElement("tbody");
  const entries = Object.entries(birthrightsForDragonChargen(bundle)).sort((a, b) =>
    String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0]), undefined, { sensitivity: "base" }),
  );
  for (const [bid, br] of entries) {
    const cost = dragonTablePointCost(bundle, bid);
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = /** @type {{ name?: string }} */ (br).name || bid;
    const tdType = document.createElement("td");
    tdType.textContent = /** @type {{ birthrightType?: string }} */ (br).birthrightType || "—";
    const tdCost = document.createElement("td");
    tdCost.textContent = String(cost);
    tdCost.className = "birthrights-td-num";
    const tdDesc = document.createElement("td");
    tdDesc.className = "birthrights-td-desc";
    tdDesc.textContent = dragonBirthrightCatalogSummaryLine(br, bundle);
    const tdAct = document.createElement("td");
    tdAct.className = "birthrights-td-action";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn secondary";
    btn.textContent = "Add";
    btn.disabled = used + cost > cap;
    btn.addEventListener("click", () => {
      ensureDragonShape(character, bundle);
      const arr = /** @type {{ id?: string; dots?: number }[]} */ (character.dragon[picksKey]);
      const u = dragonBirthrightsDotsPlaced(arr);
      if (u + cost > cap) return;
      const initialDots = Math.min(5, Math.max(1, cost));
      arr.push({ id: bid, dots: initialDots });
      render();
    });
    applyGameDataHint(btn, br);
    const addHintDr = btn.disabled
      ? `Not enough dots left for this template’s cost (${cost}). Remove or lower picks below—you can add the same template again once it fits.`
      : "Adds another pick of this template if you want several of the same Birthright (dots must fit your pool).";
    btn.title = btn.title ? `${btn.title}\n\n${addHintDr}` : addHintDr;
    tdAct.appendChild(btn);
    tr.appendChild(tdName);
    tr.appendChild(tdType);
    tr.appendChild(tdCost);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAct);
    const hay = `${/** @type {{ name?: string }} */ (br).name || bid} ${bid} ${/** @type {{ birthrightType?: string }} */ (br).birthrightType || ""} ${dragonBirthrightCatalogSummaryLine(br, bundle).slice(0, 160)}`.trim();
    tr.setAttribute("data-filter-text", hay);
    body2.appendChild(tr);
  }
  tbl2.appendChild(body2);
  wirePickerRowFilter(brSearch, body2);
  wireSortableTableColumns(thead2, body2, [
    { get: (tr) => (tr.cells[0]?.textContent || "").trim() },
    { get: (tr) => (tr.cells[1]?.textContent || "").trim() },
    { get: (tr) => parseInt(String(tr.cells[2]?.textContent || "0"), 10) || 0, numeric: true },
    null,
    null,
  ]);
  brScroll.appendChild(tbl2);
  catalog.appendChild(brScroll);
  wrap.appendChild(catalog);

  const picksSec = document.createElement("section");
  picksSec.className = "panel birthrights-picks-panel";
  const hp = document.createElement("h2");
  hp.textContent = "Your Birthright picks";
  picksSec.appendChild(hp);
  const plist = document.createElement("ul");
  plist.className = "finishing-birthright-picks";
  picks.forEach((pick, idx) => {
    const bid = String(pick.id || "").trim();
    const br = bundle.birthrights?.[bid];
    const li = document.createElement("li");
    li.className = "dragon-br-pick-li";
    const label = document.createElement("span");
    label.textContent = `${br?.name || bid} (${dragonTablePointCost(bundle, bid)} pt template) — `;
    li.appendChild(label);
    const maxDots = dragonMaxDotsForPick(picks, cap, idx);
    appendDragonBirthrightDotStripCapped(li, pick.dots || 1, maxDots, "Dots on this Birthright", (dotN) => {
      ensureDragonShape(character, bundle);
      const arr = /** @type {{ id?: string; dots?: number }[]} */ (character.dragon[picksKey]);
      const row = arr[idx];
      if (row && String(row.id || "").trim() === bid) row.dots = dotN;
      render();
    });
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn secondary";
    rm.textContent = "Remove";
    rm.addEventListener("click", () => {
      ensureDragonShape(character, bundle);
      const arr = /** @type {{ id?: string; dots?: number }[]} */ (character.dragon[picksKey]);
      if (arr[idx] && String(arr[idx].id || "").trim() === bid) arr.splice(idx, 1);
      render();
    });
    li.appendChild(rm);
    if (br) applyGameDataHint(li, br);
    plist.appendChild(li);
  });
  if (picks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "help";
    empty.textContent = "No picks yet — use Add in the table above.";
    picksSec.appendChild(empty);
  } else {
    picksSec.appendChild(plist);
  }
  wrap.appendChild(picksSec);

  const tot = document.createElement("p");
  const u2 = dragonBirthrightsDotsPlaced(picks);
  tot.className = u2 === cap ? "help" : "warn";
  tot.textContent = `Dots placed: ${u2} / ${cap}`;
  wrap.appendChild(tot);
}

/** @param {Record<string, unknown>} bundle @returns {[string, Record<string, unknown>][]} */
function dragonMagicEntriesSorted(bundle) {
  return Object.entries(bundle.dragonMagic || {})
    .filter(([mid, m]) => !mid.startsWith("_") && m && typeof m === "object")
    .sort((a, b) => {
      const na = String(a[1]?.name || a[0]);
      const nb = String(b[1]?.name || b[0]);
      const c = na.localeCompare(nb, undefined, { sensitivity: "base" });
      if (c !== 0) return c;
      return String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: "base" });
    });
}

/**
 * Catalog row ids for each Flight’s Signature Magic (`dragonFlights.json` `signatureMagicId` plus alternate rows whose names end with “(… Signature)” in `dragonMagic.json`).
 * Second/third known Magics must not duplicate another Flight’s signature package (or this Flight’s alternate branded row when the locked slot uses the canonical id).
 * @type {Record<string, string[]>}
 */
const DRAGON_FLIGHT_SIGNATURE_MAGIC_IDS = {
  draq: ["pandemonium", "luck"],
  joka: ["refinement", "understanding"],
  lindwurm: ["avarice", "decay"],
  long: ["dragonBlessings", "flight"],
  naga: ["teleportation", "elementalManipulationWater"],
  serpent: ["purification"],
};

/**
 * @param {Record<string, unknown>} bundle
 * @param {string} currentFlightId
 * @returns {Set<string>}
 */
function dragonMagicIdsExcludedFromSecondaryKnownSlots(bundle, currentFlightId) {
  const out = new Set();
  const cur = String(currentFlightId || "").trim();
  const flights = bundle?.dragonFlights;
  if (!cur || !flights || typeof flights !== "object") return out;
  for (const [fid, fl] of Object.entries(flights)) {
    if (fid.startsWith("_") || !fl || typeof fl !== "object") continue;
    const sig = String(fl?.signatureMagicId || "").trim();
    const pack = DRAGON_FLIGHT_SIGNATURE_MAGIC_IDS[fid];
    /** @type {Set<string>} */
    const ids = new Set();
    if (sig) ids.add(sig);
    if (Array.isArray(pack)) {
      for (const id of pack) {
        const s = String(id || "").trim();
        if (s) ids.add(s);
      }
    }
    if (fid === cur) {
      if (!sig) continue;
      for (const id of ids) {
        if (id !== sig) out.add(id);
      }
    } else {
      for (const id of ids) out.add(id);
    }
  }
  return out;
}

/**
 * Clears second/third known Magics when they are another Flight’s signature (or this Flight’s alternate signature row).
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 */
function sanitizeDragonSecondaryKnownMagics(d, bundle) {
  const fid = String(d.flightId || "").trim();
  const exc = dragonMagicIdsExcludedFromSecondaryKnownSlots(bundle, fid);
  if (exc.size === 0) return;
  for (let i = 1; i <= 2; i += 1) {
    const mid = d.knownMagics[i];
    if (mid && exc.has(mid)) {
      d.knownMagics[i] = "";
      delete d.spellsByMagicId[mid];
    }
  }
}

function ensureDragonSkillDots(d, bundle) {
  for (const id of skillIds(bundle)) {
    if (d.skillDots[id] == null) d.skillDots[id] = 0;
  }
}

/**
 * Path-only ratings (3/2/1 + redistribution). Mutates redistribution fields on `d`.
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 * @returns {Record<string, number>}
 */
function dragonPathOnlySkillValues(d, bundle) {
  ensureDragonSkillDots(d, bundle);
  const h = dragonPathLayoutHash(d);
  if (d.pathSkillRedistSourceHash == null) {
    d.pathSkillRedistSourceHash = h;
  } else if (d.pathSkillRedistSourceHash !== h) {
    d.pathSkillRedistribution = {};
    d.pathSkillRedistSourceHash = h;
  }
  if (!d.pathSkillRedistribution || typeof d.pathSkillRedistribution !== "object") {
    d.pathSkillRedistribution = {};
  }
  const { trimmed, lost, union } = dragonPathSkillTrimmedLostAndUnion(d, bundle);
  let G = dragonSanitizePathSkillRedistribution(trimmed, lost, union, d.pathSkillRedistribution);
  if (lost <= 0) {
    G = {};
    d.pathSkillRedistribution = {};
  } else {
    d.pathSkillRedistribution = G;
  }
  /** @type {Record<string, number>} */
  const pathOnly = {};
  for (const sid of skillIds(bundle)) {
    const t = trimmed[sid] || 0;
    const g = G[sid] || 0;
    pathOnly[sid] = t + g;
  }
  return pathOnly;
}

/**
 * @param {Record<string, number>} pathOnly
 * @param {Record<string, number>} bonusObj
 * @param {number} [capTotal]
 */
function clampDragonFinishingSkillBonus(pathOnly, bonusObj, capTotal = 5) {
  const keys = Object.keys(pathOnly);
  for (const sid of keys) {
    const cap = Math.max(0, 5 - (pathOnly[sid] || 0));
    const v = Math.max(0, Math.round(Number(bonusObj[sid]) || 0));
    bonusObj[sid] = Math.min(cap, v);
  }
  let sum = keys.reduce((s, sid) => s + Math.max(0, Math.round(Number(bonusObj[sid]) || 0)), 0);
  while (sum > capTotal) {
    let best = /** @type {string | null} */ (null);
    for (const sid of keys) {
      const b = Math.max(0, Math.round(Number(bonusObj[sid]) || 0));
      if (b > 0 && (best === null || b >= Math.max(0, Math.round(Number(bonusObj[best]) || 0)))) best = sid;
    }
    if (best == null) break;
    bonusObj[best] -= 1;
    sum -= 1;
  }
}

/** @param {DragonState} d */
function dragonFinishingBonusTotal(d) {
  const b = d.finishingSkillBonus || {};
  return Object.keys(b).reduce((s, k) => s + Math.max(0, Math.round(Number(b[k]) || 0)), 0);
}

/**
 * @param {string} sid
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 * @param {Record<string, number>} pathOnly
 */
function maxDragonSkillFinishingValue(sid, d, bundle, pathOnly) {
  const base = pathOnly[sid] || 0;
  const bonuses = d.finishingSkillBonus || {};
  const sumOthers = skillIds(bundle).reduce((s, id) => {
    if (id === sid) return s;
    return s + Math.max(0, Math.round(Number(bonuses[id]) || 0));
  }, 0);
  const roomGlobal = Math.max(0, 5 - sumOthers);
  const roomLocal = Math.max(0, 5 - base);
  return Math.min(5, base + Math.min(roomGlobal, roomLocal));
}

/**
 * Overwrite `d.skillDots` from Path priority + Path Skills, plus Finishing bonus dots (Dragon p. 112: +5 Skills).
 * @returns {Record<string, number>} path-only layer (before finishing bonuses)
 */
function applyDragonPathMathToSkillDots(d, bundle) {
  const pathOnly = dragonPathOnlySkillValues(d, bundle);
  if (!d.finishingSkillBonus || typeof d.finishingSkillBonus !== "object") d.finishingSkillBonus = {};
  clampDragonFinishingSkillBonus(pathOnly, d.finishingSkillBonus, 5);
  for (const sid of skillIds(bundle)) {
    const base = pathOnly[sid] || 0;
    const fin = Math.max(0, Math.round(Number(d.finishingSkillBonus[sid]) || 0));
    d.skillDots[sid] = Math.min(5, base + fin);
  }
  for (const sid of skillIds(bundle)) {
    if ((d.skillDots[sid] || 0) < 3) delete d.skillSpecialties[sid];
  }
  return pathOnly;
}

/** @param {Record<string, number>} from @param {Record<string, number>} to @param {Record<string, unknown>} bundle */
function sumPositiveDragonAttrDeltas(from, to, bundle) {
  let s = 0;
  for (const id of Object.keys(bundle.attributes || {})) {
    if (String(id).startsWith("_")) continue;
    s += Math.max(0, (to[id] ?? 1) - (from[id] ?? 1));
  }
  return s;
}

/**
 * Snapshot Attributes step ratings for Finishing +1 dot (call when leaving Attributes).
 * @param {{ bakeTierAdvance?: boolean }} [options] Use `{ bakeTierAdvance: true }` when rebasing after tier/heir advancement so the new floor includes prior ratings.
 */
export function captureDragonFinishingAttrBaseline(d, bundle, options = {}) {
  /** @type {Record<string, number>} */
  const cur = {};
  for (const id of Object.keys(bundle.attributes || {})) {
    if (String(id).startsWith("_")) continue;
    cur[id] = Math.max(1, Math.min(5, Math.round(Number(d.attributes[id]) || 1)));
  }
  if (options.bakeTierAdvance === true) {
    d.finishingAttrBaseline = cur;
    return;
  }
  const prev = d.finishingAttrBaseline;
  if (!prev || typeof prev !== "object") {
    d.finishingAttrBaseline = cur;
    return;
  }
  const budget = 1;
  const placedGains = sumPositiveDragonAttrDeltas(prev, cur, bundle);
  const finPlaced = dragonFinishingAttrDotsPlaced(d, bundle);
  if (finPlaced === 0) {
    d.finishingAttrBaseline = cur;
    return;
  }
  if (placedGains === budget && finPlaced === budget) {
    let strip = budget;
    const next = { ...cur };
    const ids = Object.keys(bundle.attributes || {})
      .filter((id) => !String(id).startsWith("_"))
      .sort(
        (a, b) =>
          Math.max(0, (cur[b] ?? 1) - (prev[b] ?? 1)) - Math.max(0, (cur[a] ?? 1) - (prev[a] ?? 1)),
      );
    for (const id of ids) {
      const gain = Math.max(0, (cur[id] ?? 1) - (prev[id] ?? 1));
      if (gain <= 0 || strip <= 0) continue;
      const take = Math.min(gain, strip);
      next[id] = Math.max(1, Math.min(5, (next[id] ?? 1) - take));
      strip -= take;
    }
    if (strip !== 0) return;
    d.finishingAttrBaseline = next;
    return;
  }
}

/**
 * @param {Record<string, number>} attrs
 * @param {string} favoredApproach
 */
function applyFavoredApproachDragonPlain(attrs, favoredApproach) {
  const base = { ...attrs };
  const key = APPROACH_ATTRS[favoredApproach] ? favoredApproach : "Finesse";
  for (const id of APPROACH_ATTRS[key]) {
    base[id] = (base[id] ?? 1) + 2;
  }
  for (const id of Object.keys(base)) {
    if (base[id] > 5) base[id] = 5;
  }
  return base;
}

/**
 * @param {string} attrId
 * @param {Record<string, number>} attrs
 * @param {string} favoredApproach
 */
function dragonMaxPreFavoredUnderLegendCap(attrId, attrs, favoredApproach) {
  for (let v = 5; v >= 1; v -= 1) {
    const trial = { ...attrs, [attrId]: v };
    const fin = applyFavoredApproachDragonPlain(trial, favoredApproach);
    if ((fin[attrId] ?? 1) <= 5) return v;
  }
  return 1;
}

/**
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 */
function ensureDragonFinishingAttrBaseline(d, bundle) {
  if (d.finishingAttrBaseline && typeof d.finishingAttrBaseline === "object") return;
  captureDragonFinishingAttrBaseline(d, bundle);
}

/**
 * @param {string} attrId
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 */
function maxDragonAttrFinishing(attrId, d, bundle) {
  ensureDragonFinishingAttrBaseline(d, bundle);
  const attrs = {};
  for (const id of Object.keys(bundle.attributes || {})) {
    if (String(id).startsWith("_")) continue;
    attrs[id] = d.attributes[id] ?? 1;
  }
  const b = /** @type {Record<string, number>} */ (d.finishingAttrBaseline);
  const placedOthers = Object.keys(bundle.attributes || {})
    .filter((oid) => !String(oid).startsWith("_") && oid !== attrId)
    .reduce((s, oid) => s + Math.max(0, (attrs[oid] ?? 1) - (b[oid] ?? 1)), 0);
  const budget = 1;
  const fromBudget = (b[attrId] ?? 1) + Math.max(0, budget - placedOthers);
  const fromLegend = dragonMaxPreFavoredUnderLegendCap(attrId, attrs, d.favoredApproach);
  return Math.min(5, fromBudget, fromLegend);
}

/**
 * @param {string} attrId
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 */
function maxDragonFinalAttrFinishing(attrId, d, bundle) {
  const attrs = {};
  for (const id of Object.keys(bundle.attributes || {})) {
    if (String(id).startsWith("_")) continue;
    attrs[id] = d.attributes[id] ?? 1;
  }
  const maxPre = maxDragonAttrFinishing(attrId, d, bundle);
  const fin = applyFavoredApproachDragonPlain({ ...attrs, [attrId]: maxPre }, d.favoredApproach);
  return fin[attrId] ?? 1;
}

/** @param {DragonState} d @param {Record<string, unknown>} bundle */
function dragonFinishingAttrDotsPlaced(d, bundle) {
  if (!d.finishingAttrBaseline || typeof d.finishingAttrBaseline !== "object") return 0;
  const b = d.finishingAttrBaseline;
  return Object.keys(bundle.attributes || {})
    .filter((id) => !String(id).startsWith("_"))
    .reduce((sum, id) => sum + Math.max(0, (d.attributes[id] ?? 1) - (b[id] ?? 1)), 0);
}

/** @param {DragonState} d @param {Record<string, unknown>} bundle */
function dragonFinishingAttrDotsRemaining(d, bundle) {
  return Math.max(0, 1 - dragonFinishingAttrDotsPlaced(d, bundle));
}

function dragonKnackShell(character) {
  const d = character.dragon;
  return {
    tier: "hero",
    callingSlots: (d.callingSlots || []).map((s) => ({
      id: String(s?.id ?? "").trim(),
      dots: Math.max(1, Math.min(5, Math.round(Number(s?.dots) || 1))),
    })),
    knackSlotById: { ...(d.knackSlotById || {}) },
    knackIds: [...(d.callingKnackIds || [])],
    pantheonId: "",
    parentDeityId: "",
    patronKind: "deity",
    purviewIds: [],
    patronPurviewSlots: ["", "", "", ""],
    mythosInnatePower: { style: "standard", awarenessPurviewId: "", awarenessLocked: false },
    legendRating: 1,
    pathRank: { primary: "origin", secondary: "role", tertiary: "society" },
  };
}

/** Path phrase for panel headings (mirrors Scion Skills step). */
function dragonPathPhraseSnippet(d, pk, maxChars = 96) {
  const raw = String((pk === "origin" ? d.paths?.origin : pk === "role" ? d.paths?.role : d.paths?.flight) ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!raw) return null;
  if (raw.length <= maxChars) return { text: raw, truncated: false };
  return { text: `${raw.slice(0, maxChars - 1).trimEnd()}…`, truncated: true, full: raw };
}

/**
 * @param {HTMLButtonElement} chip
 * @param {Record<string, unknown>} k
 */
function setKnackChipContents(chip, k) {
  const kk = k?.knackKind;
  const name = typeof k?.name === "string" ? k.name : "";
  chip.textContent = "";
  if (kk === "heir") {
    const inner = document.createElement("span");
    inner.className = "chip-knack-inner";
    const nm = document.createElement("span");
    nm.className = "chip-knack-name";
    nm.textContent = name;
    inner.appendChild(nm);
    const bd = document.createElement("span");
    bd.className = "knack-kind-badge knack-kind-mortal";
    bd.textContent = "Calling";
    inner.appendChild(bd);
    chip.appendChild(inner);
    return;
  }
  if (kk !== "mortal" && kk !== "immortal") {
    chip.textContent = name;
    return;
  }
  const inner = document.createElement("span");
  inner.className = "chip-knack-inner";
  const nm = document.createElement("span");
  nm.className = "chip-knack-name";
  nm.textContent = name;
  inner.appendChild(nm);
  const bd = document.createElement("span");
  bd.className = kk === "mortal" ? "knack-kind-badge knack-kind-mortal" : "knack-kind-badge knack-kind-immortal";
  bd.textContent = kk === "mortal" ? "Mortal" : "Immortal";
  inner.appendChild(bd);
  chip.appendChild(inner);
}

/** Draconic knack chips (no Mortal/Immortal ladder in data). */
function setDraconicKnackChipContents(chip, k) {
  chip.textContent = "";
  const name = typeof k?.name === "string" ? k.name : "";
  const inner = document.createElement("span");
  inner.className = "chip-knack-inner";
  const nm = document.createElement("span");
  nm.className = "chip-knack-name";
  nm.textContent = name || String(k?.id ?? "");
  inner.appendChild(nm);
  const bd = document.createElement("span");
  bd.className = "knack-kind-badge knack-kind-mortal";
  bd.textContent = "Draconic";
  inner.appendChild(bd);
  chip.appendChild(inner);
}

function applyFavoredToDragonAttrs(d) {
  const base = { ...d.attributes };
  const fav = d.favoredApproach;
  const attrs = APPROACH_ATTRS[fav] ? fav : "Finesse";
  for (const id of APPROACH_ATTRS[attrs]) {
    base[id] = (base[id] ?? 1) + 2;
  }
  for (const id of Object.keys(base)) {
    if (base[id] > 5) base[id] = 5;
  }
  return base;
}

/**
 * True when each named arena spends its 6 / 4 / 2 extras plus any Finishing Attribute bump in that arena
 * (Dragon p. 111; same structure as Origin pp. 97–98 and `attributeArenaPoolsSpendOk` in `app.js`).
 */
function dragonAttributeArenaPoolsSpendOk(d) {
  const baseline = d.finishingAttrBaseline && typeof d.finishingAttrBaseline === "object" ? d.finishingAttrBaseline : null;
  for (const arena of ARENA_ORDER) {
    const p = dragonArenaPools(d)[arena];
    if (p == null || Number.isNaN(Number(p))) continue;
    let s = 0;
    for (const id of ARENAS[arena]) {
      s += Math.max(0, (d.attributes[id] ?? 1) - 1);
    }
    const finD = baseline ? dragonFinishingArenaExtraDelta(d.attributes, baseline, arena) : 0;
    if (s < p || s > p + finD) return false;
  }
  return true;
}

/** @returns {string[]} */
function validateDragonAttributesPreFavored(d) {
  const msgs = [];
  for (const aid of Object.keys(d.attributes)) {
    const v = Math.round(Number(d.attributes[aid]) || 1);
    if (v < 1 || v > 5) msgs.push(`${aid} must be between 1 and 5 before Favored Approach.`);
  }
  return msgs;
}

function panel(title, inner) {
  const p = document.createElement("section");
  p.className = "panel";
  const h = document.createElement("h2");
  h.textContent = title;
  p.appendChild(h);
  p.appendChild(inner);
  return p;
}

function flightRequiredSkills(bundle, flightId) {
  const f = bundle?.dragonFlights?.[flightId];
  const req = f?.pathSkillChoicesRequired;
  return Array.isArray(req) ? req.filter((x) => typeof x === "string") : [];
}

/**
 * Puts Flight `pathSkillChoicesRequired` skills into `d.pathSkills.flight` first, then keeps other picks (max 3).
 * Call after `flightId` or bundle changes so the player only chooses the non-required slot(s).
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 */
export function syncDragonFlightPathRequiredSkills(d, bundle) {
  const fid = String(d.flightId || "").trim();
  if (!fid) return;
  const req = flightRequiredSkills(bundle, fid).filter((id) => bundle?.skills?.[id] && !String(id).startsWith("_"));
  if (!req.length) return;
  if (!d.pathSkills || typeof d.pathSkills !== "object") d.pathSkills = { origin: [], role: [], flight: [] };
  if (!Array.isArray(d.pathSkills.flight)) d.pathSkills.flight = [];
  const cur = d.pathSkills.flight.filter((id) => typeof id === "string" && bundle?.skills?.[id] && !String(id).startsWith("_"));
  const out = [];
  const seen = new Set();
  for (const id of req) {
    if (seen.has(id)) continue;
    out.push(id);
    seen.add(id);
  }
  for (const id of cur) {
    if (out.length >= 3) break;
    if (seen.has(id)) continue;
    out.push(id);
    seen.add(id);
  }
  d.pathSkills.flight = out;
}

/**
 * Path priority, three Skills per Path, and read-only Path-derived dots (Dragon Heir Skills step).
 * @param {HTMLElement} parent
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 * @param {() => void} render
 * @param {boolean} [pathReadOnly] After Hatchling: Path picks, priority, and specialties read-only.
 */
function appendDragonPathSkillsAssignmentSection(parent, d, bundle, render, pathReadOnly = false) {
  syncDragonFlightPathRequiredSkills(d, bundle);
  const rule = document.createElement("p");
  rule.className = "help";
  rule.id = "d-flight-skill-rule";
  const reqFlight = flightRequiredSkills(bundle, d.flightId);
  if (!String(d.flightId || "").trim()) {
    rule.textContent = "Choose a Flight on the Flights step first; Path Skills depend on it.";
  } else if (reqFlight.length) {
    const names = reqFlight.map((id) => bundle.skills[id]?.name || id).join(", ");
    rule.textContent = `Those Flight skills (${names}) are added automatically; pick one other Skill for this Path (Dragon p. 112).`;
  } else {
    rule.textContent =
      "This Flight does not add fixed Flight Path skills—pick any three Skills for the Flight Path (Dragon p. 112).";
  }
  parent.appendChild(rule);

  const rankMount = document.createElement("div");
  rankMount.className = "wizard-triple-field-row";
  rankMount.id = "d-path-ranks";
  rankMount.setAttribute("role", "group");
  rankMount.setAttribute("aria-label", "Path priority");
  ["primary", "secondary", "tertiary"].forEach((rk) => {
    const field = document.createElement("div");
    field.className = "field";
    const lab = document.createElement("label");
    lab.textContent = `${rk} path`;
    const sel = document.createElement("select");
    sel.id = `d-path-rank-${rk}`;
    for (const pk of PATH_KEYS) {
      const o = document.createElement("option");
      o.value = pk;
      o.textContent = pk.charAt(0).toUpperCase() + pk.slice(1);
      sel.appendChild(o);
    }
    sel.value = d.pathRank[rk] && PATH_KEYS.includes(d.pathRank[rk]) ? d.pathRank[rk] : "origin";
    sel.disabled = pathReadOnly;
    if (!pathReadOnly) {
      sel.addEventListener("change", () => {
        const prev = { ...d.pathRank };
        const newPath = sel.value;
        const oldPath = prev[rk];
        if (newPath === oldPath) return;
        const otherRank = ["primary", "secondary", "tertiary"].find((key) => key !== rk && prev[key] === newPath);
        if (otherRank) d.pathRank = { ...prev, [rk]: newPath, [otherRank]: oldPath };
        else d.pathRank = { ...prev, [rk]: newPath };
        render();
      });
    }
    field.appendChild(lab);
    field.appendChild(sel);
    rankMount.appendChild(field);
  });
  parent.appendChild(rankMount);

  const panels = document.createElement("div");
  panels.id = "d-path-skill-panels";
  for (const pk of PATH_KEYS) {
    const count = (d.pathSkills[pk] || []).length;
    const box = document.createElement("div");
    box.className = "panel" + (count !== 3 ? " panel-gate-invalid" : "");
    box.id = `d-path-skills-panel-${pk}`;
    const h = document.createElement("h2");
    h.className = "path-skills-heading";
    const pathTitle = pk.charAt(0).toUpperCase() + pk.slice(1);
    const snip = dragonPathPhraseSnippet(d, pk);
    if (snip) {
      h.textContent = `Skills for ${pathTitle} path — ${snip.text}`;
      if (snip.truncated) h.title = snip.full;
    } else {
      h.textContent = `Skills for ${pathTitle} path`;
      h.title = "Describe this Path on the Flights step; the phrase is shown here to guide Skill choices.";
    }
    box.appendChild(h);

    if (pk === "flight" && reqFlight.length >= 1) {
      const flightRule = document.createElement("p");
      flightRule.className = "help society-asset-rule";
      const aNames = reqFlight.map((id) => bundle.skills[id]?.name || id).join(" & ");
      flightRule.innerHTML = `<strong>Flight Path:</strong> <span class="asset-skill-names">${aNames}</span> are fixed for this Flight — pick exactly <em>${Math.max(0, 3 - reqFlight.length)}</em> more Skill(s) (Dragon p. 112).`;
      box.appendChild(flightRule);
    }

    const err = document.createElement("p");
    err.id = `d-path-skill-violation-${pk}`;
    err.className = "warn";
    err.style.minHeight = "1.25em";
    box.appendChild(err);

    if (count !== 3) {
      const w = document.createElement("p");
      w.className = "warn";
      w.textContent =
        pk === "flight" && reqFlight.length >= 1
          ? "Pick one more Skill (highlighted Flight skills are already included)."
          : "Each Path should have exactly three Skills at creation.";
      box.appendChild(w);
    }

    const cdiv = document.createElement("div");
    cdiv.className = "chips";
    for (const sid of skillIds(bundle)) {
      const s = bundle.skills[sid];
      const chip = document.createElement("button");
      chip.type = "button";
      const isOn = (d.pathSkills[pk] || []).includes(sid);
      const isFlightAsset = pk === "flight" && reqFlight.includes(sid);
      chip.className = "chip" + (isOn ? " on" : "") + (isFlightAsset ? " chip-pantheon-asset" : "");
      chip.textContent = s.name;
      applyGameDataHint(
        chip,
        s,
        isFlightAsset
          ? {
              prefix:
                "Required for this Flight — selected automatically and cannot be removed. Pick your other Flight Path skill(s) per Dragon p. 112.",
            }
          : undefined,
      );
      if (!pathReadOnly) {
        chip.addEventListener("click", () => {
          const set = new Set(d.pathSkills[pk] || []);
          if (pk === "flight" && reqFlight.includes(sid) && set.has(sid)) {
            return;
          }
          if (set.has(sid)) set.delete(sid);
          else set.add(sid);
          const next = [...set];
          const viol = document.getElementById(`d-path-skill-violation-${pk}`);
          if (next.length > 3) {
            if (viol) viol.textContent = "Each Path may only include three Skills.";
            return;
          }
          if (pk === "flight" && reqFlight.length >= 1 && next.length === 3) {
            const picked = new Set(next);
            const ok = reqFlight.every((id) => picked.has(id));
            if (!ok) {
              if (viol) viol.textContent = "Flight Path must include every Flight-listed required skill.";
              return;
            }
          }
          if (viol) viol.textContent = "";
          d.pathSkills[pk] = next;
          render();
        });
      } else {
        chip.disabled = true;
      }
      cdiv.appendChild(chip);
    }
    box.appendChild(cdiv);
    panels.appendChild(box);
  }
  parent.appendChild(panels);
  appendDragonReadonlyPathSkillRatingsPanel(parent, d, bundle, pathReadOnly);
}

/**
 * @param {DragonState} d
 * @param {Record<string, unknown>} bundle
 * @returns {string | null} user-facing alert text when Path Skills are not ready for steps after Skills
 */
function dragonPathSkillsAssignmentIncompleteMessage(d, bundle) {
  if (!String(d.flightId || "").trim()) {
    return "Choose a Flight on the Flights step.";
  }
  for (const pk of PATH_KEYS) {
    if ((d.pathSkills[pk] || []).length !== 3) {
      return `Pick exactly three Skills for the ${pk} path.`;
    }
  }
  const req = flightRequiredSkills(bundle, d.flightId);
  const flSkills = new Set(d.pathSkills.flight || []);
  if (req.length && !req.every((id) => flSkills.has(id))) {
    return "Flight Path must include every skill your Flight lists for this Path.";
  }
  return null;
}

/**
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {string} step
 * @returns {string | null} alert text if the user cannot leave this step toward Next
 */
export function dragonHeirStepLeaveBlockedReason(character, bundle, step) {
  if (!isDragonHeirChargen(character)) return null;
  ensureDragonShape(character, bundle);
  const d = character.dragon;
  if (step === "paths") {
    if (!String(d.flightId || "").trim()) {
      return "Choose a Flight.";
    }
    return null;
  }
  if (step === "skills") {
    const pathGate = dragonPathSkillsAssignmentIncompleteMessage(d, bundle);
    if (pathGate) return pathGate;
    applyDragonPathMathToSkillDots(d, bundle);
    const pendSk = dragonPathSkillOverflowDotsPending(d, bundle);
    if (pendSk > 0) {
      return `Redistribute Path overlap: ${pendSk} dot(s) still unplaced (Origin p. 97 — max 5 per Skill from Paths; excess only onto other Path Skills).`;
    }
    return null;
  }
  if (step === "attributes") {
    const ve = validateDragonAttributesPreFavored(d);
    if (ve.length) return ve.join("\n");
    if (!dragonAttributeArenaPoolsSpendOk(d)) return "Arena attribute pools are not full.";
    return null;
  }
  if (step === "calling") {
    const sum = d.callingSlots.reduce((s, x) => s + x.dots, 0);
    const ids = d.callingSlots.map((s) => s.id).filter(Boolean);
    if (sum !== 5 || ids.length !== 3 || new Set(ids).size !== 3) {
      return "Assign exactly five Calling dots across three different Callings (minimum one dot each).";
    }
    const cap = sum;
    const used = knackIdsCallingSlotsUsed(d.callingKnackIds, bundle);
    if (used > cap) {
      return "Too many Calling Knacks for your Calling dots.";
    }
    const dkCap = dragonInheritanceWizardCaps(bundle, d.inheritance).draconicKnackLimit;
    if (d.draconicKnackIds.length !== dkCap) {
      return `Select exactly ${dkCap} Draconic Knack(s) for your current Inheritance (Dragon pp. 117–119).`;
    }
    return null;
  }
  if (step === "magic") {
    if (!d.knownMagics[0] || !d.knownMagics[1] || !d.knownMagics[2]) {
      return "You need three Dragon Magics (signature is set from Flight; pick two more).";
    }
    for (const mid of d.knownMagics) {
      if (!d.spellsByMagicId[mid]) {
        return `Choose a Spell for each Magic (${mid}).`;
      }
    }
    if (!d.bonusSpell?.magicId || !d.bonusSpell?.spellId) {
      return "Choose the bonus Spell (Magic + Spell).";
    }
    const advSlots = dragonInheritanceWizardCaps(bundle, d.inheritance).advancementSpellSlots;
    if (advSlots > 0) {
      const adv = Array.isArray(d.advancementSpells) ? d.advancementSpells : [];
      for (let i = 0; i < advSlots; i += 1) {
        const row = adv[i];
        if (!row || !String(row.magicId || "").trim() || !String(row.spellId || "").trim()) {
          return `Fill every Inheritance milestone spell row (${advSlots} total — Magic + Spell each).`;
        }
      }
    }
    return null;
  }
  if (step === "birthrights") {
    for (const p of d.birthrightPicks) {
      const id = String(p?.id || "").trim();
      if (!id || !bundle.birthrights?.[id]) {
        return "Each Birthright pick must reference a catalog entry. Remove invalid rows or re-add from the table.";
      }
    }
    const used = dragonBirthrightsDotsPlaced(d.birthrightPicks);
    if (used !== 7) {
      return "Birthrights must total exactly seven dots.";
    }
    return null;
  }
  if (step === "finishing") {
    if (d.inheritance > 1) return null;
    applyDragonPathMathToSkillDots(d, bundle);
    const specFin = dragonSkillsMissingSpecialtyFinishingMessage(d, bundle);
    if (specFin) return specFin;
    if (dragonFinishingBonusTotal(d) !== 5) {
      return "Spend exactly five finishing Skill dots (Dragon p. 112).";
    }
    if (dragonFinishingAttrDotsPlaced(d, bundle) !== 1) {
      return "Spend exactly one finishing Attribute dot (Dragon p. 112).";
    }
    if (d.finishingFocus === "birthrights") {
      for (const p of d.finishingBirthrightPicks) {
        const id = String(p?.id || "").trim();
        if (!id || !bundle.birthrights?.[id]) {
          return "Each finishing Birthright pick must reference a catalog entry. Remove invalid rows or re-add from the table.";
        }
      }
      const u = dragonBirthrightsDotsPlaced(d.finishingBirthrightPicks);
      if (u !== 4) {
        return "Finishing Birthright bonus must total exactly four dots.";
      }
    } else if (d.finishingCallingKnackIds.length !== 2) {
      return "Pick exactly two extra Calling Knacks, or switch to Birthright bonus.";
    } else {
      const sh = dragonKnackShell(character);
      for (const kid of d.finishingCallingKnackIds) {
        const k = bundleKnackById(kid, bundle);
        if (!k || !knackEligible(k, sh, bundle)) {
          return `Finishing knack no longer valid: ${kid}`;
        }
      }
    }
    return null;
  }
  return null;
}

/**
 * Dragon Heir Flights tab: Flight catalog + three Path phrases. Used by `renderDragonHeirStepInRoot` when `step === "paths"`
 * (the main wizard routes Dragon Heir here instead of `app.js` `renderPaths`) and by `renderDragonHeirPathsOnly` in app.
 * @param {HTMLElement} root
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {() => void} render
 */
export function appendDragonHeirFlightsPathStep(root, character, bundle, render) {
  ensureDragonShape(character, bundle);
  const d = character.dragon;
  const wrap = document.createElement("div");
  const help = document.createElement("p");
  help.className = "help";
  help.textContent =
    "Choose Flight and write your three Path phrases here. Path Skills, Path priority, and Skill dots are on the Skills tab — same separation as Deity Mortal (Origin).";
  wrap.appendChild(help);
  const mount = document.createElement("div");
  mount.id = "p-dragon-flight-mount";
  mount.className = "field paths-dragon-flight-field";
  mount.innerHTML =
    '<label for="p-dragon-flight">Flight (Dragon Heir)</label><select id="p-dragon-flight"><option value="">—</option></select>';
  wrap.appendChild(mount);
  const grid = document.createElement("div");
  grid.className = "paths-step-grid";
  grid.innerHTML = `
    <div class="paths-phrases-row">
      <div class="field"><label for="p-origin">Origin Path phrase</label><textarea id="p-origin"></textarea></div>
      <div class="field"><label for="p-role">Role Path phrase</label><textarea id="p-role"></textarea></div>
      <div class="field"><label for="p-soc">Flight Path phrase</label><textarea id="p-soc"></textarea></div>
    </div>`;
  wrap.appendChild(grid);
  root.appendChild(panel("Flights", wrap));
  const fs = wrap.querySelector("#p-dragon-flight");
  if (fs) {
    fs.innerHTML = `<option value="">—</option>`;
    for (const [fid, meta] of Object.entries(bundle.dragonFlights || {})) {
      if (String(fid).startsWith("_") || !meta || typeof meta !== "object") continue;
      const o = document.createElement("option");
      o.value = fid;
      o.textContent = meta.name || fid;
      applyGameDataHint(o, meta);
      fs.appendChild(o);
    }
  }
  if (fs) {
    fs.value = String(d?.flightId || "").trim();
    applyHint(fs, "p-dragon-flight");
    fs.addEventListener("change", () => {
      persistDragonFromDom(character, bundle, "paths");
      render();
    });
  }
  syncDragonFlightPathRequiredSkills(d, bundle);
  const po = wrap.querySelector("#p-origin");
  const pr = wrap.querySelector("#p-role");
  const psoc = wrap.querySelector("#p-soc");
  if (po) po.value = String(character.paths?.origin ?? "");
  if (pr) pr.value = String(character.paths?.role ?? "");
  if (psoc) psoc.value = String(d?.paths?.flight ?? character.paths?.society ?? "");
  applyHint(po, "p-origin");
  applyHint(pr, "p-role");
  applyHint(psoc, "p-flight-path");
}

/**
 * Renders one Dragon Heir post-concept step into `root` (unified main wizard; no separate nav/actions).
 * @param {{ root: HTMLElement; character: Record<string, unknown>; bundle: Record<string, unknown>; render: () => void; step: string; scrollStepIntoView?: () => void; navigateToDragonHeirStep?: (stepId: string) => void }} ctx
 */
export function renderDragonHeirStepInRoot(ctx) {
  const { root, character, bundle, render, step, scrollStepIntoView, navigateToDragonHeirStep } = ctx;
  ensureDragonShape(character, bundle);
  const d = character.dragon;
  const navStepsForSi = dragonHeirPostConceptStepList(character);
  const si = navStepsForSi.indexOf(step);
  if (si >= 0) d.stepIndex = si;
  root.innerHTML = "";

  if (step === "paths") {
    appendDragonHeirFlightsPathStep(root, character, bundle, render);
  }

  if (step === "skills") {
    applyDragonPathMathToSkillDots(d, bundle);
    const skLocked = dragonHeirAttributesCoreLayoutLocked(character);
    const wrap = document.createElement("div");
    if (skLocked) wrap.classList.add("skills-step-readonly");
    const ovMeta = dragonPathSkillTrimmedLostAndUnion(d, bundle);
    const pend = dragonPathSkillOverflowDotsPending(d, bundle);
    if (pend > 0) {
      const box = document.createElement("div");
      box.className = "skills-gate-errors";
      box.setAttribute("role", "alert");
      const title = document.createElement("p");
      title.className = "skills-gate-errors-title";
      title.textContent = "Fix the following before leaving Skills:";
      box.appendChild(title);
      const ul = document.createElement("ul");
      const li = document.createElement("li");
      li.textContent = `Path overlap would put a Skill above 5 dots (Origin p. 97). Move exactly ${pend} excess Path dot(s) onto other Path Skills using the redistribution controls on this step — not into non-Path Skills.`;
      ul.appendChild(li);
      box.appendChild(ul);
      wrap.appendChild(box);
    }
    const intro = document.createElement("p");
    intro.className = "help";
    intro.textContent =
      "Set Path priority (primary / secondary / tertiary), three Skills per Path, and review derived dot totals here. Path phrases stay on the Flights step. When overlap would exceed 5 dots in a Skill, use the redistribution controls below (Origin p. 97).";
    wrap.appendChild(intro);
    if (skLocked) {
      const lock = document.createElement("p");
      lock.className = "help attributes-core-locked-note";
      lock.textContent =
        "Path Skills, Path priority, overflow placement, and Specialties are read-only after Hatchling (Inheritance 1). Chronicle-based increases are not edited here yet.";
      wrap.appendChild(lock);
    }
    appendDragonPathSkillsAssignmentSection(wrap, d, bundle, render, skLocked);
    if (ovMeta.lost > 0) {
      const placed = dragonSumPathSkillRedistribution(d.pathSkillRedistribution);
      const pending = Math.max(0, ovMeta.lost - placed);
      const overNames = [];
      for (const sid of ovMeta.union) {
        if ((ovMeta.raw[sid] || 0) > 5) overNames.push(bundle.skills[sid]?.name || sid);
      }
      const ovPanel = document.createElement("div");
      ovPanel.className = "panel path-skill-overflow-panel";
      const ovTitle = document.createElement("h2");
      ovTitle.textContent = "Redistribute Path overlap (mandatory)";
      ovPanel.appendChild(ovTitle);
      const ovP = document.createElement("p");
      ovP.className = "help";
      ovP.innerHTML =
        (overNames.length
          ? `<strong>${overNames.join(", ")}</strong> would be above 5 dots from cumulative Path picks alone. `
          : "") +
        `Cap each Skill at 5 from Path math, then place <strong>${ovMeta.lost}</strong> overflow dot(s) on other Path Skills. ` +
        `<strong>${pending}</strong> still to place.`;
      ovPanel.appendChild(ovP);
      const unionSorted = [...ovMeta.union].sort((a, b) =>
        String(bundle.skills[a]?.name || a).localeCompare(String(bundle.skills[b]?.name || b), undefined, {
          sensitivity: "base",
        }),
      );
      for (const sid of unionSorted) {
        const t = ovMeta.trimmed[sid] || 0;
        const g = d.pathSkillRedistribution[sid] || 0;
        const row = document.createElement("div");
        row.className = "path-skill-overflow-row";
        const lab = document.createElement("span");
        lab.className = "path-skill-overflow-label";
        lab.textContent = `${bundle.skills[sid]?.name || sid} — ${t + g} / 5 (${t} from Paths + ${g} overflow)`;
        row.appendChild(lab);
        const cap = document.createElement("div");
        cap.className = "path-skill-overflow-actions";
        const minus = document.createElement("button");
        minus.type = "button";
        minus.className = "btn secondary";
        minus.textContent = "−1 overflow";
        minus.disabled = skLocked || g <= 0;
        if (!skLocked) {
          minus.addEventListener("click", () => {
            dragonBumpPathSkillRedistribution(d, bundle, sid, -1);
            render();
          });
        }
        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "btn secondary";
        plus.textContent = "+1 overflow";
        const room = Math.max(0, 5 - t - g);
        plus.disabled = skLocked || pending <= 0 || room <= 0;
        if (!skLocked) {
          plus.addEventListener("click", () => {
            dragonBumpPathSkillRedistribution(d, bundle, sid, 1);
            render();
          });
        }
        cap.appendChild(minus);
        cap.appendChild(plus);
        row.appendChild(cap);
        ovPanel.appendChild(row);
      }
      wrap.appendChild(ovPanel);
    }
    if (pend <= 0 && !(ovMeta.lost > 0)) {
      const done = document.createElement("p");
      done.className = "help";
      done.textContent =
        "No Path overlap to fix. Skill ratings above reflect your Path picks; use Back to change Flight or Path phrases on the Flights step.";
      wrap.appendChild(done);
    }
    root.appendChild(panel("Skills", wrap));
  }

  if (step === "attributes") {
    applyDragonPathMathToSkillDots(d, bundle);
    const attrLocked = dragonHeirAttributesCoreLayoutLocked(character);
    const wrap = document.createElement("div");
    if (attrLocked) wrap.classList.add("attributes-step-readonly");
    const help = document.createElement("p");
    help.className = "help";
    help.textContent =
      "Set arena priority (6 / 4 / 2 extra dots beyond the free 1 each in that arena), distribute those dots, then choose Favored Approach (+2 to each Attribute in that Approach, max 5).";
    wrap.appendChild(help);
    if (attrLocked) {
      const lock = document.createElement("p");
      lock.className = "help attributes-core-locked-note";
      lock.textContent =
        "Arena priority, Favored Approach, and Attribute dots are read-only after Hatchling (Inheritance 1). Use your table for later raises until this app adds a dedicated control.";
      wrap.appendChild(lock);
    }

    const rankRow = document.createElement("div");
    rankRow.className = "wizard-triple-field-row";
    rankRow.setAttribute("role", "group");
    rankRow.setAttribute("aria-label", "Arena priority");
    ["Primary arena (6 extras)", "Secondary (4 extras)", "Tertiary (2 extras)"].forEach((label, idx) => {
      const field = document.createElement("div");
      field.className = "field";
      const lab = document.createElement("label");
      lab.textContent = label;
      const sel = document.createElement("select");
      sel.id = `d-arena-rank-${idx}`;
      ARENAS_SORTED.forEach((a) => {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = a;
        sel.appendChild(o);
      });
      sel.value = d.arenaRank[idx] || ARENA_ORDER[idx];
      sel.disabled = attrLocked;
      if (!attrLocked) {
        sel.addEventListener("change", () => {
          const prev = [...d.arenaRank];
          const newArena = sel.value;
          const oldArena = prev[idx];
          if (newArena === oldArena) return;
          const otherIdx = prev.indexOf(newArena);
          const next = [...prev];
          if (otherIdx >= 0) {
            next[idx] = newArena;
            next[otherIdx] = oldArena;
          } else {
            next[idx] = newArena;
          }
          d.arenaRank = next;
          render();
        });
      }
      field.appendChild(lab);
      field.appendChild(sel);
      rankRow.appendChild(field);
      applyHint(sel, `arena-rank-${idx}`);
    });
    wrap.appendChild(rankRow);

    const favField = document.createElement("div");
    favField.className = "field";
    const labFav = document.createElement("label");
    labFav.textContent = "Favored Approach";
    const selF = document.createElement("select");
    selF.id = "d-favored";
    FAVORED_APPROACHES_SORTED.forEach((a) => {
      const o = document.createElement("option");
      o.value = a;
      o.textContent = a;
      selF.appendChild(o);
    });
    selF.value = d.favoredApproach;
    selF.disabled = attrLocked;
    if (!attrLocked) {
      selF.addEventListener("change", () => {
        d.favoredApproach = selF.value;
        render();
      });
    }
    favField.appendChild(labFav);
    favField.appendChild(selF);
    wrap.appendChild(favField);
    applyHint(selF, "fav-approach");

    normalizeDragonAttributesToPools(d, bundle);
    const base = dragonAttributesStepPreFavoredForTab(d, bundle);
    const msgs = validateDragonAttributesPreFavored(d);
    const poolsOk = dragonAttributeArenaPoolsSpendOk(d);
    const msgBox = document.createElement("div");
    msgBox.className = msgs.length || !poolsOk ? "warn" : "ok";
    msgBox.textContent = msgs.length ? msgs.join(" ") : poolsOk ? "Arena totals match the 6/4/2 distribution." : "";
    wrap.appendChild(msgBox);

    const finalDisplay = applyFavoredApproachDragonPlain(base, d.favoredApproach);

    const dArenasGrid = document.createElement("div");
    dArenasGrid.className = "attributes-arenas-grid";
    const dPools = dragonArenaPools(d);
    for (const arena of dragonArenaRankForDisplay(d)) {
      const sub = document.createElement("div");
      sub.className = "panel attributes-arena-panel";
      const poolN = dPools[arena] ?? 0;
      sub.innerHTML = `<h2>${arena} (${poolN} dots beyond base 1 each)</h2>`;
      for (const id of ARENAS[arena]) {
        const meta = bundle.attributes[id];
        const maxFinal = dragonMaxFinalRatingForAttr(id, base, d);
        const finalVal = finalDisplay[id] ?? 1;
        const baseFloor = { ...base, [id]: 1 };
        const minFinalDisplay = Math.min(
          applyFavoredApproachDragonPlain(baseFloor, d.favoredApproach)[id] ?? 1,
          maxFinal,
        );
        sub.appendChild(
          dragonRenderFinalAttrDotRow(
            meta.name,
            finalVal,
            maxFinal,
            (picked) => {
              const fav = d.favoredApproach;
              const approachKey = APPROACH_ATTRS[fav] ? fav : "Finesse";
              const pre = APPROACH_ATTRS[approachKey].includes(id) ? picked - 2 : picked;
              const cap = dragonMaxAttrRatingForArena(id, base, d);
              const newPre = Math.max(1, Math.min(pre, cap));
              const bl = d.finishingAttrBaseline;
              if (bl && typeof bl === "object") {
                const bump = Math.max(0, (d.attributes[id] ?? 1) - (bl[id] ?? 1));
                bl[id] = newPre;
                d.attributes[id] = Math.max(1, Math.min(5, newPre + bump));
              } else {
                d.attributes[id] = newPre;
              }
              render();
            },
            meta,
            1,
            "(after Favored Approach)",
            minFinalDisplay,
            attrLocked,
          ),
        );
      }
      dArenasGrid.appendChild(sub);
    }
    wrap.appendChild(dArenasGrid);

    const derivedRow = document.createElement("div");
    derivedRow.className = "attributes-derived-row";

    const def = originDefenseFromFinalAttrs(finalDisplay);
    const defPanel = document.createElement("div");
    defPanel.className = "panel derived-defense-panel";
    defPanel.innerHTML = `<h2>Defense</h2><p class="help"><strong>${def}</strong></p>`;
    derivedRow.appendChild(defPanel);

    const ath = Math.max(0, Math.min(5, Math.round(Number(d.skillDots?.athletics) || 0)));
    const move = originMovementPoolDice(finalDisplay, ath);
    const movePanel = document.createElement("div");
    movePanel.className = "panel derived-movement-panel";
    movePanel.innerHTML = `<h2>Movement dice</h2><p class="help"><strong>${move}</strong></p>`;
    derivedRow.appendChild(movePanel);

    wrap.appendChild(derivedRow);

    root.appendChild(panel("Attributes", wrap));
  }

  if (step === "calling") {
    rebalanceDragonCallingSlotDotsOverFive(d);
    const wrap = document.createElement("div");
    wrap.innerHTML = "";
    const slotBox = document.createElement("div");
    slotBox.className = "grid-2";
    for (let rowIdx = 0; rowIdx < 3; rowIdx += 1) {
      const slot = d.callingSlots[rowIdx];
      const fieldH = document.createElement("div");
      fieldH.className = "field field-calling-row field-calling-row--hero";
      const labH = document.createElement("label");
      labH.htmlFor = `d-call-${rowIdx}`;
      labH.textContent = `Calling ${rowIdx + 1}`;
      fieldH.appendChild(labH);
      const rowH = document.createElement("div");
      rowH.className = "calling-select-dots-row";
      const sel = document.createElement("select");
      sel.id = `d-call-${rowIdx}`;
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "—";
      sel.appendChild(blank);
      const selectedOnOtherRows = new Set();
      for (let j = 0; j < 3; j += 1) {
        if (j === rowIdx) continue;
        const oid = String(d.callingSlots[j]?.id || "").trim();
        if (oid) selectedOnOtherRows.add(oid);
      }
      const curId = String(slot.id || "").trim();
      const dragonCallingCatalogIds = dragonHeirCallingIdsWithKnackCatalog(bundle);
      const rowEntries = Object.entries(bundle.callings || {}).filter(
        ([cid, c]) =>
          !cid.startsWith("_") &&
          c &&
          typeof c === "object" &&
          dragonCallingCatalogIds.has(cid) &&
          !(selectedOnOtherRows.has(cid) && cid !== curId),
      );
      for (const [cid, c] of rowEntries) {
        const o = document.createElement("option");
        o.value = cid;
        o.textContent = c.name || cid;
        applyGameDataHint(o, c);
        sel.appendChild(o);
      }
      sel.value = curId && rowEntries.some(([cid]) => cid === curId) ? curId : "";
      sel.addEventListener("change", () => {
        d.callingSlots[rowIdx].id = sel.value || "";
        rebalanceDragonCallingSlotDotsOverFive(d);
        render();
      });
      rowH.appendChild(sel);
      const dotsWrapH = document.createElement("div");
      dotsWrapH.className = "dots calling-inline-dots";
      dotsWrapH.setAttribute("role", "radiogroup");
      const othersSum = d.callingSlots.reduce((a, s, j) => (j !== rowIdx ? a + s.dots : a), 0);
      const maxForRow = Math.min(5, Math.max(1, 5 - othersSum));
      const cdh = Math.max(1, Math.min(maxForRow, slot.dots));
      d.callingSlots[rowIdx].dots = cdh;
      dotsWrapH.setAttribute(
        "aria-label",
        `Calling ${rowIdx + 1} rating ${cdh} of 5 (five dots shared across three Callings)`,
      );
      for (let dotN = 1; dotN <= 5; dotN += 1) {
        const b = document.createElement("button");
        b.type = "button";
        const canPick = dotN >= 1 && dotN <= maxForRow;
        b.disabled = !canPick;
        const callingFloorLocked = dotN <= cdh && dotN <= 1;
        b.className =
          "dot" +
          (dotN <= cdh ? " filled" : "") +
          (b.disabled ? " dot-capped" : "") +
          (callingFloorLocked ? " dot-finishing-locked-fill" : "");
        b.setAttribute("aria-label", `Calling ${rowIdx + 1} — ${dotN} of 5`);
        if (canPick) {
          b.addEventListener("click", () => {
            d.callingSlots[rowIdx].dots = dotN;
            rebalanceDragonCallingSlotDotsOverFive(d);
            render();
          });
        }
        dotsWrapH.appendChild(b);
      }
      rowH.appendChild(dotsWrapH);
      fieldH.appendChild(rowH);
      slotBox.appendChild(fieldH);
      if (rowIdx === 0) applyHint(sel, "f-calling");
    }
    wrap.appendChild(slotBox);
    const sum = d.callingSlots.reduce((s, x) => s + x.dots, 0);
    const sumP = document.createElement("p");
    sumP.className = sum === 5 ? "help" : "warn";
    sumP.textContent = `Calling dots total: ${sum} (must be exactly 5)`;
    wrap.appendChild(sumP);

    const shell = dragonKnackShell(character);
    syncHeroKnackSlotAssignments(shell, bundle);
    d.callingKnackIds = [...(shell.knackIds || [])];
    d.knackSlotById = { ...shell.knackSlotById };

    const allCallingsPicked = d.callingSlots.every((s) => String(s?.id || "").trim());
    const HERO_CALLING_ROW_COUNT = 3;

    const knPanel = document.createElement("div");
    knPanel.className = "panel calling-knacks-panel";
    knPanel.innerHTML = `<h2>Knacks</h2>`;

    const knackEntries = Object.entries(bundle.dragonCallingKnacks || {})
      .filter(([kid]) => !kid.startsWith("_"))
      .sort((a, b) => {
        const na = String(a[1]?.name || a[0]);
        const nb = String(b[1]?.name || b[0]);
        const c = na.localeCompare(nb, undefined, { sensitivity: "base" });
        if (c !== 0) return c;
        return String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: "base" });
      });
    const finishingKnackSet = new Set(character.finishing?.finishingKnackIds || []);

    /** @param {HTMLElement} container */
    function appendDragonCallingKnackChip(container, kid, k) {
      const baseOk = knackEligible(k, shell, bundle);
      const eligible = knackEligibleForCallingStep(k, shell, bundle);
      const on = d.callingKnackIds.includes(kid);
      const slotBlocked = baseOk && !eligible && !on;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className =
        "chip" +
        (on ? " on" : "") +
        (!eligible && on ? " chip-unqualified" : "") +
        (slotBlocked ? " chip-knack-slot-blocked" : "");
      chip.disabled = slotBlocked;
      if (!eligible && on) {
        chip.title = baseOk
          ? "This Knack no longer fits your per-Calling Knack budgets on the three rows (each row’s dots cap that row’s Knacks; one Immortal uses two on a row with two+ dots; at most one Immortal overall). Adjust dots, Callings, or clear Knacks."
          : "This Knack no longer matches your Calling, tier, or optional gates—remove it or adjust your character.";
      }
      setKnackChipContents(chip, k);
      chip.addEventListener("click", () => {
        if (chip.disabled) return;
        const set = new Set(d.callingKnackIds);
        const finSet = new Set(character.finishing?.finishingKnackIds || []);
        if (set.has(kid)) set.delete(kid);
        else if (eligible && !finSet.has(kid)) set.add(kid);
        const next = [...set];
        const shTry = { ...dragonKnackShell(character), knackIds: next };
        if (!knackSetWithinCallingSlots(next, shTry, bundle)) return;
        d.callingKnackIds = next;
        const shSync = dragonKnackShell(character);
        syncHeroKnackSlotAssignments(shSync, bundle);
        d.callingKnackIds = [...(shSync.knackIds || [])];
        d.knackSlotById = { ...shSync.knackSlotById };
        render();
      });
      const appliesLine = knackAppliesToCallingsLine(k, bundle);
      applyGameDataHint(chip, k, appliesLine ? { prefix: appliesLine } : undefined);
      if (slotBlocked) {
        let gateHint =
          "You qualify for this Knack (Calling / tier / optional data gates), but none of your Calling rows can spend the Knack budget for it yet—each Heroic Knack needs one free dot on a matching row; one Immortal needs two free dots on a row with at least two dots, and you may only know one Immortal Knack.";
        if (k?.knackKind === "immortal") {
          gateHint +=
            " On a two-dot Calling row, an Immortal uses both slots—if that row already has a Heroic Knack from the same Calling, clear it (or give that Calling three dots) before an Immortal can fit.";
        } else if (k?.knackKind === "heir") {
          gateHint += " Each Dragon Heir Calling Knack spends one dot on a matching Calling row.";
        }
        chip.title = chip.title ? `${chip.title}\n\n${gateHint}` : gateHint;
      }
      if (on && shell.knackSlotById && shell.knackSlotById[kid] != null && Array.isArray(shell.callingSlots)) {
        const ri = shell.knackSlotById[kid];
        const rowId = String(shell.callingSlots[ri]?.id || "").trim();
        const rowName = (rowId && bundle.callings[rowId] && bundle.callings[rowId].name) || rowId || `row ${ri + 1}`;
        const payNote = `Charged to: ${rowName} (${ri + 1} of 3).`;
        chip.title = chip.title ? `${chip.title}\n\n${payNote}` : payNote;
      }
      container.appendChild(chip);
    }

    /** @type {Map<number | "any", [string, Record<string, unknown>][]>} */
    const buckets = new Map();
    const pushBucket = (key, pair) => {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(pair);
    };
    for (const [kid, k] of knackEntries) {
      const baseOk = knackEligible(k, shell, bundle);
      const on = d.callingKnackIds.includes(kid);
      if (!baseOk && !on) continue;
      if (!on && finishingKnackSet.has(kid)) continue;
      const tok = knackCallingTokensForRowMatch(k, shell);
      let key = /** @type {number | "any"} */ ("any");
      if (tok !== null) {
        let placed = false;
        for (let ri = 0; ri < HERO_CALLING_ROW_COUNT; ri += 1) {
          if (heroCallingRowMatchesKnack(ri, k, shell, bundle)) {
            key = ri;
            placed = true;
            break;
          }
        }
        if (!placed) key = "any";
      }
      pushBucket(key, [kid, k]);
    }
    const order = /** @type {(number | "any")[]} */ ([0, 1, 2, "any"]);
    for (const key of order) {
      const list = buckets.get(key);
      if (!list?.length) continue;
      const section = document.createElement("div");
      section.className = "calling-knack-chip-group";
      const head = document.createElement("h3");
      head.className = "calling-knack-chip-group-title";
      if (key === "any") {
        head.textContent = "Any Calling";
      } else {
        const rid = String(shell.callingSlots?.[key]?.id || "").trim();
        head.textContent = rid
          ? `${bundle.callings[rid]?.name || rid} (Calling ${key + 1})`
          : `Calling ${key + 1} — pick a Calling above`;
      }
      section.appendChild(head);
      const chipWrap = document.createElement("div");
      chipWrap.className = "chips chips--calling-knack-subgroup";
      for (const [kid, k] of list) {
        appendDragonCallingKnackChip(chipWrap, kid, k);
      }
      section.appendChild(chipWrap);
      knPanel.appendChild(section);
    }
    applyHint(knPanel, "knack-select");
    wrap.appendChild(knPanel);

    const dkPanel = document.createElement("div");
    dkPanel.className = "panel calling-knacks-panel";
    dkPanel.innerHTML = "";
    const dkSection = document.createElement("div");
    dkSection.className = "calling-knack-chip-group";
    const dkHead = document.createElement("h3");
    dkHead.className = "calling-knack-chip-group-title";
    const dkCap = dragonInheritanceWizardCaps(bundle, d.inheritance).draconicKnackLimit;
    dkHead.textContent = `Draconic Knacks (${d.draconicKnackIds.length} / ${dkCap} for Inheritance ${d.inheritance})`;
    dkSection.appendChild(dkHead);
    const dkChips = document.createElement("div");
    dkChips.className = "chips chips--calling-knack-subgroup";
    const draconicFull = d.draconicKnackIds.length >= dkCap;
    const draconicEntries = Object.entries(bundle.dragonKnacks || {})
      .filter(([kid, k]) => !kid.startsWith("_") && k && typeof k === "object")
      .sort((a, b) => {
        const na = String(a[1]?.name || a[0]);
        const nb = String(b[1]?.name || b[0]);
        const c = na.localeCompare(nb, undefined, { sensitivity: "base" });
        if (c !== 0) return c;
        return String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: "base" });
      });
    for (const [kid, k] of draconicEntries) {
      const on = d.draconicKnackIds.includes(kid);
      const cantAddDraconic = !allCallingsPicked || draconicFull;
      const draconicBlocked = !on && cantAddDraconic;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className =
        "chip" +
        (on ? " on" : "") +
        (draconicBlocked ? " chip-knack-slot-blocked" : "") +
        (!allCallingsPicked && on ? " chip-unqualified" : "");
      chip.disabled = draconicBlocked;
      setDraconicKnackChipContents(chip, k);
      chip.addEventListener("click", () => {
        if (chip.disabled) return;
        const set = new Set(d.draconicKnackIds);
        if (set.has(kid)) set.delete(kid);
        else set.add(kid);
        const next = [...set];
        if (next.length > dkCap) return;
        d.draconicKnackIds = next;
        render();
      });
      applyGameDataHint(chip, k);
      if (!allCallingsPicked && !on) {
        const gateHint =
          "Choose a Calling in each of the three rows before selecting Draconic Knacks (same “muted / disabled until you qualify” pattern as Calling Knacks above).";
        chip.title = chip.title ? `${chip.title}\n\n${gateHint}` : gateHint;
      } else if (!allCallingsPicked && on) {
        const gateHint =
          "Pick all three Callings before adding more Draconic Knacks. You can clear this pick if you need to change Callings first.";
        chip.title = chip.title ? `${chip.title}\n\n${gateHint}` : gateHint;
      } else if (draconicFull && !on) {
        const gateHint = `You already have ${dkCap} Draconic Knack(s)—clear one to pick a different Knack.`;
        chip.title = chip.title ? `${chip.title}\n\n${gateHint}` : gateHint;
      }
      dkChips.appendChild(chip);
    }
    dkSection.appendChild(dkChips);
    dkPanel.appendChild(dkSection);
    wrap.appendChild(dkPanel);
    root.appendChild(panel("Calling & Knacks", wrap));
  }

  if (step === "magic") {
    const inhCap = dragonInheritanceWizardCaps(bundle, d.inheritance);
    const knownMagicSet = new Set(d.knownMagics.filter(Boolean));
    if (d.bonusSpell?.magicId && !knownMagicSet.has(d.bonusSpell.magicId)) {
      d.bonusSpell.magicId = "";
      d.bonusSpell.spellId = "";
    }
    const wrap = document.createElement("div");
    wrap.innerHTML = "";

    const sigPanel = document.createElement("div");
    sigPanel.className = "panel";
    sigPanel.innerHTML =
      "<h2>Signature Flight Magic</h2><p class=\"help\">Locked from your Flight; change it on the Flights step if needed.</p>";
    const sigChips = document.createElement("div");
    sigChips.className = "chips";
    const midSig = d.knownMagics[0];
    const magSig = midSig ? bundle.dragonMagic?.[midSig] : null;
    if (midSig && magSig && typeof magSig === "object") {
      const sigChip = document.createElement("span");
      sigChip.className = "chip on";
      sigChip.style.cursor = "default";
      sigChip.tabIndex = 0;
      sigChip.setAttribute("role", "note");
      sigChip.setAttribute("aria-label", `Signature Magic (from Flight): ${magSig.name || midSig}`);
      sigChip.textContent = magSig.name || midSig;
      applyGameDataHint(sigChip, magSig);
      sigChips.appendChild(sigChip);
    } else {
      const pending = document.createElement("span");
      pending.className = "help";
      pending.textContent = "Pick a Flight on the Flights step to set your signature Magic.";
      sigChips.appendChild(pending);
    }
    sigPanel.appendChild(sigChips);
    wrap.appendChild(sigPanel);

    const pickPanel = document.createElement("div");
    pickPanel.className = "panel";
    pickPanel.innerHTML =
      "<h2>Second &amp; third Dragon Magic</h2><p class=\"help\">One chip per Magic; pick a different Magic in each row (hover for description and source).</p>";
    for (let slot = 1; slot <= 2; slot += 1) {
      const field = document.createElement("div");
      field.className = "field";
      const lab = document.createElement("label");
      lab.textContent = slot === 1 ? "Second Magic" : "Third Magic";
      const chips = document.createElement("div");
      chips.className = "chips";
      const otherSlot = slot === 1 ? 2 : 1;
      const taken = new Set([d.knownMagics[0], d.knownMagics[otherSlot]].filter(Boolean));
      const secondaryExcluded = dragonMagicIdsExcludedFromSecondaryKnownSlots(bundle, d.flightId);
      for (const [mid, m] of dragonMagicEntriesSorted(bundle)) {
        if (taken.has(mid)) continue;
        if (secondaryExcluded.has(mid)) continue;
        const cur = String(d.knownMagics[slot] || "").trim();
        const on = cur === mid;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (on ? " on" : "");
        chip.textContent = m.name || mid;
        applyGameDataHint(chip, m);
        chip.addEventListener("click", () => {
          const prev = String(d.knownMagics[slot] || "").trim();
          if (prev === mid) {
            d.knownMagics[slot] = "";
            delete d.spellsByMagicId[mid];
          } else {
            if (prev) delete d.spellsByMagicId[prev];
            d.knownMagics[slot] = mid;
          }
          render();
        });
        chips.appendChild(chip);
      }
      field.appendChild(lab);
      field.appendChild(chips);
      pickPanel.appendChild(field);
    }
    wrap.appendChild(pickPanel);

    const spellPanel = document.createElement("div");
    spellPanel.className = "panel";
    const spH = document.createElement("h2");
    spH.textContent = "Spells";
    spellPanel.appendChild(spH);
    const spHelp = document.createElement("p");
    spHelp.className = "help";
    spHelp.innerHTML =
      "One Spell per known Magic. <strong>Chips</strong> show the spell name only — hover a chip for Cost, Duration, Subject, summary, and book citation (same hover pattern as Magic and Knack chips above).";
    spellPanel.appendChild(spHelp);
    for (let i = 0; i < 3; i += 1) {
      const mid = d.knownMagics[i];
      if (!mid) continue;
      const mag = bundle.dragonMagic?.[mid];
      const sub = document.createElement("div");
      sub.className = "field dragon-wizard-spell-block";
      const lab = document.createElement("label");
      lab.textContent = `Spells for ${mag?.name || mid}`;
      const row = document.createElement("div");
      row.className = "chips";
      const spells = Array.isArray(mag?.spells) ? mag.spells : [];
      const curSpell = String(d.spellsByMagicId[mid] || "").trim();
      for (const sp of spells) {
        if (!sp?.id) continue;
        const on = curSpell === sp.id;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (on ? " on" : "");
        chip.textContent = sp.name || sp.id;
        applyGameDataHint(chip, dragonSpellChipHintEntity(sp, mag));
        chip.addEventListener("click", () => {
          d.spellsByMagicId[mid] = on ? "" : sp.id;
          render();
        });
        row.appendChild(chip);
      }
      sub.appendChild(lab);
      sub.appendChild(row);
      spellPanel.appendChild(sub);
    }

    const bonusWrap = document.createElement("div");
    bonusWrap.className = "field dragon-bonus-spell-field";
    const bonusLab = document.createElement("label");
    bonusLab.textContent = "Bonus Spell (choose Magic, then Spell)";
    bonusWrap.appendChild(bonusLab);
    const bonusMagicRow = document.createElement("div");
    bonusMagicRow.className = "chips dragon-bonus-spell-magic-chips";
    const known = d.knownMagics.filter(Boolean);
    const bonusMid = String(d.bonusSpell?.magicId || "").trim();
    for (const mid of known) {
      const bm = bundle.dragonMagic?.[mid];
      if (!bm || typeof bm !== "object") continue;
      const on = bonusMid === mid;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (on ? " on" : "");
      chip.textContent = bm.name || mid;
      applyGameDataHint(chip, bm);
      chip.addEventListener("click", () => {
        if (bonusMid === mid) {
          d.bonusSpell.magicId = "";
          d.bonusSpell.spellId = "";
        } else {
          d.bonusSpell.magicId = mid;
          d.bonusSpell.spellId = "";
        }
        render();
      });
      bonusMagicRow.appendChild(chip);
    }
    bonusWrap.appendChild(bonusMagicRow);
    const bonusSpellsHead = document.createElement("h3");
    bonusSpellsHead.className = "dragon-bonus-spell-spells-head";
    bonusSpellsHead.textContent = "Bonus Spell";
    bonusWrap.appendChild(bonusSpellsHead);
    const bonusSpellRow = document.createElement("div");
    bonusSpellRow.className = "chips dragon-bonus-spell-spell-chips";
    const bMag = bonusMid ? bundle.dragonMagic?.[bonusMid] : null;
    /** Spell ids already taken as the one primary Spell per known Magic — bonus must be a different spell. */
    const primarySpellIdsChosen = new Set();
    for (const km of known) {
      const ps = String(d.spellsByMagicId[km] || "").trim();
      if (ps) primarySpellIdsChosen.add(ps);
    }
    let bonusSpellId = String(d.bonusSpell?.spellId || "").trim();
    if (bonusSpellId && primarySpellIdsChosen.has(bonusSpellId)) {
      d.bonusSpell.spellId = "";
      bonusSpellId = "";
    }
    if (bonusMid && bMag && typeof bMag === "object") {
      const spellList = Array.isArray(bMag.spells) ? bMag.spells : [];
      for (const sp of spellList) {
        if (!sp?.id) continue;
        if (primarySpellIdsChosen.has(sp.id) && sp.id !== bonusSpellId) continue;
        const on = bonusSpellId === sp.id;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (on ? " on" : "");
        chip.textContent = sp.name || sp.id;
        applyGameDataHint(chip, dragonSpellChipHintEntity(sp, bMag));
        chip.addEventListener("click", () => {
          d.bonusSpell.spellId = on ? "" : sp.id;
          render();
        });
        bonusSpellRow.appendChild(chip);
      }
      const spellsWithIds = spellList.filter((s) => s?.id);
      if (spellsWithIds.length && !bonusSpellRow.children.length) {
        const emptyHint = document.createElement("p");
        emptyHint.className = "help";
        emptyHint.textContent =
          "Every spell listed for this Magic is already your primary Spell for it — pick a different Magic for your bonus, or change a primary Spell above.";
        bonusSpellRow.appendChild(emptyHint);
      }
    }
    bonusWrap.appendChild(bonusSpellRow);
    spellPanel.appendChild(bonusWrap);

    if (inhCap.advancementSpellSlots > 0) {
      const mileWrap = document.createElement("div");
      mileWrap.className = "panel dragon-milestone-spells-panel";
      const mh = document.createElement("h2");
      mh.textContent = "Inheritance milestone spells";
      mileWrap.appendChild(mh);
      const mh2 = document.createElement("p");
      mh2.className = "help";
      mh2.innerHTML = `Your current Inheritance grants <strong>${inhCap.advancementSpellSlots}</strong> extra spell pick(s) (choose Magic from your three known, then a Spell — Dragon pp. 117–119).`;
      mileWrap.appendChild(mh2);
      const knownM = d.knownMagics.filter(Boolean).map((x) => String(x ?? "").trim()).filter(Boolean);
      for (let i = 0; i < d.advancementSpells.length; i += 1) {
        const sub = document.createElement("div");
        sub.className = "field dragon-wizard-spell-block";
        const lab = document.createElement("label");
        lab.textContent = `Milestone spell ${i + 1}`;
        const magicRow = document.createElement("div");
        magicRow.className = "chips";
        for (const midRaw of knownM) {
          const mid = String(midRaw ?? "").trim();
          if (!mid) continue;
          const m = bundle.dragonMagic?.[mid];
          if (!m || typeof m !== "object") continue;
          const rowNow = () => d.advancementSpells[i];
          const onM = String(rowNow()?.magicId || "").trim() === mid;
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chip" + (onM ? " on" : "");
          b.textContent = m.name || mid;
          applyGameDataHint(b, m);
          b.addEventListener("click", () => {
            const r = d.advancementSpells[i];
            if (!r) return;
            const selected = String(r.magicId || "").trim() === mid;
            if (selected) {
              r.magicId = "";
              r.spellId = "";
            } else {
              r.magicId = mid;
              r.spellId = "";
            }
            render();
          });
          magicRow.appendChild(b);
        }
        const spellLab = document.createElement("div");
        spellLab.className = "help";
        spellLab.style.marginTop = "0.35rem";
        spellLab.textContent = "Spell";
        const spellRow = document.createElement("div");
        spellRow.className = "chips";
        const rowForSpellUi = d.advancementSpells[i];
        const pickMid = String(rowForSpellUi?.magicId || "").trim();
        const bMagM = pickMid ? bundle.dragonMagic?.[pickMid] : null;
        const curSp = String(rowForSpellUi?.spellId || "").trim();
        const primaryForMagic = String(d.spellsByMagicId[pickMid] || "").trim();
        const takenAdv = new Set();
        for (let j = 0; j < d.advancementSpells.length; j += 1) {
          if (i === j) continue;
          const other = d.advancementSpells[j];
          if (String(other?.magicId || "").trim() === pickMid && String(other?.spellId || "").trim()) {
            takenAdv.add(String(other.spellId).trim());
          }
        }
        if (pickMid && bMagM && typeof bMagM === "object") {
          const spellList = Array.isArray(bMagM.spells) ? bMagM.spells : [];
          for (const sp of spellList) {
            if (!sp?.id) continue;
            const spid = String(sp.id).trim();
            if (!spid) continue;
            if (spid === primaryForMagic) continue;
            if (takenAdv.has(spid)) continue;
            const onS = curSp === spid;
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "chip" + (onS ? " on" : "");
            chip.textContent = sp.name || sp.id;
            applyGameDataHint(chip, dragonSpellChipHintEntity(sp, bMagM));
            chip.addEventListener("click", () => {
              const r = d.advancementSpells[i];
              if (!r) return;
              const cur = String(r.spellId || "").trim();
              r.spellId = cur === spid ? "" : spid;
              render();
            });
            spellRow.appendChild(chip);
          }
        }
        sub.appendChild(lab);
        sub.appendChild(magicRow);
        sub.appendChild(spellLab);
        sub.appendChild(spellRow);
        mileWrap.appendChild(sub);
      }
      spellPanel.appendChild(mileWrap);
    }

    wrap.appendChild(spellPanel);

    root.appendChild(panel("Magic", wrap));
  }

  if (step === "birthrights") {
    const wrap = document.createElement("div");
    appendDragonHeirBirthrightDeityStyleBlock(wrap, bundle, character, "birthrightPicks", 7, render);
    root.appendChild(panel("Birthrights", wrap));
  }

  if (step === "finishing") {
    ensureDragonShape(character, bundle);
    ensureDragonFinishingAttrBaseline(d, bundle);
    const pathOnly = applyDragonPathMathToSkillDots(d, bundle);
    const wrap = document.createElement("div");
    const intro = document.createElement("p");
    intro.className = "help";
    intro.innerHTML =
      "<strong>Dragon p. 112 — Finishing Touches:</strong> spend <em>five extra Skill dots</em> and <em>one extra Attribute dot</em> below (same layout as the Deity / Titan Finishing step), then either <em>two extra Calling Knacks</em> or <em>four Birthright dots</em>. Record Deed Name, Remembrances, Health, Defense, and Movement on your sheet.";
    wrap.appendChild(intro);

    const budget = document.createElement("div");
    budget.className = "wizard-triple-field-row finishing-budget-row";
    budget.innerHTML = `
    <div class="field"><label>Extra skill dots (budget)</label><input type="number" id="d-fin-skill" min="0" max="20" value="5" readonly title="Dragon Heir: fixed +5 Skill dots at this milestone (Dragon p. 112)." /></div>
    <div class="field"><label>Extra attribute dot(s) (budget)</label><input type="number" id="d-fin-attr" min="0" max="10" value="1" readonly title="Dragon Heir: fixed +1 Attribute dot (Dragon p. 112)." /></div>
    <div class="field"><label>Knacks vs Birthrights</label>
      <select id="d-fin-focus">
        <option value="birthrights">Four Birthright dots</option>
        <option value="knacks">Two extra Knacks</option>
      </select>
    </div>`;
    wrap.appendChild(budget);
    const finFocusEl = /** @type {HTMLSelectElement | null} */ (wrap.querySelector("#d-fin-focus"));
    if (finFocusEl) {
      finFocusEl.value = d.finishingFocus === "birthrights" ? "birthrights" : "knacks";
      finFocusEl.addEventListener("change", () => {
        d.finishingFocus = finFocusEl.value === "birthrights" ? "birthrights" : "knacks";
        render();
      });
      applyHint(finFocusEl, "fin-focus");
    }

    const placedSk = dragonFinishingBonusTotal(d);
    const remSk = Math.max(0, 5 - placedSk);
    const placedAt = dragonFinishingAttrDotsPlaced(d, bundle);
    const remAt = dragonFinishingAttrDotsRemaining(d, bundle);
    const overSk = placedSk > 5;
    const overAt = placedAt > 1;
    const sum = document.createElement("p");
    sum.className = "help finishing-budget-summary";
    sum.textContent = `Skill finishing: ${placedSk} / 5 dots placed (${remSk} remaining). Attribute finishing: ${placedAt} / 1 dot(s) placed (${remAt} remaining).`;
    wrap.appendChild(sum);
    if (overSk || overAt) {
      const w = document.createElement("p");
      w.className = "warn";
      w.textContent =
        (overSk ? "Placed skill finishing dots exceed the budget — lower Skills in the table below. " : "") +
        (overAt ? "Placed attribute finishing exceeds the budget — lower Attributes below." : "");
      wrap.appendChild(w);
    }

    const missingSpec = dragonSkillIdsMissingChargenSpecialties(d, bundle);
    if (missingSpec.length > 0) {
      const gateBox = document.createElement("div");
      gateBox.className = "skills-gate-errors";
      gateBox.setAttribute("role", "alert");
      const gt = document.createElement("p");
      gt.className = "skills-gate-errors-title";
      gt.textContent = "Fix the following before leaving Finishing:";
      gateBox.appendChild(gt);
      const ul = document.createElement("ul");
      for (const sid of missingSpec) {
        const li = document.createElement("li");
        li.textContent = `${bundle.skills?.[sid]?.name || sid} is at 3 or more dots — enter a Specialty in the Skills table below.`;
        ul.appendChild(li);
      }
      gateBox.appendChild(ul);
      wrap.appendChild(gateBox);
    }

    const skPanel = document.createElement("section");
    skPanel.className =
      "panel finishing-place-panel" + (overSk || missingSpec.length > 0 ? " panel-gate-invalid" : "");
    skPanel.innerHTML = "<h2>Skills — spend finishing dots</h2>";
    const { left: dFinSkLeft, right: dFinSkRight } = skillIdsSplitForSkillsTables(bundle);
    const dFinSkTwoCol = document.createElement("div");
    dFinSkTwoCol.className = "skill-ratings-two-cols";

    function appendDragonFinishingSkillsTable(skillIdList) {
      const skTable = document.createElement("table");
      skTable.className = "skill-ratings-table finishing-skills-table";
      appendSkillRatingsTableThead(skTable);
      const skBody = document.createElement("tbody");
      for (const sid of skillIdList) {
        const s = bundle.skills[sid];
        const val = Math.max(0, Math.min(5, Math.round(Number(d.skillDots[sid]) || 0)));
        const tr = document.createElement("tr");
        tr.className =
          "skill-rating-row" + (missingSpec.includes(sid) ? " skill-rating-row--gate-invalid" : "");
        appendDragonSkillRatingNameCell(tr, sid, s, val, d, { skillsTableSpecialty: true });
        appendDragonFinishingSkillDotsCell(tr, sid, s, val, d, bundle, character, pathOnly, render);
        skBody.appendChild(tr);
      }
      skTable.appendChild(skBody);
      dFinSkTwoCol.appendChild(skTable);
    }
    appendDragonFinishingSkillsTable(dFinSkLeft);
    appendDragonFinishingSkillsTable(dFinSkRight);
    skPanel.appendChild(dFinSkTwoCol);
    wrap.appendChild(skPanel);

    const atPanel = document.createElement("section");
    atPanel.className = "panel finishing-place-panel" + (overAt ? " panel-gate-invalid" : "");
    const atH = document.createElement("h2");
    atH.textContent = "Attributes — spend finishing dot(s)";
    atPanel.appendChild(atH);
    const atHelp = document.createElement("p");
    atHelp.className = "help";
    atHelp.textContent = "Dragon p. 112: one extra Attribute dot at this milestone. It must be spent on an Attribute (not banked).";
    atPanel.appendChild(atHelp);
    const finAttrBase = {};
    for (const id of Object.keys(bundle.attributes || {})) {
      if (String(id).startsWith("_")) continue;
      finAttrBase[id] = d.attributes[id] ?? 1;
    }
    const finAttrFinal = applyFavoredApproachDragonPlain(finAttrBase, d.favoredApproach);
    const dragonFinArenasGrid = document.createElement("div");
    dragonFinArenasGrid.className = "attributes-arenas-grid";
    const finPools = dragonArenaPools(d);
    for (const arena of dragonArenaRankForDisplay(d)) {
      const sub = document.createElement("div");
      sub.className = "panel attributes-arena-panel";
      const poolN = finPools[arena] ?? 0;
      sub.innerHTML = `<h2>${arena} (${poolN} dots beyond base 1 each)</h2>`;
      for (const id of ARENAS[arena]) {
        const meta = bundle.attributes[id];
        if (!meta || String(id).startsWith("_")) continue;
        const maxFinal = maxDragonFinalAttrFinishing(id, d, bundle);
        const finalVal = finAttrFinal[id] ?? 1;
        const snap = d.finishingAttrBaseline?.[id];
        const baselinePre =
          snap != null ? Math.max(1, Math.min(5, Math.round(Number(snap)))) : (finAttrBase[id] ?? 1);
        const attrsLockedPre = { ...finAttrBase, [id]: baselinePre };
        const finalLockedThrough = Math.min(
          applyFavoredApproachDragonPlain(attrsLockedPre, d.favoredApproach)[id] ?? 1,
          maxFinal,
        );
        sub.appendChild(
          dragonRenderFinalAttrDotRow(
            meta.name,
            finalVal,
            maxFinal,
            (picked) => {
              const fav = d.favoredApproach;
              const approachKey = APPROACH_ATTRS[fav] ? fav : "Finesse";
              let pre = APPROACH_ATTRS[approachKey].includes(id) ? picked - 2 : picked;
              const minPre = d.finishingAttrBaseline?.[id] ?? 1;
              const maxPre = maxDragonAttrFinishing(id, d, bundle);
              d.attributes[id] = Math.max(minPre, Math.min(pre, maxPre));
              render();
            },
            meta,
            1,
            "(after Favored Approach)",
            finalLockedThrough,
          ),
        );
      }
      dragonFinArenasGrid.appendChild(sub);
    }
    atPanel.appendChild(dragonFinArenasGrid);
    wrap.appendChild(atPanel);

    const knBr = document.createElement("section");
    knBr.className = "panel finishing-place-panel";
    if (d.finishingFocus === "knacks") {
      const shell = dragonKnackShell(character);
      syncHeroKnackSlotAssignments(shell, bundle);
      d.callingKnackIds = [...(shell.knackIds || [])];
      d.knackSlotById = { ...shell.knackSlotById };
      knBr.innerHTML = `<h2>Extra Knacks (pick up to 2)</h2>`;
      const finChips = document.createElement("div");
      finChips.className = "chips";
      const baseSet = new Set(d.callingKnackIds);
      const finUniq = [...new Set(d.finishingCallingKnackIds || [])];
      const finEntries = Object.entries(bundle.dragonCallingKnacks || {})
        .filter(([kid]) => !kid.startsWith("_") && !baseSet.has(kid))
        .filter(([_, k]) => knackEligible(k, shell, bundle))
        .sort((a, b) => {
          const na = String(a[1]?.name || a[0]);
          const nb = String(b[1]?.name || b[0]);
          const c = na.localeCompare(nb, undefined, { sensitivity: "base" });
          if (c !== 0) return c;
          return String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: "base" });
        });
      for (const [kid, k] of finEntries) {
        const on = d.finishingCallingKnackIds.includes(kid);
        const atFinCap = finUniq.length >= 2 && !on;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (on ? " on" : "");
        chip.disabled = Boolean(!on && atFinCap);
        if (chip.disabled) chip.title = "Remove a Finishing Knack pick first (maximum two extra Knacks).";
        setKnackChipContents(chip, k);
        chip.addEventListener("click", () => {
          if (chip.disabled) return;
          const set = new Set(d.finishingCallingKnackIds);
          if (set.has(kid)) set.delete(kid);
          else set.add(kid);
          const next = [...set];
          if (next.length > 2) return;
          d.finishingCallingKnackIds = next;
          render();
        });
        applyGameDataHint(chip, k);
        finChips.appendChild(chip);
      }
      knBr.appendChild(finChips);
    } else {
      knBr.innerHTML = `<h2>Birthrights (four dots)</h2>`;
      appendDragonHeirBirthrightDeityStyleBlock(knBr, bundle, character, "finishingBirthrightPicks", 4, render, {
        compact: true,
      });
    }
    wrap.appendChild(knBr);

    const deed = document.createElement("div");
    deed.className = "field dragon-finishing-deed-field";
    const deedLab = document.createElement("label");
    deedLab.htmlFor = "d-deed-name";
    deedLab.textContent = "Draconic deed name";
    deed.appendChild(deedLab);
    const deedNote = document.createElement("p");
    deedNote.className = "help dragon-finishing-deed-note";
    deedNote.innerHTML =
      "This is the <strong>name or short title</strong> of your Heir’s <strong>Draconic</strong> deed—the slot the Dragon sheet tracks beside your <strong>worldly</strong> deeds from Concept (short-term, long-term, Brood; <cite>Scion: Dragon</cite> p. 110, same structure as Origin Deeds). Enter it here at <strong>Finishing</strong> because chargen tells you to record it with your other finishing notes (<cite>Scion: Dragon</cite> p. 112). It prints on the Heir sheet’s <strong>Deed names</strong> block (first line) and on the MrGone Dragon PDF.";
    deed.appendChild(deedNote);
    const ta = document.createElement("textarea");
    ta.id = "d-deed-name";
    ta.rows = 5;
    ta.spellcheck = true;
    ta.autocomplete = "off";
    ta.placeholder = "e.g. “Hoard the river’s echo”; “Wake the brood-song under the city”…";
    ta.value = d.deedName || "";
    ta.addEventListener("input", () => {
      d.deedName = ta.value;
    });
    deed.appendChild(ta);
    applyHint(ta, "d-deed-name");
    wrap.appendChild(deed);

    appendDragonFinishingSheetAppendix(wrap, character, bundle, render);

    const skBudgetEl = /** @type {HTMLElement | null} */ (wrap.querySelector("#d-fin-skill"));
    const atBudgetEl = /** @type {HTMLElement | null} */ (wrap.querySelector("#d-fin-attr"));
    if (skBudgetEl) applyHint(skBudgetEl, "fin-skill");
    if (atBudgetEl) applyHint(atBudgetEl, "fin-attr");

    root.appendChild(panel("Finishing Touches", wrap));
  }

  if (step === "review") {
    persistDragonFromDom(character, bundle, "review");
    const tierMeta = bundle.tier?.[character.tier];
    const exportData = {
      tier: character.tier,
      tierId: character.tier,
      tierName: tierMeta?.name || character.tier,
      tierAlsoKnownAs: tierMeta?.alsoKnownAs || "",
      characterName: character.characterName ?? "",
      concept: character.concept,
      deeds: character.deeds,
      notes: character.notes ?? "",
      ...buildDragonReviewSnapshot(character, bundle),
    };

    const wrap = document.createElement("div");
    wrap.className = "review-wrap";

    const toolbar = document.createElement("div");
    toolbar.className = "review-toolbar";
    const lab = document.createElement("span");
    lab.className = "help";
    lab.style.marginRight = "0.35rem";
    lab.textContent = "View:";
    const btnSheet = document.createElement("button");
    btnSheet.type = "button";
    btnSheet.className = dragonReviewViewMode === "sheet" ? "btn primary" : "btn secondary";
    btnSheet.textContent = "Character sheet";
    const btnJson = document.createElement("button");
    btnJson.type = "button";
    btnJson.className = dragonReviewViewMode === "json" ? "btn primary" : "btn secondary";
    btnJson.textContent = "JSON";
    const btnPrint = document.createElement("button");
    btnPrint.type = "button";
    btnPrint.className = "btn secondary review-print-btn";
    btnPrint.textContent = "Print sheet";
    btnPrint.title = "Print the character sheet (browser print dialog).";

    const btnThisSheetPdf = document.createElement("button");
    btnThisSheetPdf.type = "button";
    btnThisSheetPdf.className = "btn secondary";
    btnThisSheetPdf.textContent = "Download This Sheet";
    btnThisSheetPdf.title =
      "PDF from the on-screen sheet via headless Chromium when available (see server Playwright setup). Not the MrGone AcroForm file.";
    btnThisSheetPdf.addEventListener("click", async () => {
      persistDragonFromDom(character, bundle, "review");
      const el = wrap.querySelector(".review-sheet-panel.character-sheet");
      const nm = String(character.characterName ?? "").trim() || "character";
      btnThisSheetPdf.disabled = true;
      try {
        if (!el) throw new Error("Character sheet is not visible. Switch to Character sheet view and try again.");
        await downloadReviewSheetAsPdf(el, nm);
      } catch (e) {
        console.error(e);
        window.alert(e instanceof Error ? e.message : String(e));
      } finally {
        btnThisSheetPdf.disabled = false;
      }
    });

    toolbar.appendChild(lab);
    toolbar.appendChild(btnSheet);
    toolbar.appendChild(btnJson);
    toolbar.appendChild(btnPrint);
    toolbar.appendChild(btnThisSheetPdf);
    wrap.appendChild(toolbar);

    const sheet = buildCharacterSheet(exportData, bundle);
    sheet.classList.add("review-sheet-panel");
    sheet.hidden = dragonReviewViewMode !== "sheet";
    wrap.appendChild(sheet);

    const pre = document.createElement("pre");
    pre.className = "mono review-json-panel";
    pre.hidden = dragonReviewViewMode !== "json";
    pre.textContent = JSON.stringify(exportData, null, 2);
    wrap.appendChild(pre);

    const inhCur = Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(d.inheritance) || 1)));
    const inhTrackRow = bundle?.dragonTier?.inheritanceTrack?.[String(inhCur)];
    const canAdvanceInh = inhCur < DRAGON_INHERITANCE_MAX;
    const nextInh = canAdvanceInh ? inhCur + 1 : null;
    const nextTrackRow = nextInh != null ? bundle?.dragonTier?.inheritanceTrack?.[String(nextInh)] : null;
    const statusLine = `Inheritance ${inhCur}: ${inhTrackRow?.name || "—"}${inhTrackRow?.band ? ` (${inhTrackRow.band})` : ""}`;

    const inhAdvRow = document.createElement("div");
    inhAdvRow.className = "review-advance-row";
    const btnInhAdv = document.createElement("button");
    btnInhAdv.type = "button";
    btnInhAdv.className = "btn secondary";
    btnInhAdv.id = "btn-dragon-advance-inheritance";
    btnInhAdv.title = statusLine;
    if (!canAdvanceInh) {
      btnInhAdv.disabled = true;
      btnInhAdv.textContent = "Already at peak Inheritance";
    } else {
      btnInhAdv.textContent = `Advance to Inheritance ${nextInh} — ${nextTrackRow?.name || "—"}`;
    }
    btnInhAdv.addEventListener("click", () => {
      if (nextInh == null) return;
      const fromN = inhTrackRow?.name || String(inhCur);
      const toN = nextTrackRow?.name || String(nextInh);
      const curCaps = dragonInheritanceWizardCaps(bundle, inhCur);
      const nextCaps = dragonInheritanceWizardCaps(bundle, nextInh);
      const dSpell = nextCaps.advancementSpellSlots - curCaps.advancementSpellSlots;
      const dKn = nextCaps.draconicKnackLimit - curCaps.draconicKnackLimit;
      const unlockParts = [];
      if (dSpell > 0) unlockParts.push(`${dSpell} milestone spell pick(s) on the Magic step`);
      if (dKn > 0) unlockParts.push(`${dKn} Draconic Knack slot(s) on Calling & Knacks`);
      const unlockLine =
        unlockParts.length > 0
          ? `\n\nThis wizard will open: ${unlockParts.join("; ")}.`
          : "";
      const msg = `Advance from Inheritance ${inhCur} (${fromN}) to ${nextInh} (${toN})?\n\nApply milestone rewards per Scion: Dragon (pp. 117–119); confirm timing and limits with your Storyguide.${unlockLine}`;
      if (!window.confirm(msg)) return;
      d.inheritance = nextInh;
      ensureDragonShape(character, bundle);
      const landOn = firstDragonHeirStepAfterInheritanceAdvance(bundle, character, inhCur, nextInh);
      navigateToDragonHeirStep?.(landOn);
      render();
      scrollStepIntoView?.();
    });
    applyHint(btnInhAdv, "dragon-inheritance-advance");
    btnInhAdv.title = `${statusLine}\n\n${btnInhAdv.title}`;
    inhAdvRow.appendChild(btnInhAdv);
    wrap.appendChild(inhAdvRow);

    const applyView = () => {
      btnSheet.className = dragonReviewViewMode === "sheet" ? "btn primary" : "btn secondary";
      btnJson.className = dragonReviewViewMode === "json" ? "btn primary" : "btn secondary";
      sheet.hidden = dragonReviewViewMode !== "sheet";
      pre.hidden = dragonReviewViewMode !== "json";
    };

    btnSheet.addEventListener("click", () => {
      dragonReviewViewMode = "sheet";
      applyView();
    });
    btnJson.addEventListener("click", () => {
      dragonReviewViewMode = "json";
      applyView();
    });
    btnPrint.addEventListener("click", () => {
      const runPrint = () => window.print();
      if (dragonReviewViewMode !== "sheet") {
        dragonReviewViewMode = "sheet";
        applyView();
        requestAnimationFrame(() => {
          requestAnimationFrame(runPrint);
        });
        return;
      }
      runPrint();
    });

    root.appendChild(panel("Review / Export", wrap));
  }
}

/**
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 * @param {string | undefined} explicitStep current main-wizard step id (e.g. `"paths"`) when `d.stepIndex` is not authoritative
 */
export function persistDragonFromDom(character, bundle, explicitStep) {
  if (!isDragonHeirChargen(character)) return;
  ensureDragonShape(character, bundle);
  const d = character.dragon;
  const mainFl = document.getElementById("p-dragon-flight");
  if (mainFl && mainFl.value) {
    d.flightId = mainFl.value;
  }
  const stepList = dragonHeirPostConceptStepList(character);
  const step = explicitStep ?? (stepList[d.stepIndex] || "paths");
  if (step === "paths") {
    const po = document.getElementById("d-p-origin") ?? document.getElementById("p-origin");
    const pr = document.getElementById("d-p-role") ?? document.getElementById("p-role");
    const pf = document.getElementById("d-p-flight") ?? document.getElementById("p-soc");
    if (po) d.paths.origin = po.value ?? d.paths.origin;
    if (pr) d.paths.role = pr.value ?? d.paths.role;
    if (pf) d.paths.flight = pf.value ?? d.paths.flight;
    const fv = document.getElementById("d-flight")?.value;
    if (fv != null && fv !== "") d.flightId = fv;
  }
  if (step === "attributes") {
    for (let idx = 0; idx < 3; idx += 1) {
      const el = document.getElementById(`d-arena-rank-${idx}`);
      if (el?.value) d.arenaRank[idx] = el.value;
    }
    const fav = document.getElementById("d-favored")?.value;
    if (fav && APPROACH_ATTRS[fav]) d.favoredApproach = fav;
  }
  if (step === "finishing") {
    const ff = document.getElementById("d-fin-focus")?.value;
    if (ff === "knacks" || ff === "birthrights") d.finishingFocus = ff;
    d.deedName = document.getElementById("d-deed-name")?.value ?? d.deedName;
    persistFatebindingEditorRowFromDom(character, "d-fin-fb");
    const sn = document.getElementById("d-fin-sheet-notes");
    if (sn) character.sheetNotesExtra = sn.value;
  }
  if (step === "magic") {
    d.bonusSpell = d.bonusSpell || {};
    d.bonusSpell.magicId = document.getElementById("d-bonus-magic")?.value ?? d.bonusSpell.magicId;
    d.bonusSpell.spellId = document.getElementById("d-bonus-spell")?.value ?? d.bonusSpell.spellId;
  }
  const flSync = bundle?.dragonFlights?.[String(d.flightId || "").trim()];
  if (flSync?.signatureMagicId && Array.isArray(d.knownMagics)) {
    d.knownMagics[0] = String(flSync.signatureMagicId);
  }
  sanitizeDragonSecondaryKnownMagics(d, bundle);
  syncDragonFlightPathRequiredSkills(d, bundle);
  void bundle;
}

/**
 * Flatten Heir state for JSON export / review (Scion wizard `buildExportObject` merges this when `chargenLineage` is dragon).
 * @param {Record<string, unknown>} character
 * @param {Record<string, unknown>} bundle
 */
export function buildDragonReviewSnapshot(character, bundle) {
  ensureDragonShape(character, bundle);
  const d = character.dragon;
  applyDragonPathMathToSkillDots(d, bundle);
  const skillsStep = {};
  for (const sid of skillIds(bundle)) {
    const fin = Math.max(0, Math.round(Number(d.finishingSkillBonus?.[sid]) || 0));
    skillsStep[sid] = Math.max(0, Math.min(5, (d.skillDots[sid] || 0) - fin));
  }
  const fullPreAttrs = {};
  for (const id of Object.keys(bundle.attributes || {})) {
    if (String(id).startsWith("_")) continue;
    fullPreAttrs[id] = Math.max(1, Math.min(5, Math.round(Number(d.attributes[id] ?? 1))));
  }
  const bl = d.finishingAttrBaseline;
  const stepPre = {};
  if (bl && typeof bl === "object") {
    for (const id of Object.keys(bundle.attributes || {})) {
      if (String(id).startsWith("_")) continue;
      const v = Math.round(Number(bl[id]));
      stepPre[id] = Number.isFinite(v) ? Math.max(1, Math.min(5, v)) : fullPreAttrs[id];
    }
  } else {
    Object.assign(stepPre, fullPreAttrs);
  }
  const attrsAfterFavoredStep = applyFavoredApproachDragonPlain(stepPre, d.favoredApproach);
  const finAttrs = applyFavoredToDragonAttrs(d);
  const ath = Math.max(0, Math.min(5, Math.round(Number(d.skillDots?.athletics) || 0)));
  const fl = bundle?.dragonFlights?.[d.flightId];
  const inh = bundle?.dragonTier?.inheritanceTrack?.[String(d.inheritance ?? 1)];
  let dragonBlob;
  try {
    dragonBlob = JSON.parse(JSON.stringify(d));
  } catch {
    dragonBlob = { ...d };
  }
  return {
    chargenLineage: "dragonHeir",
    trackTierLabel: "Dragon Heir",
    inheritance: d.inheritance,
    inheritanceMilestone: inh?.name || "",
    inheritanceBand: inh?.band || "",
    flightId: d.flightId,
    flightName: fl?.name || "",
    skills: skillsStep,
    skillsIncludingFinishing: { ...d.skillDots },
    skillSpecialties: { ...d.skillSpecialties },
    attributesBeforeFavored: stepPre,
    attributesAfterFavored: attrsAfterFavoredStep,
    attributesIncludingFinishingBeforeFavored: fullPreAttrs,
    arenaPriority: [...d.arenaRank],
    favoredApproach: d.favoredApproach,
    defense: originDefenseFromFinalAttrs(finAttrs),
    movementDice: originMovementPoolDice(finAttrs, ath),
    sheetEquipmentIds: [...(character.sheetEquipmentIds || [])],
    fatebindings: trimTrailingEmptyFatebindings(character.fatebindings),
    sheetNotesExtra: character.sheetNotesExtra ?? "",
    sheetDescription: character.sheetDescription ?? "",
    dragon: dragonBlob,
  };
}
