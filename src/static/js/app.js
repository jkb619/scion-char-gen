import { applyHint, applySkillSpecialtyHints, applyGameDataHint } from "./fieldHelp.js";
import {
  buildCharacterSheet,
  buildVirtueSpectrumElement,
  originDefenseFromFinalAttrs,
  originMovementPoolDice,
} from "./characterSheet.js";
import { LEGEND_SHEET_DOT_COUNT } from "./characterSheetLegendPools.js";
import {
  knackEligible,
  knackEligibleForCallingStep,
  knackEligibleForFinishingExtraKnack,
  knackFinishingPickIsValidHeld,
  pruneKnackIdsToCallingSlotCap,
  syncHeroKnackSlotAssignments,
  knackAppliesToCallingsLine,
  heroCallingRowMatchesKnack,
  knackCallingTokensForRowMatch,
  originCallingKnackChipGroupKey,
  boonEligible,
  boonIsPurviewInnateAutomaticGrant,
  boonPrimaryPurview,
  characterPurviewIdSet,
  mythosCallingTwinId,
  mythosPatronCallingIdForChooser,
  callingIdInWizardLibraryChooser,
} from "./eligibility.js";
import { boonDisplayLabel } from "./boonLabels.js";
import { birthrightTagIds, birthrightTagLabels } from "./birthrightTags.js";
import { mergedPurviewIdsForSheet, purviewDisplayNameForPantheon } from "./purviewDisplayName.js";
import { purviewInnateBlocks, purviewStandardInnateText } from "./purviewInnate.js";
import { apiUrl } from "./apiBase.js";
import { wirePickerRowFilter, wireSortableTableColumns } from "./pickerTableUtils.js";
import { buildScionInteractivePdfFields, downloadInteractiveCharacterPdf } from "./interactivePdfFields.js";
import { downloadReviewSheetAsPdf } from "./reviewSheetPdf.js";
import {
  renderDragonChargen,
  persistDragonFromDom,
  ensureDragonShape,
  isDragonHeirChargen,
  buildDragonReviewSnapshot,
} from "./chargen/DragonChargenWizard.js";

/** Lazy-loaded so optional data-editor modules cannot block the main wizard graph (or `init`). */
let editorsLoadPromise = null;

/** Match `app.js?v=…` on the module URL so editor chunks reload when the HTML cache-buster changes. */
function editorImportUrl(relPath) {
  try {
    const v = new URL(import.meta.url).searchParams.get("v");
    return v ? `${relPath}?v=${encodeURIComponent(v)}` : relPath;
  } catch {
    return relPath;
  }
}

function loadEditorsOnce() {
  if (!editorsLoadPromise) {
    editorsLoadPromise = Promise.all([
      import(editorImportUrl("./birthrightsEditor.js")),
      import(editorImportUrl("./tagsEditor.js")),
      import(editorImportUrl("./equipmentEditor.js")),
    ]).then(([br, tg, eq]) => ({
      mountBirthrightsDataEditor: br.mountBirthrightsDataEditor,
      mountTagsDataEditor: tg.mountTagsDataEditor,
      mountEquipmentDataEditor: eq.mountEquipmentDataEditor,
    }));
  }
  return editorsLoadPromise;
}

/** Service workers on localhost often come from other projects; they can intercept `/api/bundle` and break this app. */
async function clearLocalServiceWorkers() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.getRegistrations) return;
  const h = location.hostname;
  if (h !== "127.0.0.1" && h !== "localhost") return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    /* ignore */
  }
}

/**
 * Load merged game JSON. Tries document-relative `api/bundle`, then host-root `/api/bundle` (default uvicorn layout).
 */
async function fetchGameBundle() {
  /* Do not await — getRegistrations() has been observed to hang on some browsers/WSL setups, which would block init forever. Head inline script already attempts unregister on localhost. */
  void clearLocalServiceWorkers();
  const primary = new URL(apiUrl("api/bundle"));
  const fallback = new URL("/api/bundle", window.location.origin);
  const samePath = primary.origin === fallback.origin && primary.pathname === fallback.pathname;
  primary.searchParams.set("_cb", String(Date.now()));
  const tryUrls = [primary.href];
  if (!samePath) {
    fallback.searchParams.set("_cb", String(Date.now()));
    tryUrls.push(fallback.href);
  }
  let lastErr = /** @type {Error | null} */ (null);
  for (const href of tryUrls) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 45000);
    try {
      const res = await fetch(href, {
        cache: "no-store",
        credentials: "same-origin",
        signal: ac.signal,
      });
      if (res.ok) return res;
      lastErr = new Error(`GET bundle HTTP ${res.status} ${res.statusText || ""}`.trim());
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "AbortError") {
        lastErr = new Error("GET /api/bundle timed out after 45s — check network, VPN, or a stuck service worker (Application → Service Workers → Unregister).");
      } else {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    } finally {
      clearTimeout(tid);
    }
  }
  throw lastErr || new Error("Could not load /api/bundle");
}

/** FastAPI inlines the merged bundle as base64 in `#scion-embedded-bundle-b64` so startup does not depend on `fetch`. */
function readEmbeddedBundleFromDom() {
  const ta = document.getElementById("scion-embedded-bundle-b64");
  if (!ta || typeof ta.value !== "string" || !ta.value.trim()) return null;
  try {
    const b64 = ta.value.trim().replace(/\s+/g, "");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const text = new TextDecoder("utf-8").decode(bytes);
    const payload = JSON.parse(text);
    ta.remove();
    return payload;
  } catch (e) {
    console.error(e);
    return null;
  }
}

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

const PATH_KEYS = ["origin", "role", "society"];
/** Path keys sorted by display label (for `<select>` options). */
const PATH_KEYS_SORTED = [...PATH_KEYS].sort((a, b) =>
  (a.charAt(0).toUpperCase() + a.slice(1)).localeCompare(b.charAt(0).toUpperCase() + b.slice(1), undefined, {
    sensitivity: "base",
  }),
);
/** Arena names sorted A–Z for attribute step dropdowns. */
const ARENAS_SORTED = [...ARENA_ORDER].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
/** Favored approaches sorted A–Z. */
const FAVORED_APPROACHES_SORTED = ["Force", "Finesse", "Resilience"].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base" }),
);

/** Text from the Paths step for a path key, trimmed for Skills panel headings. */
function pathPhraseSnippet(pk, maxChars = 96) {
  const raw = String(character.paths?.[pk] ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!raw) return null;
  if (raw.length <= maxChars) return { text: raw, truncated: false };
  return { text: `${raw.slice(0, maxChars - 1).trimEnd()}…`, truncated: true, full: raw };
}

/** Stored patron Purview slot array length (Hero uses slot 0 only; Demigod/God may use up to four). */
const PATRON_PURVIEW_SLOT_COUNT = 4;
/** Initial Boon picks on the Boons wizard step (Hero-style creation cap). */
const MAX_WIZARD_BOON_PICKS = 2;

/**
 * Core tier order: Origin (Mortal) → Hero → Demigod → God.
 * Defaults apply if `/api/bundle` omits `tierAdvancement` (e.g. stale server meta cache).
 */
const DEFAULT_TIER_ADVANCEMENT = {
  mortal: {
    nextTier: "hero",
    source: "Scion: Hero — Visitation (p. 172+).",
    heroBirthrightDotTotal: 7,
    checklist: [
      "Choose two additional Callings so the character now possesses a total of three Callings (pre-Visitation Scions start with only one active Calling from their divine patron’s favored list).",
      "Assign four additional dots to the Callings for a new total of five dots distributed among the three Callings (each Calling must still have at least one dot).",
      "The character now gains full access to Heroic Knacks. Each additional dot you gain in any Calling allows you to purchase and know one additional Knack from that specific Calling. You may never have more Knacks known than your total Calling dots across all three Callings.",
      "At least one Calling must be one of your divine parent’s three Favored Callings (Hero pp. 172, 184).",
      "If your Scion already knows more than five Knacks (excluding Finishing Touches), take no further Knacks here (Hero p. 172).",
      "Spend up to seven dots of Birthrights in total (Hero p. 186); if you already spent some, spend the remainder now (p. 172).",
      "Choose innate Purviews (Hero Step 7, p. 188).",
      "Assign Boons (Hero Step 8, p. 189).",
      "Set Legend in the app header when your chronicle calls for it (p. 172).",
    ],
  },
  hero: {
    nextTier: "demigod",
    source: "Scion: Demigod — Apotheosis / Demigod play (pp. 16, 132+).",
    checklist: ["Legend, Calling dots, and Boons advance per Demigod — confirm milestones with your Storyguide."],
  },
  demigod: {
    nextTier: "god",
    source: "Scion: God — Apotheosis and full Godhood.",
    checklist: ["Godhood, Mantles, and Legend 8–10+ per your chronicle and Scion: God."],
  },
};

function normalizedTierId(tierId) {
  const raw = String(tierId ?? "mortal").trim();
  if (!raw) return "mortal";
  const lower = raw.toLowerCase();
  if (lower === "origin") return "mortal";
  return lower;
}

/** Saints & Monsters Sorcerer line — ids in `data/tier.json`. */
const SORCERER_TIER_IDS = new Set(["sorcerer", "sorcerer_hero", "sorcerer_demigod", "sorcerer_god"]);

/** @param {string} [tierId] */
function isSorcererLineTier(tierId) {
  return SORCERER_TIER_IDS.has(normalizedTierId(tierId));
}

/**
 * Base Sorcerer (Legend 0) Paths omit Visitation pantheon/parent UI (Saints & Monsters ch. 3).
 * Sorcerer Hero+ keeps that stack for Patron Purviews / Society Asset Skills (Origin p. 97).
 * @param {string} [tierId]
 */
function sorcererPathsHidePatronStack(tierId) {
  return isSorcererLineTier(tierId) && !tierHasPurviewStep(tierId);
}

/**
 * How many Workings a Sorcerer may know at chargen for this tier (S&M p. 65: one at Legend 0; +1 at Legend 1, 5, 9).
 * @param {string} [tierId]
 */
function sorcererWorkingPickCap(tierId) {
  const t = normalizedTierId(tierId);
  if (t === "sorcerer") return 1;
  if (t === "sorcerer_hero") return 2;
  if (t === "sorcerer_demigod") return 3;
  if (t === "sorcerer_god") return 4;
  return 1;
}

/** Origin / Mortal chargen: Calling rating is always 1 dot (rules). Mortal-band Sorcerer matches Origin Calling limits. */
function isOriginPlayTier(tierId) {
  const t = normalizedTierId(tierId);
  return t === "mortal" || t === "sorcerer";
}

/** Max Legend dots on the track per tier (sheet / UI). */
const LEGEND_DOT_MAX = {
  mortal: 1,
  hero: 4,
  demigod: 8,
  god: 12,
  sorcerer: 1,
  sorcerer_hero: 4,
  sorcerer_demigod: 8,
  sorcerer_god: 12,
  titanic: 4,
};

function legendDotMaxForTier(tierId) {
  const t = normalizedTierId(tierId);
  return LEGEND_DOT_MAX[t] ?? 1;
}

function clampLegendRating(value, tierId) {
  const max = legendDotMaxForTier(tierId);
  const n = Math.round(Number(value));
  const x = Number.isNaN(n) ? 0 : n;
  return Math.max(0, Math.min(max, x));
}

function syncLegendToTier() {
  character.legendRating = clampLegendRating(character.legendRating ?? 0, character.tier);
  ensureLegendAwarenessPoolSlotArrays();
}

/** Pad or trim per-dot pool-spent flags to length `n` (Legend / Awareness imbue tracking on the sheet). */
function padPoolSlotArray(arr, n) {
  const cap = Math.max(0, Math.round(Number(n) || 0));
  const out = Array(cap).fill(false);
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < cap; i += 1) out[i] = !!arr[i];
  return out;
}

/** Keep `legendPoolDotSpentSlots` / `awarenessPoolDotSpentSlots` aligned with tier (and Mythos for Awareness). */
function ensureLegendAwarenessPoolSlotArrays() {
  const legN = Math.max(LEGEND_SHEET_DOT_COUNT, legendDotMaxForTier(character.tier));
  if (!Array.isArray(character.legendPoolDotSpentSlots)) {
    character.legendPoolDotSpentSlots = Array(legN).fill(false);
    if (character.legendPoolDotSpent === true) character.legendPoolDotSpentSlots[0] = true;
  } else {
    character.legendPoolDotSpentSlots = padPoolSlotArray(character.legendPoolDotSpentSlots, legN);
  }
  const awN = isMythosPantheonSelected() ? awarenessDotMaxForTier(character.tier) : 1;
  if (!Array.isArray(character.awarenessPoolDotSpentSlots)) {
    character.awarenessPoolDotSpentSlots = Array(awN).fill(false);
    if (character.awarenessPoolDotSpent === true) character.awarenessPoolDotSpentSlots[0] = true;
  } else {
    character.awarenessPoolDotSpentSlots = padPoolSlotArray(character.awarenessPoolDotSpentSlots, awN);
  }
}

/** Mythos Awareness: same per-tier cap as Legend (Origin 1, Hero 4, …). */
function awarenessDotMaxForTier(tierId) {
  return legendDotMaxForTier(tierId);
}

function clampAwarenessRating(value, tierId = character.tier) {
  if (!isMythosPantheonSelected()) return 1;
  const max = awarenessDotMaxForTier(tierId);
  const n = Math.round(Number(value));
  const x = Number.isNaN(n) ? 1 : n;
  return Math.max(1, Math.min(max, x));
}

function syncAwarenessWithPantheon() {
  if (isMythosPantheonSelected()) {
    character.awarenessRating = clampAwarenessRating(character.awarenessRating ?? 1);
  } else {
    character.awarenessRating = 1;
  }
  ensureLegendAwarenessPoolSlotArrays();
}

/**
 * Mythos Awareness: 1..tier-max filled dots. Click dot i to set to i; click again on the rightmost filled dot to lower by one (minimum 1).
 * @param {number} value
 * @param {string} tierId
 * @param {boolean} interactive
 */
function buildAwarenessDotTrack(value, tierId, interactive) {
  const max = awarenessDotMaxForTier(tierId);
  const v = clampAwarenessRating(value, tierId);
  const wrap = document.createElement("span");
  wrap.className = "legend-dot-track legend-dot-track-dense";
  wrap.setAttribute("role", interactive ? "radiogroup" : "img");
  wrap.setAttribute("aria-label", `Awareness ${v} of ${max}`);
  for (let i = 1; i <= max; i += 1) {
    const d = document.createElement("span");
    d.className = "legend-dot" + (i <= v ? " on" : "");
    d.setAttribute("aria-hidden", "true");
    if (interactive) {
      d.tabIndex = 0;
      d.addEventListener("click", () => {
        const cur = clampAwarenessRating(character.awarenessRating ?? 1, character.tier);
        if (cur === i) character.awarenessRating = Math.max(1, i - 1);
        else character.awarenessRating = i;
        syncAwarenessWithPantheon();
        render();
      });
    }
    wrap.appendChild(d);
  }
  return wrap;
}

/** Rules for advancing `tierId`, merging `data/tierAdvancement.json` over these defaults. */
function getTierAdvancementRule(tierId) {
  const id = normalizedTierId(tierId);
  const fallback = DEFAULT_TIER_ADVANCEMENT[id];
  const fromBundle = bundle?.tierAdvancement?.[id];
  const merged = { ...(fallback || {}), ...(fromBundle || {}) };
  if (!merged.nextTier) return null;
  return merged;
}

/** @type {any} */
let bundle = null;

/** @type {ReturnType<typeof defaultCharacter>} */
let character = defaultCharacter();

let stepIndex = 0;

/**
 * After a failed “Next” on the Skills step: `{ pathKey?, message }[]` for red summary + panel highlights.
 * Cleared when validation passes (including after fixes).
 */
let skillsGateIssues = [];

/** Review step: `"sheet"` (default) or `"json"`. */
let reviewViewMode = "sheet";

/** Top-level UI: character wizard vs birthrights JSON editor. */
let appMainTab = "wizard";

function defaultCharacter() {
  const skills = {};
  return {
    tier: "mortal",
    characterName: "",
    concept: "",
    deeds: { short: "", long: "", band: "", mythos: "" },
    paths: { origin: "", role: "", society: "" },
    pantheonId: "",
    /** 0–5 filled dots between pantheon Virtue extremes (left → right in virtues.json order). */
    virtueSpectrum: 0,
    parentDeityId: "",
    /** `"deity"` = God parent from `pantheons.*.deities`; `"titan"` = Titan parent from merged `pantheons.*.titans` (Titanomachy). */
    patronKind: "deity",
    pathRank: { primary: "origin", secondary: "role", tertiary: "society" },
    pathSkills: { origin: [], role: [], society: [] },
    /** Extra Path dots after capping overlap at 5 (Origin p. 97); only Path Skills may receive them. */
    pathSkillRedistribution: {},
    /** Last `pathLayoutHash()` used for `pathSkillRedistribution`; mismatch clears redistribution. */
    pathSkillRedistSourceHash: null,
    skillDots: skills,
    skillSpecialties: {},
    attributes: {},
    favoredApproach: "Force",
    arenaRank: ["Social", "Mental", "Physical"],
    callingId: "",
    /** Calling rating 1–5 (Storypath Calling dots); chargen often starts at 1. */
    callingDots: 1,
    /** Hero only: `{ id, dots }[]` length 3 — primary + two Visitation Callings (see `initHeroCallingSlotsAfterVisitation`). */
    callingSlots: null,
    /** Hero three-row mode: which Calling row (0–2) pays each Knack’s slot cost (`knackSlotById[knackId]`). */
    knackSlotById: {},
    knackIds: [],
    purviewIds: [],
    /** Four slots, each `""` or a Purview id from the current divine parent’s list. */
    patronPurviewSlots: ["", "", "", ""],
    boonIds: [],
    birthrightIds: [],
    /** 0 = none until set on the Review sheet Legend row (Legend fluctuates in play; tier advance does not auto-fill dots). */
    legendRating: 0,
    /** Masks of the Mythos pantheon only: Awareness 1..tier max (stored as 1 when not Mythos). */
    awarenessRating: 1,
    /** At-table: one flag per Legend dot on the track (imbued / spent pool from that die). */
    legendPoolDotSpentSlots: [],
    /** At-table: one flag per Awareness dot (Mythos); length 1 when not Mythos. */
    awarenessPoolDotSpentSlots: [],
    /** { fromTier, toTier, appliedAt, source, checklist }[] */
    tierAdvancementLog: [],
    finishing: {
      extraSkillDots: 5,
      extraAttributeDots: 1,
      knackOrBirthright: "knacks",
      skillBaseline: null,
      attrBaseline: null,
      finishingKnackIds: [],
      birthrightPicks: [],
    },
    notes: "",
    /** Freeform look / vitals / etc. for the sheet “Description” block (page 2). */
    sheetDescription: "",
    /** Equipment ids from `equipment.json` to list on the printable sheet appendix. */
    sheetEquipmentIds: [],
    /** Free text for the sheet’s Fatebindings page. */
    fatebindings: "",
    /** Long-form session / chronicle notes (separate from concept-step “Player / group notes”). */
    sheetNotesExtra: "",
    /** Saints & Monsters Ch. 3 — Sorcerer wizard step (freeform; confirm with PDF). */
    sorceryProfile: {
      motif: "",
      powerSource: "",
      /** Optional: `invocation` | `patronage` | `prohibition` | `talisman` — Heroic+ focus (S&M ch. 3). */
      primaryPowerSource: "",
      invocation: "",
      patronage: "",
      prohibition: "",
      talisman: "",
      /** @type {string[]} */
      workingIds: [],
      techniquesNotes: "",
      notes: "",
    },
    /** Saints & Monsters — Titanic Mutation / Maelstrom notes (freeform; confirm with PDF). */
    titanicProfile: {
      motif: "",
      mutationCallingId: "",
      mutationDots: 0,
      condition: "",
      suppressEpicenterNotes: "",
    },
    /** Masks of the Mythos: Awareness Innate vs standard Purview Innate (see Purviews step). */
    mythosInnatePower: {
      style: "standard",
      awarenessPurviewId: "",
      awarenessLocked: false,
    },
    /** `"scion"` = pantheon / Visitation track; `"dragonHeir"` = Scion: Dragon Heir wizard (parallel). */
    chargenLineage: "scion",
  };
}

function defaultSorceryProfile() {
  return {
    motif: "",
    powerSource: "",
    primaryPowerSource: "",
    invocation: "",
    patronage: "",
    prohibition: "",
    talisman: "",
    workingIds: [],
    techniquesNotes: "",
    notes: "",
  };
}

function defaultTitanicProfile() {
  return {
    motif: "",
    mutationCallingId: "",
    mutationDots: 0,
    condition: "",
    suppressEpicenterNotes: "",
  };
}

function ensureSorceryProfileShape() {
  const d = defaultSorceryProfile();
  if (!character.sorceryProfile || typeof character.sorceryProfile !== "object") character.sorceryProfile = { ...d };
  else {
    for (const k of Object.keys(d)) {
      if (character.sorceryProfile[k] == null) character.sorceryProfile[k] = d[k];
    }
  }
  if (!Array.isArray(character.sorceryProfile.workingIds)) character.sorceryProfile.workingIds = [];
  else {
    character.sorceryProfile.workingIds = [...new Set(character.sorceryProfile.workingIds.filter((x) => typeof x === "string" && x.trim()))];
  }
  const cap = sorcererWorkingPickCap(character.tier);
  if (character.sorceryProfile.workingIds.length > cap) {
    character.sorceryProfile.workingIds = character.sorceryProfile.workingIds.slice(0, cap);
  }
}

function ensureTitanicProfileShape() {
  const d = defaultTitanicProfile();
  if (!character.titanicProfile || typeof character.titanicProfile !== "object") character.titanicProfile = { ...d };
  else {
    for (const k of Object.keys(d)) {
      if (character.titanicProfile[k] == null) character.titanicProfile[k] = d[k];
    }
  }
  const md = Math.round(Number(character.titanicProfile.mutationDots) || 0);
  character.titanicProfile.mutationDots = Math.max(0, Math.min(5, Number.isNaN(md) ? 0 : md));
}

function defaultMythosInnatePower() {
  return {
    style: "standard",
    awarenessPurviewId: "",
    awarenessLocked: false,
  };
}

function ensureMythosInnatePowerShape() {
  const d = defaultMythosInnatePower();
  if (!character.mythosInnatePower || typeof character.mythosInnatePower !== "object") character.mythosInnatePower = { ...d };
  else {
    for (const k of Object.keys(d)) {
      if (character.mythosInnatePower[k] == null) character.mythosInnatePower[k] = d[k];
    }
  }
  let st = String(character.mythosInnatePower.style || "standard").trim();
  if (st !== "standard" && st !== "awareness") st = "standard";
  character.mythosInnatePower.style = st;
  character.mythosInnatePower.awarenessPurviewId = String(character.mythosInnatePower.awarenessPurviewId || "").trim();
  character.mythosInnatePower.awarenessLocked = !!character.mythosInnatePower.awarenessLocked;
}

/**
 * Divine parent’s patron Purview ids that have MotM Awareness Innate text in the bundle.
 * Innate Purview follows the parent’s list (Appendix 2), not pantheon Signature or other extras on `purviewIds`.
 */
function mythosAwarenessInnatePurviewIds() {
  const fromParent = patronPurviewOptionIds();
  return fromParent.filter((pid) => {
    const pv = bundle?.purviews?.[pid];
    return pv && typeof pv === "object" && typeof pv.mythosAwarenessInnate === "string" && pv.mythosAwarenessInnate.trim();
  });
}

function renderMythosInnatePowerPanel(wrap) {
  if (!isMythosPantheonSelected() || !tierHasPurviewStep(character.tier)) return;
  ensureMythosInnatePowerShape();
  const m = character.mythosInnatePower;
  const optIds = [...mythosAwarenessInnatePurviewIds()].sort((a, b) =>
    purviewLabel(a).localeCompare(purviewLabel(b), undefined, { sensitivity: "base" }),
  );
  const callout = masksMotMBundle()?.mythosInnatePowerCallout;
  const panel = document.createElement("div");
  panel.className = "panel mythos-innate-panel";
  const h = document.createElement("h2");
  h.textContent = "Mythos: Awareness Innate Power";
  panel.appendChild(h);
  const intro = document.createElement("p");
  intro.className = "help";
  intro.innerHTML =
    typeof callout === "string" && callout.trim()
      ? callout.trim().replace(/\n/g, "<br/>")
      : "Mythos Scions can take the <strong>Awareness Innate Power</strong> from a Purview instead of the <strong>normal</strong> Innate. You only have <strong>one</strong> Innate Power in this model; once you commit to the Awareness Innate, MotM says you <strong>cannot switch back</strong>.";
  panel.appendChild(intro);
  const step7 = document.createElement("p");
  step7.className = "help";
  step7.innerHTML =
    "<strong>Chargen (MotM p. 41, Step Seven):</strong> When you select your innate Purview, you may take the normal Innate or the Awareness Innate (p. 49). If you start with the normal Innate, you may replace it with the Awareness Innate when your Awareness increases—once you choose the Awareness Innate, you cannot change Innate Powers again.";
  panel.appendChild(step7);

  if (m.awarenessLocked || (m.style === "awareness" && m.awarenessPurviewId)) {
    const pv = bundle.purviews?.[m.awarenessPurviewId];
    const status = document.createElement("div");
    status.className = "field mythos-innate-locked";
    status.innerHTML = `<p><strong>Committed:</strong> You are using the <strong>Mythos Awareness Innate</strong> for <strong>${(pv && pv.name) || m.awarenessPurviewId || "—"}</strong> <span class="mono">(${m.awarenessPurviewId || "—"})</span>. This choice is <strong>permanent</strong> per Masks of the Mythos.</p>`;
    panel.appendChild(status);
    wrap.appendChild(panel);
    return;
  }

  const fieldset = document.createElement("fieldset");
  fieldset.className = "mythos-innate-fieldset";
  const leg = document.createElement("legend");
  leg.textContent = "Standard innate vs Awareness Innate";
  fieldset.appendChild(leg);

  const heroLikeInnate =
    normalizedTierId(character.tier) === "hero" || normalizedTierId(character.tier) === "titanic";

  const stdBlock = document.createElement("div");
  stdBlock.className = "field mythos-innate-standard-block";
  const stdTitle = document.createElement("div");
  stdTitle.className = "field mythos-innate-subhead";
  stdTitle.textContent = heroLikeInnate ? "Standard innate (patron Purview)" : "Standard innate Purview";
  stdBlock.appendChild(stdTitle);
  const stdP = document.createElement("p");
  stdP.className = "help";
  if (heroLikeInnate) {
    stdP.innerHTML =
      "On Hero / Titanic, choose your patron innate with the <strong>Patron innate Purview</strong> chips <strong>above</strong>. That uses the <strong>standard innate</strong> from <strong>Pandora’s Box (Revised)</strong> (and Hero where PB points there)—not the Awareness dropdown in this section.";
  } else {
    stdP.innerHTML =
      "Use the <strong>standard innate Purview</strong> write-ups from <strong>Pandora’s Box (Revised)</strong> (primary) and Scion: Hero where PB cross-references Hero, for each Purview your <strong>divine parent</strong> grants (patron Purviews from Origin Appendix 2). That follows the parent’s list, not the pantheon’s Signature Purview alone.";
  }
  stdBlock.appendChild(stdP);
  const deity = selectedDeityEntity();
  const parentPvIds = Array.isArray(deity?.purviews) ? [...new Set(deity.purviews)].filter(Boolean) : [];
  if (!character.parentDeityId) {
    const w = document.createElement("p");
    w.className = "warn";
    w.textContent =
      "Choose a divine parent on the Paths step first. Innate Purview options are based on that parent’s patron Purviews.";
    stdBlock.appendChild(w);
  } else if (parentPvIds.length === 0) {
    const w = document.createElement("p");
    w.className = "warn";
    w.textContent = "This divine parent has no patron Purviews listed in pantheon data yet.";
    stdBlock.appendChild(w);
  } else if (!heroLikeInnate) {
    const ul = document.createElement("ul");
    ul.className = "mythos-innate-parent-purviews";
    for (const pid of [...parentPvIds].sort((a, b) =>
      purviewLabel(a).localeCompare(purviewLabel(b), undefined, { sensitivity: "base" }),
    )) {
      const li = document.createElement("li");
      li.textContent = purviewLabel(pid);
      ul.appendChild(li);
    }
    const cap = document.createElement("p");
    cap.className = "help";
    cap.textContent = "Patron Purviews from your current divine parent (for reference).";
    stdBlock.appendChild(cap);
    stdBlock.appendChild(ul);
  }
  fieldset.appendChild(stdBlock);

  const awTitle = document.createElement("div");
  awTitle.className = "field mythos-innate-subhead";
  awTitle.textContent = "Awareness Innate — which Purview? (MotM)";
  fieldset.appendChild(awTitle);
  const awIntro = document.createElement("p");
  awIntro.className = "help";
  awIntro.innerHTML = heroLikeInnate
    ? "The <strong>dropdown</strong> is only for picking <strong>which parent Purview</strong> receives MotM’s <strong>Awareness Innate</strong> text if you press <strong>Awareness Innate Power…</strong>. It does <strong>not</strong> set your normal innate—that stays the chip selection above unless you commit and replace the model (MotM pp. 49–59; irreversible once committed)."
    : "Optionally commit to the <strong>Awareness Innate</strong> for <strong>one</strong> Purview from your <strong>divine parent’s</strong> list (MotM pp. 49–59). Once confirmed, you cannot revert.";
  fieldset.appendChild(awIntro);

  const heroTier = normalizedTierId(character.tier) === "hero" || normalizedTierId(character.tier) === "titanic";
  const rowPv = document.createElement("div");
  rowPv.className = "field mythos-innate-awareness-row" + (heroTier ? " mythos-innate-awareness-row--hero-inline" : "");
  const labPv = document.createElement("label");
  labPv.htmlFor = "f-mythos-innate-purview";
  labPv.textContent = heroLikeInnate
    ? "Purview for Awareness Innate (parent list; if committing)"
    : "Purview (must be on divine parent’s list)";
  const sel = document.createElement("select");
  sel.id = "f-mythos-innate-purview";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— choose —";
  sel.appendChild(blank);
  for (const pid of optIds) {
    const pv = bundle.purviews?.[pid];
    const o = document.createElement("option");
    o.value = pid;
    o.textContent = pv?.name || pid;
    sel.appendChild(o);
  }
  sel.value = optIds.includes(m.awarenessPurviewId) ? m.awarenessPurviewId : "";

  const orSep = document.createElement("span");
  orSep.className = "mythos-innate-or-sep";
  orSep.setAttribute("role", "presentation");
  orSep.textContent = "-- or --";

  const commitWrap = document.createElement("div");
  commitWrap.className = "mythos-innate-commit-wrap";
  const commitBtn = document.createElement("button");
  commitBtn.type = "button";
  commitBtn.id = "f-mythos-innate-commit";
  commitBtn.className = "btn primary mythos-innate-commit-btn";
  commitBtn.textContent = "Awareness Innate Power…";
  commitWrap.appendChild(commitBtn);

  if (heroTier) {
    const labRow = document.createElement("div");
    labRow.className = "field mythos-innate-awareness-label";
    labRow.appendChild(labPv);
    fieldset.appendChild(labRow);
    rowPv.appendChild(sel);
    rowPv.appendChild(orSep);
    rowPv.appendChild(commitWrap);
  } else {
    const pickWrap = document.createElement("div");
    pickWrap.className = "mythos-innate-purview-pick";
    pickWrap.appendChild(labPv);
    pickWrap.appendChild(sel);
    rowPv.appendChild(pickWrap);
    rowPv.appendChild(orSep);
    rowPv.appendChild(commitWrap);
  }
  fieldset.appendChild(rowPv);

  if (!character.parentDeityId) {
    const warn = document.createElement("p");
    warn.className = "warn";
    warn.textContent = "Select a divine parent on Paths to enable Awareness Innate choices.";
    fieldset.appendChild(warn);
  } else if (parentPvIds.length > 0 && optIds.length === 0) {
    const warn = document.createElement("p");
    warn.className = "warn";
    warn.textContent =
      "None of this parent’s Purviews have MotM Awareness Innate text in this app yet (see mythosPurviewInnates.json).";
    fieldset.appendChild(warn);
  }

  commitBtn.addEventListener("click", () => {
    const pid = sel.value;
    if (!pid) {
      window.alert("Choose a Purview from the list (your divine parent’s patron Purviews with MotM data), then commit.");
      return;
    }
    if (
      !window.confirm(
        "Commit to the Mythos Awareness Innate for this Purview? Masks of the Mythos states that once you choose the Awareness Innate Power, you cannot switch your Innate Powers again.",
      )
    ) {
      return;
    }
    ensureMythosInnatePowerShape();
    character.mythosInnatePower.style = "awareness";
    character.mythosInnatePower.awarenessPurviewId = pid;
    character.mythosInnatePower.awarenessLocked = true;
    render();
  });
  sel.addEventListener("change", () => {
    ensureMythosInnatePowerShape();
    character.mythosInnatePower.awarenessPurviewId = sel.value || "";
  });
  panel.appendChild(fieldset);
  wrap.appendChild(panel);
}

function ensureSheetAppendicesShape() {
  if (!Array.isArray(character.sheetEquipmentIds)) character.sheetEquipmentIds = [];
  character.sheetEquipmentIds = character.sheetEquipmentIds.filter(
    (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
  );
  if (character.fatebindings == null) character.fatebindings = "";
  if (character.sheetNotesExtra == null) character.sheetNotesExtra = "";
  if (character.sheetDescription == null || typeof character.sheetDescription !== "string") character.sheetDescription = "";
}

function skillIds() {
  return Object.keys(bundle.skills).filter((k) => !k.startsWith("_"));
}

function ensureSkillDots() {
  for (const id of skillIds()) {
    if (character.skillDots[id] == null) character.skillDots[id] = 0;
  }
}

/** Name + optional Specialties (same layout as Skills step). */
function appendSkillRatingNameCell(tr, sid, skillMeta, val) {
  const nameTd = document.createElement("td");
  nameTd.className = "skill-ratings-col-name";
  const nameRow = document.createElement("div");
  nameRow.className = "skill-ratings-name-row";
  const nameSpan = document.createElement("span");
  nameSpan.className = "skill-ratings-skill-label";
  nameSpan.textContent = skillMeta.name;
  applyGameDataHint(nameSpan, skillMeta);
  nameRow.appendChild(nameSpan);
  if (val >= 3) {
    const specWrap = document.createElement("div");
    specWrap.className = "field skill-specialty-field skill-specialty-inline";
    const specLab = document.createElement("label");
    specLab.htmlFor = `specialty-${sid}`;
    specLab.textContent = "Specialties";
    const specIn = document.createElement("input");
    specIn.type = "text";
    specIn.id = `specialty-${sid}`;
    specIn.placeholder = "e.g. Greek Mythology, Parkour…";
    specIn.value = character.skillSpecialties[sid] || "";
    specIn.autocomplete = "off";
    const syncSpec = () => {
      const t = specIn.value.trim();
      if (t) character.skillSpecialties[sid] = specIn.value;
      else delete character.skillSpecialties[sid];
    };
    specIn.addEventListener("input", syncSpec);
    specIn.addEventListener("change", syncSpec);
    specWrap.appendChild(specLab);
    specWrap.appendChild(specIn);
    applySkillSpecialtyHints(specLab, specIn, sid);
    nameRow.appendChild(specWrap);
  }
  nameTd.appendChild(nameRow);
  tr.appendChild(nameTd);
}

/** Dots column: `"skills"` = full 0–5; `"finishing"` = baseline–cap from finishing budget. */
function appendSkillRatingDotsCell(tr, sid, skillMeta, val, mode) {
  const dotsTd = document.createElement("td");
  dotsTd.className = "skill-ratings-col-dots";
  const dotsWrap = document.createElement("div");
  dotsWrap.className = "skill-ratings-dots-wrap";
  const dots = document.createElement("div");
  dots.className = "dots";
  const bSk = character.finishing.skillBaseline || {};
  const minV = mode === "finishing" ? (bSk[sid] ?? 0) : 0;
  const maxV = mode === "finishing" ? maxSkillFinishing(sid) : 5;
  const disp = mode === "finishing" ? Math.min(val, maxV) : val;
  for (let i = 1; i <= 5; i += 1) {
    if (mode === "skills") {
      const sp = document.createElement("span");
      sp.className = "dot" + (i <= val ? " filled" : "");
      sp.setAttribute("aria-hidden", "true");
      dots.appendChild(sp);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      const allowed = i >= minV && i <= maxV;
      btn.disabled = !allowed;
      btn.className = "dot" + (i <= disp ? " filled" : "") + (allowed ? "" : " dot-capped");
      if (allowed) {
        btn.addEventListener("click", () => {
          const next = i === val ? minV : i;
          character.skillDots[sid] = Math.max(minV, Math.min(next, maxV));
          if ((character.skillDots[sid] || 0) < 3) delete character.skillSpecialties[sid];
          render();
        });
      }
      dots.appendChild(btn);
    }
  }
  dotsWrap.appendChild(dots);
  dotsTd.appendChild(dotsWrap);
  tr.appendChild(dotsTd);
  applyGameDataHint(dotsTd, skillMeta);
}

function computeRawPathSkillDots() {
  const dots = {};
  for (const id of skillIds()) dots[id] = 0;
  const rankToDots = { primary: 3, secondary: 2, tertiary: 1 };
  for (const rank of ["primary", "secondary", "tertiary"]) {
    const pathKey = character.pathRank[rank];
    const list = character.pathSkills[pathKey] || [];
    const add = rankToDots[rank];
    for (const sid of list) {
      if (!dots.hasOwnProperty(sid)) continue;
      dots[sid] += add;
    }
  }
  return dots;
}

/** Union of Skills listed on any of the three Paths (redistribution targets only). */
function pathSkillUnionSet() {
  ensurePathSkillArrays();
  const u = new Set();
  for (const pk of PATH_KEYS) {
    for (const sid of character.pathSkills[pk] || []) {
      if (!sid || String(sid).startsWith("_")) continue;
      if (bundle?.skills?.[sid]) u.add(sid);
    }
  }
  return u;
}

function pathSkillTrimmedLostAndUnion() {
  const raw = computeRawPathSkillDots();
  const trimmed = {};
  let lost = 0;
  for (const sid of skillIds()) {
    const r = raw[sid] || 0;
    const ex = Math.max(0, r - 5);
    lost += ex;
    trimmed[sid] = r - ex;
  }
  return { raw, trimmed, lost, union: pathSkillUnionSet() };
}

function sumPathSkillRedistribution(G) {
  let s = 0;
  if (!G || typeof G !== "object") return 0;
  for (const v of Object.values(G)) {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n > 0) s += n;
  }
  return s;
}

function sanitizePathSkillRedistribution(trimmed, lost, union, G0) {
  const G = {};
  if (lost <= 0) return G;
  for (const sid of union) {
    const g0 = Math.max(0, Math.round(Number(G0[sid]) || 0));
    if (g0 <= 0) continue;
    const cap = Math.max(0, 5 - (trimmed[sid] || 0));
    if (cap <= 0) continue;
    G[sid] = Math.min(g0, cap);
  }
  let sumG = sumPathSkillRedistribution(G);
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

/** If imported `skillDots` already reflect a legal redistribution, recover `pathSkillRedistribution` (one-time after load). */
function tryInferPathSkillRedistribution(prevDots, trimmed, lost, union) {
  const infer = {};
  if (lost <= 0) return null;
  for (const sid of union) {
    const prev = Math.max(0, Math.round(Number(prevDots[sid]) || 0));
    const t = trimmed[sid] || 0;
    const d = Math.max(0, prev - t);
    if (d > 0) infer[sid] = d;
  }
  if (sumPathSkillRedistribution(infer) !== lost) return null;
  for (const sid of skillIds()) {
    const t = trimmed[sid] || 0;
    const g = infer[sid] || 0;
    if (t + g > 5) return null;
  }
  return infer;
}

function inferPathSkillOverflowFromImportedDotsOnce() {
  if (!bundle) return;
  if (String(character.chargenLineage ?? "scion").trim() === "dragonHeir") return;
  ensurePathSkillArrays();
  const { trimmed, lost, union } = pathSkillTrimmedLostAndUnion();
  if (lost <= 0) return;
  const cur = character.pathSkillRedistribution;
  if (cur && typeof cur === "object" && sumPathSkillRedistribution(cur) > 0) return;
  const infer = tryInferPathSkillRedistribution(character.skillDots, trimmed, lost, union);
  if (!infer) return;
  character.pathSkillRedistribution = infer;
}

function pathSkillOverflowDotsPending() {
  const { lost } = pathSkillTrimmedLostAndUnion();
  if (lost <= 0) return 0;
  return Math.max(0, lost - sumPathSkillRedistribution(character.pathSkillRedistribution));
}

function bumpPathSkillRedistribution(sid, delta) {
  const { trimmed, lost, union } = pathSkillTrimmedLostAndUnion();
  if (!union.has(sid)) return;
  const G = { ...(character.pathSkillRedistribution || {}) };
  const cur = G[sid] || 0;
  const placed = sumPathSkillRedistribution(G);
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
  character.pathSkillRedistribution = G;
  applyPathMathToSkillDots();
}

function pathLayoutHash() {
  ensurePathSkillArrays();
  const pr = character.pathRank;
  return JSON.stringify({
    ranks: [pr.primary, pr.secondary, pr.tertiary],
    origin: [...(character.pathSkills.origin || [])],
    role: [...(character.pathSkills.role || [])],
    society: [...(character.pathSkills.society || [])],
  });
}

/**
 * Overwrite skill ratings from Path priority + Path Skills (3 / 2 / 1 cumulative).
 * Overlap above 5 is not dropped: `pathSkillRedistribution` holds dots moved to other Path Skills (Origin p. 97).
 */
function applyPathMathToSkillDots() {
  ensureSkillDots();
  ensurePathSkillArrays();
  const h = pathLayoutHash();
  if (character.pathSkillRedistSourceHash == null) {
    character.pathSkillRedistSourceHash = h;
  } else if (character.pathSkillRedistSourceHash !== h) {
    character.pathSkillRedistribution = {};
    character.pathSkillRedistSourceHash = h;
  }
  if (!character.pathSkillRedistribution || typeof character.pathSkillRedistribution !== "object") {
    character.pathSkillRedistribution = {};
  }
  const { trimmed, lost, union } = pathSkillTrimmedLostAndUnion();
  let G = sanitizePathSkillRedistribution(trimmed, lost, union, character.pathSkillRedistribution);
  if (lost <= 0) {
    G = {};
    character.pathSkillRedistribution = {};
  } else {
    character.pathSkillRedistribution = G;
  }
  for (const sid of skillIds()) {
    const t = trimmed[sid] || 0;
    const g = G[sid] || 0;
    character.skillDots[sid] = t + g;
  }
  for (const sid of skillIds()) {
    if ((character.skillDots[sid] || 0) < 3) delete character.skillSpecialties[sid];
  }
}

function pantheonList() {
  const list = Object.values(bundle.pantheons || {}).filter(
    (p) => p && typeof p === "object" && p.id && !String(p.id).startsWith("_"),
  );
  return list.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, { sensitivity: "base" }));
}

/** Pantheons with at least one divine parent (Paths when Patron type is Deity). */
function pantheonListForDeityParents() {
  return pantheonList().filter((p) => Array.isArray(p.deities) && p.deities.length > 0);
}

/** Pantheons with Titan patrons merged from Titanomachy (`pantheon.titans`). */
function pantheonListForTitanPatrons() {
  return pantheonList().filter((p) => Array.isArray(p.titans) && p.titans.length > 0);
}

function pantheonOptionsForCurrentPatronKind() {
  return patronKindIsTitan() ? pantheonListForTitanPatrons() : pantheonListForDeityParents();
}

const WELCOME_DEITY_TIER_ORDER = ["mortal", "hero", "demigod", "god"];
const WELCOME_TITAN_TIER_ORDER = ["mortal", "titanic", "demigod", "god"];
const WELCOME_SORCERER_TIER_ORDER = ["sorcerer", "sorcerer_hero", "sorcerer_demigod", "sorcerer_god"];
/** Max Inheritance dot on the Heir track (Scion: Dragon pp. 117–119). */
const DRAGON_INHERITANCE_MAX = 10;

/** Inheritance labels when `dragonTier.json` is missing from the bundle (matches data/dragonTier.json). */
const DRAGON_INHERITANCE_WELCOME_STAGES = [
  ["1", "Hatchling"],
  ["2", "Asset"],
  ["3", "Seeker"],
  ["4", "Agent"],
  ["5", "Conspirator"],
  ["6", "Cabalist"],
  ["7", "Arcanist"],
  ["8", "Vizier"],
  ["9", "Mastermind"],
  ["10", "True Dragon"],
];

/** @param {string} tierId */
function welcomeTierRowLabel(tierId) {
  const row = bundle?.tier?.[tierId];
  const nm = row?.name || tierId;
  if (tierId === "titanic") return "Hero (Titanic Scion)";
  return nm;
}

/** @returns {{ line: "deity"|"titan"|"dragon"|"sorcerer"; payload: string }} */
function welcomePartsFromCharacter() {
  if (String(character.chargenLineage ?? "").trim() === "dragonHeir") {
    ensureDragonShape(character, bundle);
    const inh = String(Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(character.dragon?.inheritance) || 1))));
    return { line: "dragon", payload: inh };
  }
  if (isSorcererLineTier(character.tier)) {
    return { line: "sorcerer", payload: normalizedTierId(character.tier) };
  }
  const kt = normalizedTierId(character.tier);
  if (patronKindIsTitan()) {
    return { line: "titan", payload: kt === "titanic" ? "titanic" : kt };
  }
  return { line: "deity", payload: kt };
}

/** Encoded track for confirm logic (`deity:mortal`, `dragon:5`, `sorcerer:sorcerer`, …). */
function welcomeTrackValueFromCharacter() {
  const p = welcomePartsFromCharacter();
  if (p.line === "dragon") return `dragon:${p.payload}`;
  if (p.line === "sorcerer") return `sorcerer:${p.payload}`;
  return `${p.line}:${p.payload}`;
}

/**
 * @param {HTMLSelectElement} sel
 * @param {"deity"|"titan"|"sorcerer"} lineKind
 */
function fillWelcomeTierSelect(sel, lineKind) {
  sel.innerHTML = "";
  if (lineKind === "deity") {
    for (const tid of WELCOME_DEITY_TIER_ORDER) {
      const meta = bundle.tier?.[tid];
      if (!meta || typeof meta !== "object") continue;
      const o = document.createElement("option");
      o.value = tid;
      o.textContent = welcomeTierRowLabel(tid);
      sel.appendChild(o);
    }
  } else if (lineKind === "titan") {
    for (const tid of WELCOME_TITAN_TIER_ORDER) {
      const meta = bundle.tier?.[tid];
      if (!meta || typeof meta !== "object") continue;
      const o = document.createElement("option");
      o.value = tid;
      o.textContent = welcomeTierRowLabel(tid);
      sel.appendChild(o);
    }
  } else if (lineKind === "sorcerer") {
    for (const tid of WELCOME_SORCERER_TIER_ORDER) {
      const meta = bundle.tier?.[tid];
      if (!meta || typeof meta !== "object") continue;
      const o = document.createElement("option");
      o.value = tid;
      o.textContent = welcomeTierRowLabel(tid);
      sel.appendChild(o);
    }
  }
}

/**
 * Inheritance 1–10 for Dragon Welcome (separate row from Scion tier).
 * @param {HTMLSelectElement} sel
 */
function fillWelcomeDragonInheritanceSelect(sel) {
  sel.innerHTML = "";
  const inhTable = bundle?.dragonTier?.inheritanceTrack;
  const keys =
    inhTable && typeof inhTable === "object"
      ? Object.keys(inhTable)
          .filter((k) => !String(k).startsWith("_") && inhTable[k] && typeof inhTable[k] === "object")
          .sort((a, b) => Number(a) - Number(b))
      : [];
  if (keys.length > 0) {
    for (const k of keys) {
      const row = inhTable[k];
      const o = document.createElement("option");
      o.value = k;
      o.textContent = row.name || `Inheritance ${k}`;
      if (typeof row.summary === "string" && row.summary.trim()) o.title = row.summary.trim();
      sel.appendChild(o);
    }
  } else {
    for (const [id, name] of DRAGON_INHERITANCE_WELCOME_STAGES) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = name;
      sel.appendChild(o);
    }
  }
}

/** First valid tier option id for a line (after switching line). */
function welcomeDefaultPayloadForLine(lineKind) {
  if (lineKind === "sorcerer") {
    const found = WELCOME_SORCERER_TIER_ORDER.find((tid) => bundle.tier?.[tid] && typeof bundle.tier[tid] === "object");
    return found || "sorcerer";
  }
  const order = lineKind === "titan" ? WELCOME_TITAN_TIER_ORDER : WELCOME_DEITY_TIER_ORDER;
  const found = order.find((tid) => bundle.tier?.[tid] && typeof bundle.tier[tid] === "object");
  return found || "mortal";
}

function welcomeDefaultDragonInheritance() {
  return "1";
}

/**
 * @param {string} encoded
 */
function applyWelcomeTrackChangeNoConfirm(encoded) {
  const idx = encoded.indexOf(":");
  const lane = idx === -1 ? "deity" : encoded.slice(0, idx);
  const payload = idx === -1 ? "mortal" : encoded.slice(idx + 1);
  if (lane === "dragon") {
    character.chargenLineage = "dragonHeir";
    ensureDragonShape(character, bundle);
    character.dragon.pastConcept = false;
    /** Heir line uses Mortal/Origin on the shared spine; Inheritance is the Dragon curve (Welcome). */
    character.tier = "mortal";
    const raw = String(payload || "").trim();
    let inhStr = welcomeDefaultDragonInheritance();
    /** `dragon:5` or legacy `dragon:mortal:5` / `dragon:hero:5` — last numeric segment wins. */
    if (/^\d+$/.test(raw)) {
      inhStr = raw;
    } else {
      const segs = raw.split(":").filter(Boolean);
      for (let i = segs.length - 1; i >= 0; i -= 1) {
        if (/^\d+$/.test(segs[i])) {
          inhStr = segs[i];
          break;
        }
      }
    }
    character.dragon.inheritance = Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(inhStr) || 1)));
    character.patronKind = "deity";
    return;
  }
  if (lane === "sorcerer") {
    character.chargenLineage = "scion";
    delete character.dragon;
    character.patronKind = "deity";
    const raw = String(payload || "").trim().toLowerCase();
    character.tier = SORCERER_TIER_IDS.has(raw) ? raw : "sorcerer";
    return;
  }
  character.chargenLineage = "scion";
  delete character.dragon;
  if (lane === "titan") {
    character.patronKind = "titan";
    character.tier = payload === "titanic" ? "titanic" : normalizedTierId(payload);
  } else {
    character.patronKind = "deity";
    character.tier = normalizedTierId(payload);
  }
}

/** @param {string} prev @param {string} next */
function welcomeTrackChangeIsHeavy(prev, next) {
  if (prev === next) return false;
  const pl = prev.split(":")[0];
  const nl = next.split(":")[0];
  if (pl === "dragon" && nl === "dragon") return false;
  if (pl === "sorcerer" && nl === "sorcerer") {
    const prevPayload = prev.split(":").slice(1).join(":") || "";
    const nextPayload = next.split(":").slice(1).join(":") || "";
    return prevPayload !== nextPayload;
  }
  return true;
}

/** Loaded `masksOfTheMythos.json` (Scion: Masks of the Mythos supplement hooks), or null. */
function masksMotMBundle() {
  const m = bundle?.masksOfTheMythos;
  return m && typeof m === "object" ? m : null;
}

/** Loaded `saintsMonsters.json` (Player's Guide: Saints & Monsters hooks), or null. */
function saintsMonstersBundle() {
  const m = bundle?.saintsMonsters;
  return m && typeof m === "object" ? m : null;
}

/** Titanic Calling ids that have `sm_*` Knacks merged from knacksSaintsMonsters.json (S&M Ch. 4). */
const TITANIC_CALLING_IDS_SM_KNACKS = new Set(["adversary", "destroyer", "monster", "primeval", "tyrant"]);

function hasTitanicSaintsMonstersKnackCalling() {
  if (heroUsesCallingSlots() && Array.isArray(character.callingSlots)) {
    return character.callingSlots.some((s) => TITANIC_CALLING_IDS_SM_KNACKS.has(String(s?.id || "").trim()));
  }
  return TITANIC_CALLING_IDS_SM_KNACKS.has(String(character?.callingId || "").trim());
}

function isMythosPantheonSelected() {
  return String(character?.pantheonId || "").trim() === "mythos";
}

/** MotM fourth Deed on Paths: only when pantheon is The Mythos (`mythos` in pantheons.json), not Dragon Heir / Sorcerer Legend-0 Paths. */
function pathsStepShowsMythosDeedFields() {
  return (
    isMythosPantheonSelected() &&
    !sorcererPathsHidePatronStack(character.tier) &&
    !isDragonHeirChargen(character)
  );
}

function selectedPantheon() {
  return bundle.pantheons[character.pantheonId] || null;
}

function patronKindIsTitan() {
  return String(character?.patronKind ?? "deity").trim() === "titan";
}

/** Patron rows for the Paths dropdown: Gods from `deities` or Titans from merged `titans` (see data/titans.json). */
function patronListForPantheon(p) {
  if (!p || typeof p !== "object") return [];
  if (patronKindIsTitan()) {
    const t = p.titans;
    return Array.isArray(t) ? t : [];
  }
  const d = p.deities;
  return Array.isArray(d) ? d : [];
}

function deityList() {
  const p = selectedPantheon();
  return [...patronListForPantheon(p)].sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, { sensitivity: "base" }));
}

/** Divine parent row from `pantheons.json`, or null if none / not found. */
function selectedDeityRecord() {
  const p = selectedPantheon();
  if (!p || !character.parentDeityId) return null;
  return patronListForPantheon(p).find((d) => d.id === character.parentDeityId) || null;
}

/**
 * Calling ids allowed for the current divine parent (deity `callings` in pantheon data).
 * `null` means no restriction: no parent selected, parent has no `callings` list, or list resolves empty.
 */
function callingIdsAllowedForCharacter() {
  const d = selectedDeityRecord();
  if (!d) return null;
  const raw = d.callings;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  let out = raw.filter((cid) => typeof cid === "string" && !cid.startsWith("_") && bundle.callings?.[cid]);
  if (out.length === 0) return null;
  /** MotM: chooser lists only inverted Callings; standard ids from data map to their inverted twin (e.g. Sage → Cosmos). */
  if (isMythosPantheonSelected()) {
    const seen = new Set();
    const mapped = [];
    for (const cid of out) {
      const use = mythosPatronCallingIdForChooser(cid);
      if (!use || !bundle.callings?.[use] || seen.has(use)) continue;
      seen.add(use);
      mapped.push(use);
    }
    out = mapped;
  }
  return out;
}

/** If `id` is not in `allowed`, map Mythos normal→inverted twin when that twin is allowed (keeps slots valid after chooser change). */
function remapCallingIdIntoAllowedList(id, allowed) {
  const sid = String(id || "").trim();
  const list = Array.isArray(allowed) ? allowed : [];
  if (!sid || !list.length) return "";
  if (list.includes(sid)) return sid;
  if (isMythosPantheonSelected()) {
    const twin = mythosCallingTwinId(sid);
    if (twin && list.includes(twin)) return twin;
  }
  return "";
}

/** Hero tier only: three Storypath Callings with dots (Visitation default 1 / 1 / 1 before you assign the rest). */
const HERO_CALLING_ROW_COUNT = 3;

function heroUsesCallingSlots() {
  const t = normalizedTierId(character.tier);
  return t === "hero" || t === "titanic" || t === "sorcerer_hero";
}

/** True after Review → Advance from Mortal to Hero/Titanic: row-0 Calling must stay the Origin pick (dots may still move). */
function visitationLocksPrimaryCallingChoice() {
  const log = character.tierAdvancementLog;
  if (!Array.isArray(log)) return false;
  return log.some((e) => {
    const from = normalizedTierId(e?.fromTier);
    const to = normalizedTierId(e?.toTier);
    return (
      (from === "mortal" && (to === "hero" || to === "titanic")) ||
      (String(e?.fromTier || "").trim() === "sorcerer" && String(e?.toTier || "").trim() === "sorcerer_hero")
    );
  });
}

function syncCallingAggregatesFromHeroSlots() {
  const slots = character.callingSlots;
  if (!Array.isArray(slots) || slots.length !== HERO_CALLING_ROW_COUNT) return;
  character.callingId = String(slots[0]?.id || "").trim();
  const sum = slots.reduce((a, s) => a + Math.max(1, Math.min(5, Math.round(Number(s?.dots) || 1))), 0);
  character.callingDots = Math.max(1, Math.min(5, sum));
}

function rebalanceHeroCallingSlotDotsOverFive() {
  const s = character.callingSlots;
  if (!Array.isArray(s) || s.length !== HERO_CALLING_ROW_COUNT) return;
  for (let guard = 0; guard < 12; guard += 1) {
    const sum = s[0].dots + s[1].dots + s[2].dots;
    if (sum <= 5) break;
    for (let idx = 2; idx >= 0 && s[0].dots + s[1].dots + s[2].dots > 5; idx -= 1) {
      if (s[idx].dots > 1) s[idx].dots -= 1;
    }
  }
}

/** After Mortal → Hero: primary Calling stays; two new rows default to 1 dot each (assign the remaining two dots on the Calling step). */
function initHeroCallingSlotsAfterVisitation() {
  const allowed = callingIdsAllowedForCharacter();
  const cur = String(character.callingId || "").trim();
  const mapped = remapCallingIdIntoAllowedList(cur, allowed || []);
  const primary = mapped || allowed?.[0] || cur || "";
  character.callingSlots = [
    { id: primary, dots: 1 },
    { id: "", dots: 1 },
    { id: "", dots: 1 },
  ];
  syncCallingAggregatesFromHeroSlots();
}

function ensureCallingSlotsForHero() {
  if (!heroUsesCallingSlots()) {
    character.callingSlots = null;
    return;
  }
  if (!Array.isArray(character.callingSlots) || character.callingSlots.length !== HERO_CALLING_ROW_COUNT) {
    const d = Math.max(1, Math.min(5, Math.round(Number(character.callingDots) || 1)));
    const d0 = Math.max(1, Math.min(5, d - 2));
    const cid = String(character.callingId || "").trim();
    character.callingSlots = [
      { id: cid, dots: d0 },
      { id: "", dots: 1 },
      { id: "", dots: 1 },
    ];
  }
  for (let i = 0; i < HERO_CALLING_ROW_COUNT; i += 1) {
    const raw = character.callingSlots[i] || { id: "", dots: 1 };
    character.callingSlots[i] = {
      id: typeof raw.id === "string" ? raw.id.trim() : "",
      dots: Math.max(1, Math.min(5, Math.round(Number(raw.dots) || 1))),
    };
  }
  rebalanceHeroCallingSlotDotsOverFive();
  syncCallingAggregatesFromHeroSlots();
}

/** If the parent deity restricts Callings, ensure `character.callingId` is one of them. */
function syncCallingToParentDeity() {
  if (!bundle?.callings) return;
  const allowed = callingIdsAllowedForCharacter();
  if (heroUsesCallingSlots()) {
    ensureCallingSlotsForHero();
    if (allowed) {
      const patronSet = new Set(allowed);
      const mythos = isMythosPantheonSelected();
      const fullCallingSet = new Set(
        Object.keys(bundle.callings || {}).filter(
          (k) => typeof k === "string" && k && !k.startsWith("_") && callingIdInWizardLibraryChooser(k, bundle, mythos),
        ),
      );
      const lockPrimary = visitationLocksPrimaryCallingChoice();
      for (let si = 0; si < character.callingSlots.length; si += 1) {
        if (lockPrimary && si === 0) continue;
        const s = character.callingSlots[si];
        if (!s.id) continue;
        if (si === 0) {
          if (!patronSet.has(s.id)) {
            const mapped = remapCallingIdIntoAllowedList(s.id, allowed);
            s.id = mapped || "";
          }
        } else if (!fullCallingSet.has(s.id)) {
          s.id = "";
        }
      }
      const cur0 = String(character.callingSlots[0]?.id || "").trim();
      if (cur0 && !patronSet.has(cur0)) {
        const m0 = remapCallingIdIntoAllowedList(cur0, allowed);
        if (m0) character.callingSlots[0].id = m0;
        else if (!lockPrimary) character.callingSlots[0].id = allowed[0] || "";
      }
    }
    syncCallingAggregatesFromHeroSlots();
    return;
  }
  if (!allowed) return;
  const cur = character.callingId || "";
  if (allowed.includes(cur)) return;
  const mapped = remapCallingIdIntoAllowedList(cur, allowed);
  character.callingId = mapped || allowed[0] || "";
}

/** @param {unknown} arr */
function validPathSkillIdArray(arr) {
  const skillsTable = bundle?.skills;
  if (!Array.isArray(arr)) return [];
  return arr.filter((id) => typeof id === "string" && id && !id.startsWith("_") && skillsTable?.[id]);
}

/** Pantheon row only — used to drop stale Society picks after switching to a patron with different Asset Skills. */
function pantheonWideSocietyAssetSkillIds() {
  const p = bundle?.pantheons?.[character.pantheonId];
  if (!p || typeof p !== "object") return [];
  return validPathSkillIdArray(p.assetSkills);
}

/**
 * Asset Skills that appear on at least one patron row but not on the pantheon-wide list (after bundle stamp).
 * Used to clear a previous parent’s extra Asset Skill when it is not required for the newly selected parent.
 */
function patronAssetSkillsBeyondPantheonDefault(pantheonId) {
  const p = bundle?.pantheons?.[pantheonId];
  if (!p || typeof p !== "object") return [];
  const base = new Set(pantheonWideSocietyAssetSkillIds());
  const out = new Set();
  for (const key of ["deities", "titans"]) {
    const rows = Array.isArray(p[key]) ? p[key] : [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      for (const id of validPathSkillIdArray(row.assetSkills)) {
        if (!base.has(id)) out.add(id);
      }
    }
  }
  return [...out];
}

/**
 * Society Path: Asset Skill ids for the **active patron** (divine parent or Titan) when that row lists
 * `assetSkills` in the bundle; otherwise the pantheon’s `assetSkills` (Origin pp. 96–97). Patron rows are
 * stamped from pantheon defaults at bundle load; `data/patronAssetSkillOverrides.json` adjusts PB exceptions.
 */
function societyPatronAssetSkillIds() {
  const p = bundle?.pantheons?.[character.pantheonId];
  if (!p || typeof p !== "object") return [];
  const patron = selectedDeityRecord();
  const fromPatron = validPathSkillIdArray(patron?.assetSkills);
  if (fromPatron.length > 0) return fromPatron;
  return validPathSkillIdArray(p.assetSkills);
}

/** Paths step: show Virtues for the selected pantheon (from `virtues.json`). */
function fillPantheonVirtuesDisplay(pantheonId) {
  const el = document.getElementById("p-pantheon-virtues");
  if (!el) return;
  el.innerHTML = "";
  const pid = (pantheonId || "").trim();
  if (!pid) {
    const p = document.createElement("p");
    p.className = "help";
    p.textContent = "Choose a pantheon to see its Virtues (confirm wording in Pandora’s Box / your pantheon’s PDF chapter).";
    el.appendChild(p);
    return;
  }
  const pack = bundle.virtues?.[pid];
  const list = pack?.virtues;
  const pName = bundle.pantheons?.[pid]?.name || pid;
  if (!Array.isArray(list) || list.length === 0) {
    const p = document.createElement("p");
    p.className = "help";
    if (pid === "mythos") {
      const note = masksMotMBundle()?.virtuesNote;
      p.textContent =
        typeof note === "string" && note.trim()
          ? note.trim()
          : `Virtues for «${pName}» are defined in Scion: Masks of the Mythos — add a "mythos" block to data/virtues.json once transcribed from your PDF.`;
    } else {
      p.textContent = `Virtues for «${pName}» are not in this app’s data yet — see Pandora’s Box or that pantheon’s book chapter at the table.`;
    }
    el.appendChild(p);
    return;
  }
  const h = document.createElement("h3");
  h.className = "pantheon-virtues-heading";
  h.textContent = `Virtues — ${pName}`;
  el.appendChild(h);
  const ul = document.createElement("ul");
  ul.className = "pantheon-virtues-list";
  for (const v of list) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = v.name || v.id;
    li.appendChild(strong);
    if (v.description) {
      li.appendChild(document.createTextNode(" "));
      const span = document.createElement("span");
      span.className = "pantheon-virtue-desc";
      span.textContent = v.description;
      li.appendChild(span);
    }
    applyGameDataHint(li, v);
    ul.appendChild(li);
  }
  el.appendChild(ul);
}

/**
 * If the pantheon lists 1–3 Asset Skills, Society Path must include all of them.
 * Merges missing patron/pantheon assets ahead of other picks (trim to 3 total).
 * Strips pantheon Asset Skills that are no longer required after choosing a divine parent with a different
 * pair (e.g. Loa defaults Medicine & Subterfuge → Baron Samedi requires Integrity & Subterfuge; Medicine was
 * not the player’s “one free” pick, so do not carry it forward — Origin pp. 96–97).
 */
function ensureSocietyDefaultAssetSkills() {
  if (sorcererPathsHidePatronStack(character.tier)) return;
  const assets = societyPatronAssetSkillIds();
  if (!character.pantheonId || assets.length === 0 || assets.length > 3) return;
  const pantheonAssets = pantheonWideSocietyAssetSkillIds();
  const stalePantheonOnly = pantheonAssets.filter((id) => !assets.includes(id));
  const orphanPatronExtras = patronAssetSkillsBeyondPantheonDefault(character.pantheonId).filter((id) => !assets.includes(id));
  const soc0 = Array.isArray(character.pathSkills.society) ? [...character.pathSkills.society] : [];
  const rest = soc0
    .filter((s) => !assets.includes(s))
    .filter((s) => !stalePantheonOnly.includes(s))
    .filter((s) => !orphanPatronExtras.includes(s));
  character.pathSkills.society = [...assets, ...rest].slice(0, 3);
}

/**
 * Society Path must include every patron (or pantheon) Asset Skill plus enough other Skills to total three (Origin p. 97).
 * @param {string[]} nextArr
 */
function societySkillsAllowed(nextArr) {
  if (sorcererPathsHidePatronStack(character.tier)) return { ok: true };
  const pantheonId = String(character?.pantheonId ?? "").trim();
  const assets = societyPatronAssetSkillIds();
  if (!pantheonId || !Array.isArray(assets) || assets.length === 0) {
    return { ok: true };
  }
  const next = new Set(nextArr);
  if (next.size > 3) {
    return { ok: false, reason: "Society Path: choose at most three Skills." };
  }
  const maxNonAsset = Math.max(0, 3 - assets.length);
  const nonAsset = [...next].filter((id) => !assets.includes(id));
  if (nonAsset.length > maxNonAsset) {
    return {
      ok: false,
      reason:
        maxNonAsset === 0
          ? "Society Path: every Skill must be a patron / pantheon Asset Skill (Origin pp. 96–97)."
          : `Society Path: include all ${assets.length} patron / pantheon Asset Skills and at most ${maxNonAsset} other Skill(s) (Origin pp. 96–97).`,
    };
  }
  if (next.size === 3) {
    const missing = assets.filter((a) => !next.has(a));
    if (missing.length > 0) {
      const names = missing.map((id) => bundle.skills[id]?.name || id).join(" & ");
      return {
        ok: false,
        reason: `Society Path with three Skills must include every required Asset Skill. Still need: ${names}.`,
      };
    }
  }
  return { ok: true };
}

/** Each Path must list exactly three Skills; Society Path also obeys patron / pantheon Asset Skills (Origin pp. 96–97). */
function validateAllPathSkillsDetailed() {
  const issues = [];
  for (const pk of PATH_KEYS) {
    const raw = character.pathSkills[pk];
    const arr = Array.isArray(raw) ? raw : [];
    if (arr.length !== 3) {
      const label = pk === "society" ? "Society / Pantheon" : pk.charAt(0).toUpperCase() + pk.slice(1);
      issues.push({
        pathKey: pk,
        message: `${label} Path must list exactly three Skills (currently ${arr.length}). Origin p. 96.`,
      });
    }
  }
  const soc = Array.isArray(character.pathSkills.society) ? character.pathSkills.society : [];
  if (soc.length === 3 && !sorcererPathsHidePatronStack(character.tier)) {
    const v = societySkillsAllowed(soc);
    if (!v.ok) issues.push({ pathKey: "society", message: v.reason });
  }
  return { ok: issues.length === 0, issues };
}

function ensurePathSkillArrays() {
  if (!character.pathSkills) character.pathSkills = {};
  for (const pk of PATH_KEYS) {
    if (!Array.isArray(character.pathSkills[pk])) character.pathSkills[pk] = [];
  }
}

/** Human-readable Purview label for dropdowns (uses `purviews.json` when loaded). */
function purviewLabel(purviewId) {
  const row = bundle?.purviews?.[purviewId];
  if (row?.name) return row.name;
  if (!purviewId) return "";
  const spaced = purviewId.replace(/([A-Z])/g, " $1").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Standard Purview Innate summary for UI (same fallbacks as the character sheet). */
function purviewStandardInnateSummary(purviewId) {
  return purviewStandardInnateText(bundle, purviewId);
}

/**
 * @param {HTMLElement} container
 * @param {string} purviewId
 * @param {{ includeGrantedNote?: boolean }} [opts]
 */
function appendPurviewInnateDetails(container, purviewId, opts) {
  const includeGrantedNote = opts?.includeGrantedNote !== false;
  const mythos = isMythosPantheonSelected();
  const titanic = normalizedTierId(character.tier) === "titanic";
  const blocks = purviewInnateBlocks(bundle, purviewId, { mythosPantheon: mythos, titanicTier: titanic });
  if (includeGrantedNote) {
    const note = document.createElement("p");
    note.className = "purview-innate-granted-note";
    note.textContent = "Granted with this Purview — not a Boon pick.";
    container.appendChild(note);
  }
  for (const bl of blocks) {
    const wrap = document.createElement("div");
    wrap.className = "purview-innate-block";
    const lab = document.createElement("div");
    lab.className = "purview-innate-block-label";
    lab.textContent = bl.label;
    const body = document.createElement("div");
    body.className = "purview-innate-block-body";
    body.textContent = bl.body;
    wrap.appendChild(lab);
    wrap.appendChild(body);
    container.appendChild(wrap);
  }
}

/** Line shown for each divine parent `<option>` (name + purviews). */
function deityOptionLabel(deity) {
  const ids = Array.isArray(deity?.purviews) ? deity.purviews : [];
  if (ids.length === 0) return deity.name;
  const labels = ids.map(purviewLabel);
  return `${deity.name} — ${labels.join(", ")}`;
}

/** Rich hover payload for a divine parent option (deities omit `description` in JSON). */
function deityDocEntity(deity) {
  const p = selectedPantheon();
  const callingNames = (deity.callings || []).map((cid) => bundle.callings[cid]?.name || cid).join(", ");
  const purviewNames = (deity.purviews || []).map((pid) => bundle.purviews[pid]?.name || pid).join(", ");
  const desc = [
    callingNames && `Example Favored Callings: ${callingNames}.`,
    purviewNames && `Patron Purviews: ${purviewNames}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const src = (typeof deity.source === "string" && deity.source.trim()) || (typeof p?.source === "string" && p.source.trim()) || "";
  return {
    name: deity.name,
    description: desc || (patronKindIsTitan() ? "See Scion: Titanomachy for this Titan’s write-up." : "See Origin Appendix 2 for patron details."),
    source: src,
  };
}

function selectedDeityEntity() {
  const p = selectedPantheon();
  if (!p || !character.parentDeityId) return null;
  return patronListForPantheon(p).find((d) => d.id === character.parentDeityId) || null;
}

/** Pantheon Signature (Specialty) Purview id from `pantheons.json` — must exist in `purviews.json`. */
function pantheonSignaturePurviewId() {
  const p = bundle?.pantheons?.[character.pantheonId];
  const id = p && typeof p === "object" && !String(character.pantheonId || "").startsWith("_") ? p.signaturePurviewId : "";
  if (!id || typeof id !== "string") return "";
  if (bundle?.purviews && !bundle.purviews[id]) return "";
  return id;
}

/** Hero Æsir: older saves stored Signature as `fortune`; migrate to `wyrd` when parent does not grant Fortune. */
function migrateAesirLegacyFortuneSignatureToWyrd() {
  if (!bundle?.purviews?.wyrd || !bundle?.pantheons?.aesir) return;
  const tnA = normalizedTierId(character.tier);
  if ((tnA !== "hero" && tnA !== "titanic") || character.pantheonId !== "aesir") return;
  if (pantheonSignaturePurviewId() !== "wyrd") return;
  const ids = character.purviewIds || [];
  if (ids.includes("wyrd")) return;
  if (!ids.includes("fortune")) return;
  if (patronPurviewOptionIds().includes("fortune")) return;
  character.purviewIds = ids.map((id) => (id === "fortune" ? "wyrd" : id));
}

/**
 * Hero/Titanic: older bundles used universal Purview ids for pantheon Signatures that Pandora’s Box names separately.
 * When the parent’s patron list does not grant the legacy id, swap it for the current `signaturePurviewId`.
 */
function migrateLegacyPantheonSignaturePurviewIds() {
  const t = normalizedTierId(character.tier);
  if (t !== "hero" && t !== "titanic") return;
  const rows = [
    ["kami", "yaoyorozuNoKamigami", "moon"],
    ["manitou", "dodaem", "wild"],
    ["netjer", "heku", "order"],
    ["deva", "yoga", "health"],
    ["shen", "tianming", "order"],
  ];
  for (const [pant, sig, legacy] of rows) {
    if (character.pantheonId !== pant) continue;
    if (pantheonSignaturePurviewId() !== sig) continue;
    if (!bundle?.purviews?.[sig]) continue;
    const ids = character.purviewIds || [];
    if (!ids.includes(legacy) || ids.includes(sig)) continue;
    if (patronPurviewOptionIds().includes(legacy)) continue;
    character.purviewIds = ids.map((id) => (id === legacy ? sig : id));
  }
}

/** Book-facing Signature Purview name from `purviews.json` (and optional `signaturePurviewLabel` legacy rename). */
function pantheonSignaturePurviewDisplayLabel() {
  const id = pantheonSignaturePurviewId();
  if (!id) return "";
  return purviewDisplayNameForPantheon(id, bundle, character.pantheonId);
}

/** Deduped Purview ids granted by the current divine parent (Appendix 2 / patron list). */
function patronPurviewOptionIds() {
  const d = selectedDeityEntity();
  const raw = Array.isArray(d?.purviews) ? d.purviews : [];
  return [...new Set(raw)].sort((a, b) => purviewLabel(a).localeCompare(purviewLabel(b), undefined, { sensitivity: "base" }));
}

/** Hero / Titanic: keep only parent innate Purview(s) in slot 0 and pantheon Signature Purview; strip other ids. */
function restrictHeroPurviewsToPatronList() {
  const t = normalizedTierId(character.tier);
  if (t !== "hero" && t !== "titanic") return;
  ensurePatronPurviewSlots();
  syncPurviewIdsFromPatronSlots();
  migrateAesirLegacyFortuneSignatureToWyrd();
  migrateLegacyPantheonSignaturePurviewIds();
  const patronOpts = patronPurviewOptionIds();
  const patronSet = new Set(patronOpts);
  const sig = pantheonSignaturePurviewId();
  const allowed = new Set(patronSet);
  if (sig) allowed.add(sig);
  if (patronOpts.length === 0 && !sig) return;
  character.purviewIds = (character.purviewIds || []).filter((id) => allowed.has(id));
  character.patronPurviewSlots = character.patronPurviewSlots.map((s, i) => {
    if (i > 0) return "";
    return patronSet.has(s) ? s : "";
  });
  syncPurviewIdsFromPatronSlots();
}

function ensurePatronPurviewSlots() {
  if (!Array.isArray(character.patronPurviewSlots) || character.patronPurviewSlots.length !== PATRON_PURVIEW_SLOT_COUNT) {
    character.patronPurviewSlots = Array(PATRON_PURVIEW_SLOT_COUNT).fill("");
  }
}

/** Fill patron slots from `purviewIds`, keeping only ids the current parent grants (respects tier slot cap). */
function hydratePatronPurviewSlotsFromPurviewIds() {
  ensurePatronPurviewSlots();
  const lim = patronPurviewSlotLimitForCharacter();
  const slotCap = lim <= 0 ? 0 : Math.min(PATRON_PURVIEW_SLOT_COUNT, lim);
  const allowed = new Set(patronPurviewOptionIds());
  if (slotCap === 0) {
    character.patronPurviewSlots = Array(PATRON_PURVIEW_SLOT_COUNT).fill("");
    return;
  }
  const seen = new Set();
  const fromIds = [];
  for (const id of character.purviewIds || []) {
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    fromIds.push(id);
    if (fromIds.length >= slotCap) break;
  }
  const slots = Array(PATRON_PURVIEW_SLOT_COUNT).fill("");
  for (let i = 0; i < fromIds.length; i += 1) slots[i] = fromIds[i];
  character.patronPurviewSlots = slots;
}

/** Merge patron slots into `purviewIds`. Hero: one parent innate + pantheon Signature; other tiers: picks then extras. */
function syncPurviewIdsFromPatronSlots() {
  ensurePatronPurviewSlots();
  const picks = character.patronPurviewSlots.filter(Boolean);
  const tn = normalizedTierId(character.tier);
  if (tn === "hero" || tn === "titanic") {
    const parent = picks[0] || "";
    const sig = pantheonSignaturePurviewId();
    const merged = [];
    if (parent) merged.push(parent);
    if (sig) merged.push(sig);
    character.purviewIds = [...new Set(merged)];
    return;
  }
  const pickSet = new Set(picks);
  const extras = (character.purviewIds || []).filter((id) => !pickSet.has(id));
  character.purviewIds = [...picks, ...extras];
}

/** After pantheon / divine parent change: drop invalid patron picks and re-merge `purviewIds`. */
function onPatronPurviewContextChange() {
  ensurePatronPurviewSlots();
  const allowed = new Set(patronPurviewOptionIds());
  character.patronPurviewSlots = character.patronPurviewSlots.map((s) => (allowed.has(s) ? s : ""));
  hydratePatronPurviewSlotsFromPurviewIds();
  syncPurviewIdsFromPatronSlots();
}

function commitPatronPurviewSlotChange(slotIndex, newVal) {
  ensurePatronPurviewSlots();
  const slots = [...character.patronPurviewSlots];
  const old = slots[slotIndex];
  if (newVal === old) return;
  const other = slots.findIndex((v, j) => j !== slotIndex && v === newVal && newVal);
  if (other >= 0) {
    slots[slotIndex] = newVal;
    slots[other] = old;
  } else {
    slots[slotIndex] = newVal;
  }
  character.patronPurviewSlots = slots;
  syncPurviewIdsFromPatronSlots();
  render();
}

function renderPatronPurviewPanel(mount) {
  if (!mount) return;
  mount.innerHTML = "";
  ensurePatronPurviewSlots();
  const panel = document.createElement("div");
  panel.className = "panel patron-purviews-panel";
  const h = document.createElement("h2");
  h.textContent = "Patron Purviews (parent)";
  panel.appendChild(h);
  const opts = patronPurviewOptionIds();
  const deity = selectedDeityEntity();
  if (!deity) {
    const p = document.createElement("p");
    p.className = "help";
    p.textContent =
      "Choose a patron (God or Titan) to assign Purview picks from that parent’s list (Origin Appendix 2 for Gods; Titanomachy for Titans; Hero / Titanic Visitation).";
    panel.appendChild(p);
    mount.appendChild(panel);
    applyHint(panel, "patron-purviews");
    return;
  }
  if (opts.length === 0) {
    const p = document.createElement("p");
    p.className = "help";
    p.textContent = isMythosPantheonSelected()
      ? "This divine parent has no patron Purview ids in data yet — transcribe the patron’s list from Masks of the Mythos into pantheons.json (or run scripts/ingest_masks_of_the_mythos_pdf.py for raw text to work from)."
      : "This parent has no Purview ids in data; add them to pantheons.json or pick another parent.";
    panel.appendChild(p);
    mount.appendChild(panel);
    applyHint(panel, "patron-purviews");
    return;
  }
  const slotLim = patronPurviewSlotLimitForCharacter();
  if (slotLim <= 0) {
    const p = document.createElement("p");
    p.className = "help";
    p.textContent =
      "This tier does not assign patron Purview slots on Paths — choose Purviews (including Magic for Sorcerers) on the Purviews step.";
    panel.appendChild(p);
    mount.appendChild(panel);
    applyHint(panel, "patron-purviews");
    return;
  }
  const intro = document.createElement("p");
  intro.className = "help";
  const tierPv = normalizedTierId(character.tier);
  if (tierPv === "hero" || tierPv === "titanic") {
    const sig = pantheonSignaturePurviewId();
    const sigLab = sig ? pantheonSignaturePurviewDisplayLabel() : "— (set pantheon in data)";
    const tierLab = tierPv === "titanic" ? "Titanic (Hero-tier)" : "Hero";
    intro.innerHTML = `At <strong>${tierLab}</strong>, pick <strong>one innate Purview</strong> from this parent’s list below. Your pantheon’s <strong>Signature Purview</strong> (<strong>${sigLab}</strong>) is added automatically on the Purviews step — you do not spend your single pick on it.`;
  } else {
    intro.textContent = `Choose up to ${slotLim} Purview(s) from this parent’s patron list only (same id may not appear twice — changing a slot to one already chosen swaps the two). Other Purviews (Relics, etc.) are chosen on the Purviews step.`;
  }
  panel.appendChild(intro);
  const grid = document.createElement("div");
  grid.className = "grid-2";
  for (let i = 0; i < slotLim; i += 1) {
    const field = document.createElement("div");
    field.className = "field";
    const lab = document.createElement("label");
    lab.htmlFor = `p-patron-pv-${i}`;
    lab.textContent = `Patron Purview ${i + 1}`;
    const sel = document.createElement("select");
    sel.id = `p-patron-pv-${i}`;
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "—";
    sel.appendChild(blank);
    for (const pid of opts) {
      const o = document.createElement("option");
      o.value = pid;
      o.textContent = purviewLabel(pid);
      const pv = bundle.purviews?.[pid];
      if (pv && typeof pv === "object") applyGameDataHint(o, pv);
      sel.appendChild(o);
    }
    sel.value = character.patronPurviewSlots[i] || "";
    sel.addEventListener("change", () => {
      commitPatronPurviewSlotChange(i, sel.value);
    });
    field.appendChild(lab);
    field.appendChild(sel);
    const slotPid = character.patronPurviewSlots[i] || "";
    if (slotPid) {
      const innateBox = document.createElement("div");
      innateBox.className = "patron-purview-innate-desc";
      appendPurviewInnateDetails(innateBox, slotPid, { includeGrantedNote: false });
      field.appendChild(innateBox);
    }
    grid.appendChild(field);
  }
  panel.appendChild(grid);
  mount.appendChild(panel);
  applyHint(panel, "patron-purviews");
}

function arenaPools() {
  const [a1, a2, a3] = character.arenaRank;
  return { [a1]: 6, [a2]: 4, [a3]: 2 };
}

/** Extra dots (−1 each) per arena for a pre–Favored attribute map. */
function attributeArenaSums(attrs) {
  const sums = { Physical: 0, Mental: 0, Social: 0 };
  for (const arena of ARENA_ORDER) {
    for (const id of ARENAS[arena]) {
      const v = attrs[id] ?? 1;
      sums[arena] += Math.max(0, v - 1);
    }
  }
  return sums;
}

/** Pre–Favored dots from Finishing only in one arena (sum of current − Attributes-step snapshot per Attribute there). */
function finishingArenaExtraDelta(attrs, baseline, arena) {
  if (!baseline || typeof baseline !== "object") return 0;
  let d = 0;
  for (const id of ARENAS[arena]) {
    d += Math.max(0, (attrs[id] ?? 1) - (baseline[id] ?? 1));
  }
  return d;
}

function arenaForAttribute(attrId) {
  for (const arena of ARENA_ORDER) {
    if (ARENAS[arena].includes(attrId)) return arena;
  }
  return null;
}

/** Max rating (1–5) for this attribute given siblings in the same arena and current 6/4/2 pool. */
function maxAttrRatingForArena(attrId, attrs) {
  const arena = arenaForAttribute(attrId);
  if (!arena) return 5;
  const pool = arenaPools()[arena];
  let others = 0;
  for (const oid of ARENAS[arena]) {
    if (oid === attrId) continue;
    others += Math.max(0, (attrs[oid] ?? 1) - 1);
  }
  return Math.max(1, Math.min(5, 1 + pool - others));
}

/** Max dots after Favored Approach (+2 to approach Attributes, cap 5) for UI and clicking. */
function maxFinalRatingForAttr(attrId, attrsPre) {
  const preMax = maxAttrRatingForArena(attrId, attrsPre);
  const fav = character.favoredApproach;
  if (APPROACH_ATTRS[fav].includes(attrId)) return Math.min(5, preMax + 2);
  return preMax;
}

/**
 * Dot row: always 5 positions; `value` / fills use final ratings (post–Favored Approach).
 * @param {number | null} [lockedFinalThrough] When set (e.g. Finishing), filled dots with index <= this value use a darker fill so dots above show the new finishing bump only.
 */
function renderFinalAttrDotRow(
  label,
  finalValue,
  maxFinal,
  onPickFinal,
  attrMeta,
  minFinal = 1,
  ariaSuffix = "(after Favored Approach)",
  lockedFinalThrough = null,
) {
  const row = document.createElement("div");
  row.className = "dot-row";
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
    const allowed = i >= minFinal && i <= maxFinal;
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

/**
 * Minimum pre–Favored rating while trimming to Origin 6 / 4 / 2 arena pools.
 * After Finishing has spent attribute dots, do not drop below the Attributes-step snapshot (`attrBaseline`).
 */
function attrMinWhileNormalizingPools(attrId) {
  if (finishingAttrDotsPlaced() <= 0) return 1;
  const b = character.finishing?.attrBaseline;
  if (!b || typeof b !== "object") return 1;
  const v = Math.round(Number(b[attrId]));
  if (Number.isNaN(v)) return 1;
  return Math.max(1, Math.min(5, v));
}

/**
 * If an arena uses more extra dots than its pool (e.g. after changing arena priority or importing JSON),
 * lower pre–Favored ratings until it fits (Origin p. 97). When an Attributes-step snapshot exists, each arena’s
 * allowed total includes Finishing bumps above that snapshot (Origin p. 98 — no arena restriction on that dot).
 */
function normalizeCharacterAttributesToPools() {
  ensureFinishingShape();
  const attrs = character.attributes;
  const baseLine = character.finishing.attrBaseline;
  const baseIsObj = baseLine && typeof baseLine === "object";
  for (const id of Object.keys(bundle.attributes)) {
    if (id.startsWith("_")) continue;
    if (attrs[id] == null || attrs[id] < 1) attrs[id] = 1;
    if (attrs[id] > 5) attrs[id] = 5;
  }
  for (const arena of ARENA_ORDER) {
    const pool = arenaPools()[arena];
    const ids = ARENAS[arena];
    let sum = ids.reduce((s, id) => s + Math.max(0, (attrs[id] ?? 1) - 1), 0);
    while (true) {
      const cap =
        pool + (baseIsObj && baseLine ? finishingArenaExtraDelta(attrs, baseLine, arena) : 0);
      if (sum <= cap) break;
      let hi = null;
      for (const id of ids) {
        const v = attrs[id] ?? 1;
        const floor = attrMinWhileNormalizingPools(id);
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
        if (baseIsObj) baseLine[hi] = attrs[hi];
        continue;
      }
      attrs[hi] -= 1;
      sum -= 1;
      if (baseIsObj && typeof baseLine[hi] === "number" && attrs[hi] < baseLine[hi]) {
        baseLine[hi] = attrs[hi];
      }
    }
  }
}

function applyFavoredApproach(baseAttrs) {
  const out = { ...baseAttrs };
  const fav = character.favoredApproach;
  for (const id of APPROACH_ATTRS[fav]) {
    out[id] = (out[id] ?? 1) + 2;
  }
  for (const id of Object.keys(out)) {
    if (out[id] > 5) out[id] = 5;
  }
  return out;
}

function validateAttributes(attrs) {
  const pools = arenaPools();
  const sums = attributeArenaSums(attrs);
  const baseline = character.finishing?.attrBaseline;
  const hasB = baseline && typeof baseline === "object";
  const baseSums = hasB ? attributeArenaSums(baseline) : null;
  const msgs = [];
  let totalFinishingAttrBump = 0;
  if (hasB) {
    for (const aid of Object.keys(baseline)) {
      if (String(aid).startsWith("_")) continue;
      totalFinishingAttrBump += Math.max(0, (attrs[aid] ?? 1) - (baseline[aid] ?? 1));
    }
    const finAttrBudget = Math.max(0, Math.round(Number(character.finishing?.extraAttributeDots) || 0));
    if (totalFinishingAttrBump > finAttrBudget) {
      msgs.push(
        `Raised ${totalFinishingAttrBump} total pre–Favored dot(s) above the Attributes-step snapshot but only ${finAttrBudget} Finishing Attribute dot(s) are allowed (Origin p. 98).`,
      );
    }
  }
  for (const arena of ARENA_ORDER) {
    const s = sums[arena];
    const p = pools[arena];
    if (hasB) {
      const bs = baseSums[arena];
      if (bs !== p) {
        msgs.push(
          `${arena} arena: your Attributes-step snapshot has ${bs} extra dots vs this arena’s current rank (${p}). Re-open Attributes after changing arena priority, or re-import (Origin p. 97).`,
        );
      }
    }
    const finDelta = hasB ? finishingArenaExtraDelta(attrs, baseline, arena) : 0;
    if (s > p + finDelta) {
      msgs.push(
        `${arena} arena: at most ${p} extra dots from the Attributes step, plus up to ${finDelta} from your Finishing Attribute dot(s) in this arena (you have ${s}; Origin pp. 97–98).`,
      );
    } else if (s < p) {
      msgs.push(
        `${arena} arena: distribute exactly ${p} extra dots beyond the 1‑dot base in each Attribute (currently ${s}; Origin p. 97).`,
      );
    }
  }
  for (const id of Object.keys(attrs)) {
    const v = attrs[id];
    if (v < 1 || v > 5) msgs.push(`${id} must stay between 1 and 5 before applying Favored Approach.`);
  }
  return msgs;
}

function ensureFinishingShape() {
  character.finishing ||= {};
  const f = character.finishing;
  if (heroFinishingOmittedAfterOriginAdvance()) {
    f.extraSkillDots = 0;
    f.extraAttributeDots = 0;
  } else {
    if (f.extraSkillDots == null) f.extraSkillDots = 5;
    if (f.extraAttributeDots == null) f.extraAttributeDots = 1;
  }
  if (!f.knackOrBirthright) f.knackOrBirthright = "knacks";
  const tnFin = normalizedTierId(character.tier);
  if ((tnFin === "hero" || tnFin === "titanic" || tnFin === "sorcerer_hero") && f.knackOrBirthright === "birthrights") {
    f.knackOrBirthright = "knacks";
  }
  if (!Array.isArray(f.finishingKnackIds)) f.finishingKnackIds = [];
  else
    f.finishingKnackIds = [...new Set(f.finishingKnackIds.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")))];
  if (!Array.isArray(f.birthrightPicks)) f.birthrightPicks = [];
}

/** Snapshot for “finishing” budget: call when leaving Skills (Path + dot totals). */
function captureFinishingSkillBaseline() {
  ensureFinishingShape();
  ensureSkillDots();
  character.finishing.skillBaseline = Object.fromEntries(skillIds().map((id) => [id, character.skillDots[id] || 0]));
}

/** Snapshot when leaving Attributes (pre–Favored Approach ratings). */
function captureFinishingAttrBaseline() {
  ensureFinishingShape();
  const b = {};
  for (const id of Object.keys(bundle.attributes)) {
    b[id] = character.attributes[id] ?? 1;
  }
  character.finishing.attrBaseline = b;
}

function ensureFinishingBaselines() {
  ensureFinishingShape();
  if (!character.finishing.skillBaseline) {
    ensureSkillDots();
    character.finishing.skillBaseline = Object.fromEntries(skillIds().map((id) => [id, character.skillDots[id] || 0]));
  }
  if (!character.finishing.attrBaseline) {
    const b = {};
    for (const id of Object.keys(bundle.attributes)) {
      b[id] = character.attributes[id] ?? 1;
    }
    character.finishing.attrBaseline = b;
  }
}

function finishingSkillDotsPlaced() {
  const b = character.finishing.skillBaseline;
  if (!b) return 0;
  return skillIds().reduce((sum, id) => sum + Math.max(0, (character.skillDots[id] || 0) - (b[id] || 0)), 0);
}

function finishingSkillDotsRemaining() {
  return Math.max(0, (character.finishing.extraSkillDots || 0) - finishingSkillDotsPlaced());
}

function maxSkillFinishing(sid) {
  const b = character.finishing.skillBaseline;
  if (!b) return Math.min(5, character.skillDots[sid] || 0);
  const placedOthers = skillIds()
    .filter((id) => id !== sid)
    .reduce((sum, id) => sum + Math.max(0, (character.skillDots[id] || 0) - (b[id] || 0)), 0);
  const cap = (b[sid] || 0) + Math.max(0, (character.finishing.extraSkillDots || 0) - placedOthers);
  return Math.min(5, cap);
}

function finishingAttrDotsPlaced() {
  const b = character.finishing.attrBaseline;
  if (!b) return 0;
  return Object.keys(bundle.attributes).reduce(
    (sum, id) => sum + Math.max(0, (character.attributes[id] ?? 1) - (b[id] ?? 1)),
    0,
  );
}

function finishingAttrDotsRemaining() {
  return Math.max(0, (character.finishing.extraAttributeDots || 0) - finishingAttrDotsPlaced());
}

function maxPreFavoredUnderLegendCap(attrId, attrs) {
  for (let v = 5; v >= 1; v -= 1) {
    const trial = { ...attrs, [attrId]: v };
    if (applyFavoredApproach(trial)[attrId] <= 5) return v;
  }
  return 1;
}

function maxAttrFinishing(attrId) {
  ensureFinishingBaselines();
  const attrs = {};
  for (const id of Object.keys(bundle.attributes)) {
    attrs[id] = character.attributes[id] ?? 1;
  }
  const b = character.finishing.attrBaseline;
  const placedOthers = Object.keys(bundle.attributes)
    .filter((oid) => oid !== attrId)
    .reduce((s, oid) => s + Math.max(0, (attrs[oid] ?? 1) - (b[oid] ?? 1)), 0);
  const budget = character.finishing.extraAttributeDots || 0;
  const fromBudget = (b[attrId] ?? 1) + Math.max(0, budget - placedOthers);
  const fromLegend = maxPreFavoredUnderLegendCap(attrId, attrs);
  /** Origin p. 98: Finishing Attribute dot may go on any one Attribute; p. 97 five-dot cap still applies — no arena pool on this bump. */
  return Math.min(5, fromBudget, fromLegend);
}

function buildCharacterAttrsPre() {
  const attrs = {};
  for (const id of Object.keys(bundle.attributes)) {
    attrs[id] = character.attributes[id] ?? 1;
  }
  return attrs;
}

/** Highest final dot allowed after finishing budget + legend cap, given current pre on other attrs. */
function maxFinalAttrFinishing(attrId) {
  const attrs = buildCharacterAttrsPre();
  const maxPre = maxAttrFinishing(attrId);
  return applyFavoredApproach({ ...attrs, [attrId]: maxPre })[attrId];
}

function birthrightPointCost(bid) {
  return bundle.birthrights[bid]?.pointCost ?? 1;
}

/** Tag display names for an equipment row (from `tags.json` when present). */
function equipmentTagLabelList(eq) {
  return (Array.isArray(eq?.tagIds) ? eq.tagIds : [])
    .map((tid) => String(bundle.tags?.[tid]?.name || tid))
    .filter(Boolean);
}

/** One line for the picker “Description & tags” column. */
function equipmentPickerDescriptionLine(eq) {
  const desc = typeof eq?.description === "string" ? eq.description.trim() : "";
  const tags = equipmentTagLabelList(eq);
  const tagStr = tags.join(", ");
  if (desc && tagStr) return `${desc} — Tags: ${tagStr}`;
  if (desc) return desc;
  if (tagStr) return `Tags: ${tagStr}`;
  return "—";
}

/**
 * Finishing-step birthright catalog “Summary” cell: description (if any), tags, birthright type, mechanical usage.
 */
function birthrightFinishingSummaryLine(br) {
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

/** Lowercase haystack for equipment picker (name, type, id, tags, description). */
function equipmentFilterHaystack(eid, eq) {
  const tagNames = equipmentTagLabelList(eq).join(" ");
  const desc = typeof eq?.description === "string" ? eq.description : "";
  const mech = typeof eq?.mechanicalEffects === "string" ? eq.mechanicalEffects : "";
  return `${eq?.name || ""} ${eid} ${eq?.equipmentType || ""} ${tagNames} ${desc} ${mech}`.trim().toLowerCase();
}

/** Mortal / Origin (Finishing): 4 pts. Hero: 7 total on the Birthrights step (not 7+4 combined). Demigod/God: 11 (confirm at table). */
function maxBirthrightPointsBudget() {
  const t = normalizedTierId(character.tier);
  if (t === "hero" || t === "titanic" || t === "sorcerer_hero") return 7;
  if (t === "demigod" || t === "god" || t === "sorcerer_demigod" || t === "sorcerer_god") return 11;
  return 4;
}

/** Drop picks from the end until points ≤ tier cap (e.g. after lowering Hero from 11→7). */
function trimBirthrightPicksToBudget() {
  ensureFinishingShape();
  const cap = maxBirthrightPointsBudget();
  const arr = character.finishing.birthrightPicks;
  while (arr.length > 0) {
    const used = arr.reduce((s, id) => s + birthrightPointCost(id), 0);
    if (used <= cap) break;
    arr.pop();
  }
}

/** Remove Boon ids that no longer exist in the loaded bundle (e.g. after regenerating boons.json). */
function pruneStaleBoonIds() {
  const tbl = bundle?.boons;
  if (!tbl || typeof tbl !== "object") return;
  const valid = new Set(Object.keys(tbl).filter((k) => !k.startsWith("_")));
  let ids = (character.boonIds || []).filter((id) => {
    if (!valid.has(id)) return false;
    const b = tbl[id];
    return !boonIsPurviewInnateAutomaticGrant(b, bundle);
  });
  if (ids.length > MAX_WIZARD_BOON_PICKS) ids = ids.slice(0, MAX_WIZARD_BOON_PICKS);
  character.boonIds = ids;
}

function finishingBirthrightPointsUsed() {
  return (character.finishing.birthrightPicks || []).reduce((s, id) => s + birthrightPointCost(id), 0);
}

function toggleFinishingKnack(kid) {
  ensureFinishingShape();
  const arr = [...character.finishing.finishingKnackIds];
  const i = arr.indexOf(kid);
  if (i >= 0) {
    arr.splice(i, 1);
    character.finishing.finishingKnackIds = arr;
    return;
  }
  if ((character.knackIds || []).includes(kid)) return;
  const uniqFin = [...new Set(arr)];
  if (uniqFin.length >= 2) return;
  const k = bundle.knacks[kid];
  if (!k || !knackEligibleForFinishingExtraKnack(k, character, bundle)) return;
  character.finishing.finishingKnackIds = [...uniqFin, kid];
}

function addFinishingBirthright(bid) {
  ensureFinishingShape();
  const cost = birthrightPointCost(bid);
  if (finishingBirthrightPointsUsed() + cost <= maxBirthrightPointsBudget()) {
    character.finishing.birthrightPicks = [...character.finishing.birthrightPicks, bid];
  }
}

function removeFinishingBirthright(index) {
  ensureFinishingShape();
  const next = [...character.finishing.birthrightPicks];
  next.splice(index, 1);
  character.finishing.birthrightPicks = next;
}

/**
 * Hero after Visitation from Origin: Origin Finishing already spent the extra Skill / Attribute dots (p. 99);
 * Hero does not grant another Finishing step or another 5+1 budget in this wizard.
 */
function heroFinishingOmittedAfterOriginAdvance() {
  const tn = normalizedTierId(character.tier);
  if (tn !== "hero" && tn !== "titanic" && tn !== "sorcerer_hero") return false;
  return (character.tierAdvancementLog || []).some(
    (e) =>
      e &&
      typeof e === "object" &&
      ((normalizedTierId(e.fromTier) === "mortal" &&
        (normalizedTierId(e.toTier) === "hero" || normalizedTierId(e.toTier) === "titanic")) ||
        (String(e.fromTier || "").trim() === "sorcerer" && String(e.toTier || "").trim() === "sorcerer_hero")),
  );
}

function stepDefsForTier(tierId) {
  /** Dragon Heir: shared pantheon/Origin spine only; Heir track is the Dragon tab. */
  const id = isDragonHeirChargen(character) ? "mortal" : normalizedTierId(tierId);
  const tier = bundle?.tier?.[id];
  const raw = tier?.wizardSteps || ["welcome", "concept", "paths", "skills", "attributes", "calling", "finishing", "review"];
  const steps = [...raw];
  if (
    !isDragonHeirChargen(character) &&
    (normalizedTierId(tierId) === "hero" ||
      normalizedTierId(tierId) === "titanic" ||
      normalizedTierId(tierId) === "sorcerer_hero") &&
    heroFinishingOmittedAfterOriginAdvance()
  ) {
    return steps.filter((s) => s !== "finishing");
  }
  return steps;
}

/** Purviews / Boons / patron Purview UI follow `tier.json` wizardSteps (Hero+, not Origin Mortal). */
function tierHasPurviewStep(tierId) {
  return stepDefsForTier(tierId).includes("purviews");
}

/**
 * Hero: when the divine parent lists patron Purviews, require exactly one pick in `patronPurviewSlots[0]` before leaving the Purviews step.
 * @returns {string} Empty if satisfied; otherwise a short user-facing reason.
 */
function heroPurviewsPatronPickRequiredAndMissing() {
  const tn = normalizedTierId(character.tier);
  if (tn !== "hero" && tn !== "titanic") return "";
  const patronOpts = patronPurviewOptionIds();
  if (patronOpts.length === 0) return "";
  ensurePatronPurviewSlots();
  const pick = String(character.patronPurviewSlots?.[0] || "").trim();
  if (pick && patronOpts.includes(pick)) return "";
  return "Choose one innate Purview from your divine parent’s patron list (use a chip in Patron innate Purview above, or the Patron Purview control on Paths) before continuing.";
}

/** Patron Purview dropdown count on Paths (from `tier.json` patronPurviewSlotCount, capped at four). */
function patronPurviewSlotLimitForCharacter() {
  if (!tierHasPurviewStep(character.tier)) return 0;
  const raw = bundle.tier[character.tier]?.patronPurviewSlotCount;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.min(Math.floor(n), PATRON_PURVIEW_SLOT_COUNT);
  return PATRON_PURVIEW_SLOT_COUNT;
}

/** Mortal / Sorcerer (no Purviews step): drop Purview and Boon picks so export and gates match the books. */
function clearPurviewsAndBoonsIfInapplicableTier() {
  if (tierHasPurviewStep(character.tier)) return;
  character.purviewIds = [];
  character.patronPurviewSlots = Array(PATRON_PURVIEW_SLOT_COUNT).fill("");
  character.boonIds = [];
}

/** First wizard step id present in `newTier` but not in `oldTier` (same lists → Review). */
function firstNewWizardStepIndex(oldTierId, newTierId) {
  const oldN = normalizedTierId(oldTierId);
  const newN = normalizedTierId(newTierId);
  /** Sorcerer Mortal band → Heroic band: set three Calling rows before Paraphernalia / Purviews. */
  if (oldN === "sorcerer" && newN === "sorcerer_hero") {
    const steps = stepDefsForTier(newTierId);
    const ci = steps.indexOf("calling");
    if (ci >= 0) return ci;
  }
  /** Visitation: pick Callings & dots before new Hero-only steps (Purviews, …). */
  if (oldN === "mortal" && (newN === "hero" || newN === "titanic")) {
    const steps = stepDefsForTier(newTierId);
    const ci = steps.indexOf("calling");
    if (ci >= 0) return ci;
  }
  const oldSet = new Set(stepDefsForTier(oldTierId));
  const steps = stepDefsForTier(newTierId);
  const idx = steps.findIndex((s) => !oldSet.has(s));
  if (idx >= 0) return idx;
  const ri = steps.indexOf("review");
  return ri >= 0 ? ri : Math.max(0, steps.length - 1);
}

function buildAdvanceConfirmMessage(adv, nextTierName) {
  const lines = [
    `Advance to ${nextTierName}?`,
    "",
    adv.source || "",
    "",
    ...(Array.isArray(adv.checklist) ? adv.checklist : []),
  ];
  return lines.filter((s) => s !== "").join("\n");
}

/**
 * Apply bundled tier-advancement rules (books cited in `data/tierAdvancement.json`).
 * @returns {{ oldTier: string, newTier: string } | null}
 */
function applyTierAdvancementFromBundle() {
  ensureFinishingShape();
  const cur = character.tier;
  const adv = getTierAdvancementRule(cur);
  if (!adv?.nextTier) return null;
  const next = adv.nextTier;
  character.tierAdvancementLog = [
    ...(Array.isArray(character.tierAdvancementLog) ? character.tierAdvancementLog : []),
    {
      fromTier: cur,
      toTier: next,
      appliedAt: new Date().toISOString(),
      source: adv.source || "",
      checklist: Array.isArray(adv.checklist) ? [...adv.checklist] : [],
    },
  ];
  character.tier = next;
  const nextN = normalizedTierId(next);
  if (normalizedTierId(cur) === "mortal" && (nextN === "hero" || nextN === "titanic")) {
    initHeroCallingSlotsAfterVisitation();
  }
  if (String(cur).trim() === "sorcerer" && nextN === "sorcerer_hero") {
    initHeroCallingSlotsAfterVisitation();
  }
  if (nextN === "hero" || nextN === "titanic") restrictHeroPurviewsToPatronList();
  syncLegendToTier();
  ensureFinishingShape();
  captureFinishingSkillBaseline();
  captureFinishingAttrBaseline();
  return { oldTier: cur, newTier: next };
}

function renderAppMainTabs() {
  const tabs = document.getElementById("app-main-tabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  const mk = (id, label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn app-main-tab" + (appMainTab === id ? " primary" : " secondary");
    b.textContent = label;
    b.addEventListener("click", () => {
      if (appMainTab === "wizard") persistFromForm();
      appMainTab = id;
      render();
    });
    tabs.appendChild(b);
  };
  mk("wizard", "Character wizard");
  mk("birthrights_data", "Birthright library");
  mk("tags_data", "Tags library");
  mk("equipment_data", "Equipment library");
}

function updateHeaderTierDisplay() {
  const el = document.getElementById("header-tier-display");
  if (!el || !bundle?.tier) return;
  el.innerHTML = "";
  if (isDragonHeirChargen(character) && bundle?.dragonTier && bundle?.dragonFlights) {
    ensureDragonShape(character, bundle);
    const d = character.dragon;
    const inh = String(d.inheritance ?? "1");
    const m = bundle.dragonTier?.inheritanceTrack?.[inh];
    el.title =
      "Heirs use Inheritance (1–10; True Dragon at 10) instead of Legend for this line. Chargen follows the shared Origin spine plus the Dragon tab (Scion: Dragon pp. 110–119).";
    const tierLine = document.createElement("div");
    tierLine.className = "header-tier-line";
    const fl = bundle.dragonFlights[d.flightId];
    const stageLab = m?.name ? `Dragon-${m.name}` : `Dragon-Inheritance ${inh}`;
    tierLine.textContent = fl?.name ? `${stageLab} — ${fl.name}` : `${stageLab} (pick Flight on Paths)`;
    el.appendChild(tierLine);
    return;
  }
  el.title =
    "New characters start at Origin (Mortal). Use Review → Advance to next tier after Visitation. Set Legend on the Review character sheet (Legend row).";
  if (isMythosPantheonSelected()) {
    el.title +=
      " Mythos Scions track Awareness (1–10): click a dot to set, or the rightmost filled dot again to lower by one (minimum 1).";
  }
  const t = bundle.tier[character.tier];
  const tierLine = document.createElement("div");
  tierLine.className = "header-tier-line";
  const tn = normalizedTierId(character.tier);
  const linePrefix = isSorcererLineTier(character.tier) ? "Sorcerer" : patronKindIsTitan() ? "Titan" : "Deity";
  let tierSlab = t?.name || character.tier;
  if (tn === "titanic") tierSlab = "Hero (Titanic Scion)";
  tierLine.textContent = `${linePrefix}-${tierSlab}`;
  el.appendChild(tierLine);
  if (isMythosPantheonSelected()) {
    const awRow = document.createElement("div");
    awRow.className = "header-legend-row";
    const awLab = document.createElement("span");
    awLab.className = "header-legend-label";
    awLab.textContent = "Awareness";
    awRow.appendChild(awLab);
    awRow.appendChild(buildAwarenessDotTrack(character.awarenessRating ?? 1, character.tier, true));
    el.appendChild(awRow);
  }
}

/** After changing wizard step, scroll so the step nav / top of content is in view (avoids staying at prior step’s scroll depth). */
function scrollWizardStepIntoView() {
  requestAnimationFrame(() => {
    document.getElementById("wizard-nav")?.scrollIntoView({ block: "start", behavior: "auto" });
  });
}

function renderNav() {
  const nav = document.getElementById("wizard-nav");
  nav.innerHTML = "";
  let steps = stepDefsForTier(character.tier);
  if (isDragonHeirChargen(character) && character.dragon?.pastConcept !== true) {
    steps = steps.slice(0, 2);
  }
  steps.forEach((id, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    if (idx === stepIndex) btn.classList.add("active");
    if (idx < stepIndex) btn.classList.add("done");
    btn.addEventListener("click", () => {
      persistFromForm();
      stepIndex = idx;
      render();
      scrollWizardStepIntoView();
    });
    nav.appendChild(btn);
  });
}

function panel(title, inner) {
  const p = document.createElement("section");
  p.className = "panel";
  const h = document.createElement("h2");
  h.textContent = title;
  p.appendChild(h);
  if (typeof inner === "string") {
    const d = document.createElement("div");
    d.innerHTML = inner;
    p.appendChild(d);
  } else {
    p.appendChild(inner);
  }
  return p;
}

function renderWelcome(root) {
  const parts = welcomePartsFromCharacter();
  const curEnc = welcomeTrackValueFromCharacter();
  const t = bundle.tier[character.tier];
  const body = document.createElement("div");
  const tierPick = document.createElement("div");
  tierPick.className = "field welcome-tier-field";

  const lineRow = document.createElement("div");
  lineRow.className = "field";
  const labLine = document.createElement("label");
  labLine.htmlFor = "welcome-line-select";
  labLine.textContent = "Line (Deity, Titan, Dragon, or Sorcerer)";
  lineRow.appendChild(labLine);
  const lineSel = document.createElement("select");
  lineSel.id = "welcome-line-select";
  for (const [val, label] of [
    ["deity", "Deity"],
    ["titan", "Titan"],
    ["dragon", "Dragon"],
    ["sorcerer", "Sorcerer"],
  ]) {
    const o = document.createElement("option");
    o.value = val;
    o.textContent = label;
    lineSel.appendChild(o);
  }
  lineSel.value = parts.line;
  lineSel.setAttribute("data-last-line", parts.line);
  lineRow.appendChild(lineSel);
  tierPick.appendChild(lineRow);

  const tierRow = document.createElement("div");
  tierRow.className = "field";
  const labTier = document.createElement("label");
  labTier.htmlFor = "welcome-tier-select";
  labTier.id = "welcome-tier-select-label";
  labTier.textContent = "Tier";
  tierRow.appendChild(labTier);
  const tierSel = document.createElement("select");
  tierSel.id = "welcome-tier-select";
  if (parts.line === "dragon") {
    tierRow.style.display = "none";
    tierSel.innerHTML = "";
  } else {
    fillWelcomeTierSelect(tierSel, /** @type {"deity"|"titan"|"sorcerer"} */ (parts.line));
    tierSel.value = parts.payload;
    if (![...tierSel.options].some((o) => o.value === tierSel.value)) {
      tierSel.value = tierSel.options[0]?.value || parts.payload;
    }
  }
  tierRow.appendChild(tierSel);
  tierPick.appendChild(tierRow);

  const inheritRow = document.createElement("div");
  inheritRow.className = "field welcome-dragon-inheritance-field";
  inheritRow.style.display = parts.line === "dragon" ? "" : "none";
  const labInh = document.createElement("label");
  labInh.htmlFor = "welcome-dragon-inheritance-select";
  labInh.textContent = "Inheritance (stage)";
  inheritRow.appendChild(labInh);
  const inhSel = document.createElement("select");
  inhSel.id = "welcome-dragon-inheritance-select";
  fillWelcomeDragonInheritanceSelect(inhSel);
  inhSel.value = parts.line === "dragon" ? parts.payload : welcomeDefaultDragonInheritance();
  if (![...inhSel.options].some((o) => o.value === inhSel.value)) {
    inhSel.value = inhSel.options[0]?.value || welcomeDefaultDragonInheritance();
  }
  inheritRow.appendChild(inhSel);
  tierPick.appendChild(inheritRow);

  const setTrackLast = (enc) => {
    tierPick.setAttribute("data-track-last", enc);
  };
  setTrackLast(curEnc);

  const applyFromSelects = () => {
    const line = /** @type {"deity"|"titan"|"dragon"|"sorcerer"} */ (lineSel.value);
    const next =
      line === "dragon"
        ? `dragon:${inhSel.value || welcomeDefaultDragonInheritance()}`
        : line === "sorcerer"
          ? `sorcerer:${tierSel.value || welcomeDefaultPayloadForLine("sorcerer")}`
          : `${line}:${tierSel.value}`;
    const prev = tierPick.getAttribute("data-track-last") || curEnc;
    if (next === prev) return;
    if (welcomeTrackChangeIsHeavy(prev, next)) {
      if (
        !window.confirm(
          "Changing chargen track may invalidate Knacks, Purviews, Boons, Birthrights, or Dragon Heir data. Continue?",
        )
      ) {
        const p = welcomePartsFromCharacter();
        lineSel.value = p.line;
        if (p.line === "dragon") {
          tierRow.style.display = "none";
          tierSel.innerHTML = "";
          inheritRow.style.display = "";
          fillWelcomeDragonInheritanceSelect(inhSel);
          inhSel.value = p.payload;
          if (![...inhSel.options].some((o) => o.value === inhSel.value)) inhSel.value = inhSel.options[0]?.value || welcomeDefaultDragonInheritance();
        } else if (p.line === "sorcerer") {
          tierRow.style.display = "";
          inheritRow.style.display = "none";
          fillWelcomeTierSelect(tierSel, "sorcerer");
          tierSel.value = p.payload;
          if (![...tierSel.options].some((o) => o.value === tierSel.value)) {
            tierSel.value = tierSel.options[0]?.value || welcomeDefaultPayloadForLine("sorcerer");
          }
        } else {
          tierRow.style.display = "";
          inheritRow.style.display = "none";
          fillWelcomeTierSelect(tierSel, /** @type {"deity"|"titan"} */ (p.line));
          tierSel.value = p.payload;
          if (![...tierSel.options].some((o) => o.value === tierSel.value)) tierSel.value = tierSel.options[0]?.value || p.payload;
        }
        lineSel.setAttribute("data-last-line", p.line);
        return;
      }
    }
    applyWelcomeTrackChangeNoConfirm(next);
    setTrackLast(next);
    stepIndex = 0;
    reviewViewMode = "sheet";
    normalizeCharacterStateAfterLoad();
    render();
    scrollWizardStepIntoView();
  };

  lineSel.addEventListener("change", () => {
    const line = /** @type {"deity"|"titan"|"dragon"|"sorcerer"} */ (lineSel.value);
    const prevLine = lineSel.getAttribute("data-last-line") || "";
    if (line !== prevLine) {
      if (line === "dragon") {
        tierRow.style.display = "none";
        tierSel.innerHTML = "";
        inheritRow.style.display = "";
        fillWelcomeDragonInheritanceSelect(inhSel);
        inhSel.value = welcomeDefaultDragonInheritance();
      } else if (line === "sorcerer") {
        tierRow.style.display = "";
        inheritRow.style.display = "none";
        fillWelcomeTierSelect(tierSel, "sorcerer");
        tierSel.value = welcomeDefaultPayloadForLine("sorcerer");
      } else {
        tierRow.style.display = "";
        inheritRow.style.display = "none";
        fillWelcomeTierSelect(tierSel, /** @type {"deity"|"titan"} */ (line));
        tierSel.value = welcomeDefaultPayloadForLine(line);
      }
    }
    lineSel.setAttribute("data-last-line", line);
    applyFromSelects();
  });
  tierSel.addEventListener("change", () => {
    applyFromSelects();
  });
  inhSel.addEventListener("change", () => {
    applyFromSelects();
  });

  applyHint(lineSel, "welcome-line-select");
  if (parts.line !== "dragon") applyHint(tierSel, "welcome-tier-select");
  applyHint(inhSel, "welcome-dragon-inheritance-select");
  const trHelp = document.createElement("p");
  trHelp.className = "help";
  trHelp.textContent =
    "Pick a line, then tier (Mortal/Origin through God on Deity, Titanic on Titan, Mortal- through God-band on Sorcerer). Dragon Heir picks Inheritance 1–10 (True Dragon at 10). Sorcerer uses Saints & Monsters ch. 3 tiers in data/tier.json. Dragon uses the shared Origin spine plus the Dragon tab after Concept.";
  tierPick.appendChild(trHelp);
  body.appendChild(tierPick);
  const intro = document.createElement("div");
  intro.innerHTML = `<p class="help">${t?.description || ""}</p>
    <p class="help"><strong>Typical Legend:</strong> ${t?.typicalLegendRange || "—"}</p>
    <p class="help mono">${t?.mechanicalEffects || ""}</p>
    <p class="help"><em>${t?.source || ""}</em></p>`;
  body.appendChild(intro);
  root.appendChild(panel("Welcome", body));
}

function renderConcept(root) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <p class="help" id="f-chargen-lineage-blurb">Deity/Titan uses the standard pantheon Paths and Visitation tiers. Dragon Heir uses the Dragon tab after Concept (Inheritance is chosen on Welcome).</p>
    <div class="field"><label>Character name</label><input type="text" id="f-char-name" autocomplete="name" spellcheck="false" /></div>
    <div class="field"><label>Concept</label><textarea id="f-concept"></textarea></div>
    <div class="field"><label>Player / Group notes</label><textarea id="f-notes"></textarea></div>
    <div class="grid-2">
      <div class="field"><label id="lab-deed-short" for="f-deed-short">Short-term Deed</label><textarea id="f-deed-short"></textarea></div>
      <div class="field"><label id="lab-deed-long" for="f-deed-long">Long-term Deed</label><textarea id="f-deed-long"></textarea></div>
    </div>
    <div class="field"><label id="lab-deed-band" for="f-deed-band">Band Deed</label><textarea id="f-deed-band"></textarea></div>
    <div class="field"><label for="f-sheet-description">Description</label><textarea id="f-sheet-description" spellcheck="false" aria-label="Description"></textarea></div>`;
  root.appendChild(panel("Concept & Deeds", wrap));
  const applyDeedLabels = (dragon) => {
    const ls = document.getElementById("lab-deed-short");
    const ll = document.getElementById("lab-deed-long");
    const lb = document.getElementById("lab-deed-band");
    const blurb = document.getElementById("f-chargen-lineage-blurb");
    if (dragon) {
      if (ls) ls.textContent = "Draconic Deed";
      if (ll) ll.textContent = "Short-term worldly Deed";
      if (lb) lb.textContent = "Brood Deed";
      if (blurb) {
        blurb.innerHTML =
          "Heir Deeds: one Draconic, one short-term worldly, one Brood (shared) per <em>Scion: Dragon</em> p. 110 (see Origin pp. 94–95 for Deed procedure).";
      }
    } else {
      if (ls) ls.textContent = "Short-term Deed";
      if (ll) ll.textContent = "Long-term Deed";
      if (lb) lb.textContent = isSorcererLineTier(character.tier) ? "Coven Deed (shared)" : "Band Deed";
      if (blurb) {
        blurb.textContent = isSorcererLineTier(character.tier)
          ? "Sorcerer: same Deed structure as Origin (Saints & Monsters ch. 3) — short-term sorcerous deed, long-term goal, and a Coven shared deed. Paths are Origin + how you learned Sorcery + Society (S&M Step Two), not Visitation pantheon picks."
          : "Deity/Titan uses the standard pantheon Paths and Visitation tiers. Dragon switches to the Heir wizard after this step (Scion: Dragon).";
      }
    }
  };
  applyDeedLabels(isDragonHeirChargen(character));
  document.getElementById("f-char-name").value = character.characterName ?? "";
  document.getElementById("f-concept").value = character.concept;
  document.getElementById("f-notes").value = character.notes;
  document.getElementById("f-deed-short").value = character.deeds.short;
  document.getElementById("f-deed-long").value = character.deeds.long;
  document.getElementById("f-deed-band").value = character.deeds.band;
  document.getElementById("f-sheet-description").value = character.sheetDescription ?? "";
  ["f-char-name", "f-concept", "f-notes", "f-deed-short", "f-deed-long", "f-deed-band", "f-sheet-description"].forEach((id) =>
    applyHint(document.getElementById(id), id),
  );
}

function renderPaths(root) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="paths-step-grid">
      <div class="paths-phrases-row">
        <div class="field"><label>Origin Path phrase</label><textarea id="p-origin"></textarea></div>
        <div class="field"><label>Role Path phrase</label><textarea id="p-role"></textarea></div>
        <div class="field"><label>Society / Pantheon Path phrase</label><textarea id="p-soc"></textarea></div>
      </div>
      <div class="paths-pantheon-deity-stack" id="paths-pantheon-deity-stack">
        <div class="field paths-pantheon-field"><label for="p-pantheon">Pantheon</label><select id="p-pantheon"></select></div>
        <div class="field paths-patron-kind-field">
          <label for="p-patron-kind">Patron type</label>
          <select id="p-patron-kind" name="patronKind" autocomplete="off" aria-label="Patron type">
            <option value="deity">Divine</option>
            <option value="titan">Titan</option>
          </select>
        </div>
        <div class="field paths-deity-field"><label id="p-deity-label" for="p-deity">Parent</label><select id="p-deity"></select></div>
        <div class="field paths-mythos-deed-field" id="p-mythos-deed-wrap" hidden>
          <label for="p-mythos-deed">Mythos Deed</label>
          <textarea id="p-mythos-deed" rows="2" spellcheck="false" placeholder="Fourth Deed slot (Masks of the Mythos)"></textarea>
          <p class="help paths-mythos-deed-hint">MotM adds a <strong>Mythos</strong> Deed alongside Short-term, Long-term, and Band (see your MotM / table guidance).</p>
        </div>
      </div>
      <p class="help paths-patron-lineage-hint">Patron type sits between Pantheon and parent: it switches whether the parent list is gods or Titans.</p>
    </div>
    <aside id="p-pantheon-virtues" class="pantheon-virtues-panel" aria-live="polite"></aside>
    <div id="p-virtue-spectrum-mount" class="p-virtue-spectrum-mount"></div>
    <p class="help" id="paths-pantheon-skills-help">Society Path skills use your pantheon’s Asset Skills plus one more Skill of your choice (Origin p. 97).</p>`;
  const patronMount = document.createElement("div");
  patronMount.id = "patron-purview-mount";
  wrap.appendChild(patronMount);
  if (isMythosPantheonSelected()) {
    const motm = masksMotMBundle()?.pathsCallout;
    if (typeof motm === "string" && motm.trim()) {
      const motmP = document.createElement("p");
      motmP.className = "help masks-motm-callout";
      motmP.textContent = motm.trim();
      wrap.appendChild(motmP);
    }
  }
  root.appendChild(panel("Paths", wrap));
  if (tierHasPurviewStep(character.tier)) {
    ensurePatronPurviewSlots();
    renderPatronPurviewPanel(patronMount);
  } else {
    const note = document.createElement("p");
    note.className = "help patron-purviews-origin-note";
    const raw = bundle.tier[character.tier]?.purviewsOriginNote;
    note.innerHTML =
      typeof raw === "string" && raw.trim()
        ? raw
        : sorcererPathsHidePatronStack(character.tier)
          ? "<strong>Sorcerer Paths</strong> (Saints & Monsters ch. 3) use Origin’s three-Path structure (Origin p. 95); this tier does not use Visitation patron Purviews or pantheon Society Asset Skills on Paths."
          : "<strong>Patron Purviews</strong> are assigned after Visitation (<strong>Hero</strong> tier and above), not during Origin Mortal chargen. Pantheon and divine parent here still set Society Path Asset Skills (Origin p. 97).";
    patronMount.appendChild(note);
  }
  const ps = document.getElementById("p-pantheon");
  ps.innerHTML = `<option value="">—</option>`;
  for (const p of pantheonOptionsForCurrentPatronKind()) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    applyGameDataHint(o, p);
    ps.appendChild(o);
  }
  const allowedPantheonIds = new Set(pantheonOptionsForCurrentPatronKind().map((p) => p.id));
  if (character.pantheonId && !allowedPantheonIds.has(character.pantheonId)) {
    character.pantheonId = "";
    character.parentDeityId = "";
  }
  ps.value = character.pantheonId;
  const fillDeities = () => {
    if (isDragonHeirChargen(character) || sorcererPathsHidePatronStack(character.tier)) return;
    character.pantheonId = ps.value;
    const ds = document.getElementById("p-deity");
    const lab = document.getElementById("p-deity-label");
    if (lab) lab.textContent = patronKindIsTitan() ? "Titan parent" : "Divine parent";
    ds.innerHTML = `<option value="">—</option>`;
    for (const d of deityList()) {
      const o = document.createElement("option");
      o.value = d.id;
      const label = deityOptionLabel(d);
      o.textContent = label;
      applyGameDataHint(o, deityDocEntity(d));
      ds.appendChild(o);
    }
    ds.value = character.parentDeityId;
  };
  ps.addEventListener("change", () => {
    if (isDragonHeirChargen(character) || sorcererPathsHidePatronStack(character.tier)) return;
    persistPathsPhrasesFromDom();
    character.virtueSpectrum = 0;
    character.parentDeityId = "";
    fillDeities();
    if (!isMythosPantheonSelected() && character.deeds) {
      character.deeds.mythos = "";
    }
    const assets = societyPatronAssetSkillIds();
    if (assets.length >= 1 && assets.length <= 3) {
      character.pathSkills.society = [...assets];
    } else {
      character.pathSkills.society = [];
    }
    syncAwarenessWithPantheon();
    onPatronPurviewContextChange();
    render();
  });
  fillDeities();
  const pkSel = document.getElementById("p-patron-kind");
  if (pkSel) {
    pkSel.value = patronKindIsTitan() ? "titan" : "deity";
    pkSel.addEventListener("change", () => {
      if (isDragonHeirChargen(character) || sorcererPathsHidePatronStack(character.tier)) return;
      persistPathsPhrasesFromDom();
      character.patronKind = pkSel.value === "titan" ? "titan" : "deity";
      character.parentDeityId = "";
      fillDeities();
      if (!isMythosPantheonSelected() && character.deeds) {
        character.deeds.mythos = "";
      }
      ensureSocietyDefaultAssetSkills();
      onPatronPurviewContextChange();
      syncCallingToParentDeity();
      render();
    });
  }
  document.getElementById("p-mythos-deity-empty")?.remove();
  document.getElementById("p-titan-patron-empty")?.remove();
  if (isMythosPantheonSelected() && deityList().length === 0) {
    const deitySel = document.getElementById("p-deity");
    const w = document.createElement("p");
    w.id = "p-mythos-deity-empty";
    w.className = "help";
    w.textContent =
      "No divine parents are listed for the Mythos pantheon in pantheons.json yet. Add deity entries (id, name, callings, purviews) from Masks of the Mythos, or extract text with scripts/ingest_masks_of_the_mythos_pdf.py and merge manually.";
    deitySel?.parentElement?.appendChild(w);
  } else if (patronKindIsTitan() && deityList().length === 0) {
    const deitySel = document.getElementById("p-deity");
    const w = document.createElement("p");
    w.id = "p-titan-patron-empty";
    w.className = "help";
    w.textContent =
      "No Titans are listed for this pantheon in data/titans.json yet — pick another pantheon, switch patron type to God, or add titans under titansByPantheon for this id.";
    deitySel?.parentElement?.appendChild(w);
  }
  const stackEl = document.getElementById("paths-pantheon-deity-stack");
  const lineageHint = wrap.querySelector(".paths-patron-lineage-hint");
  const pkField = document.getElementById("p-patron-kind")?.closest(".field");
  const deityField = document.getElementById("p-deity")?.closest(".field");
  const pantheonField = document.getElementById("p-pantheon")?.closest(".field");
  const socTa0 = document.getElementById("p-soc");
  const socLab0 = socTa0?.parentElement?.querySelector("label");
  if (isDragonHeirChargen(character)) {
    ensureDragonShape(character, bundle);
    if (stackEl) stackEl.hidden = true;
    if (pkField) pkField.hidden = true;
    if (deityField) deityField.hidden = true;
    if (pantheonField) pantheonField.hidden = true;
    if (lineageHint) {
      lineageHint.textContent =
        "Dragon Heirs choose a Flight here instead of a Scion pantheon; full Heir chargen continues on the Dragon tab.";
    }
    if (socLab0) socLab0.textContent = "Flight Path phrase";
    let mount = document.getElementById("p-dragon-flight-mount");
    if (!mount && stackEl?.parentElement) {
      mount = document.createElement("div");
      mount.id = "p-dragon-flight-mount";
      mount.className = "field paths-dragon-flight-field";
      mount.innerHTML = `<label for="p-dragon-flight">Flight (Dragon Heir)</label><select id="p-dragon-flight"><option value="">—</option></select>`;
      stackEl.parentElement.insertBefore(mount, stackEl.nextSibling);
    }
    const fs = document.getElementById("p-dragon-flight");
    if (fs && fs.options.length <= 1) {
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
      fs.value = character.dragon?.flightId || "";
      applyHint(fs, "p-dragon-flight");
    }
    ps.disabled = true;
    const pkEl0 = document.getElementById("p-patron-kind");
    if (pkEl0) pkEl0.disabled = true;
    const deSel = document.getElementById("p-deity");
    if (deSel) deSel.disabled = true;
  } else if (sorcererPathsHidePatronStack(character.tier)) {
    document.getElementById("p-dragon-flight-mount")?.remove();
    if (stackEl) stackEl.hidden = true;
    if (pkField) pkField.hidden = true;
    if (deityField) deityField.hidden = true;
    if (pantheonField) pantheonField.hidden = true;
    if (lineageHint) {
      lineageHint.textContent =
        "Sorcerer (Legend 0): Origin, Role (how you learned Sorcery), and Society Paths per Saints & Monsters ch. 3 — pick three Skills per Path on the Skills step (no pantheon Asset Skill requirement).";
    }
    if (socLab0) socLab0.textContent = "Society Path phrase";
    ps.disabled = true;
    const pkElS = document.getElementById("p-patron-kind");
    if (pkElS) pkElS.disabled = true;
    const deSelS = document.getElementById("p-deity");
    if (deSelS) deSelS.disabled = true;
    const foot = document.getElementById("paths-pantheon-skills-help");
    if (foot) {
      foot.textContent =
        "Sorcerer Society Path Skills: any three Skills you can justify (S&M ch. 3, Step Two; Origin p. 95 for Path structure — not the Visitation-era pantheon Asset Skill rule).";
    }
  } else {
    document.getElementById("p-dragon-flight-mount")?.remove();
    if (stackEl) stackEl.hidden = false;
    if (pkField) pkField.hidden = false;
    if (deityField) deityField.hidden = false;
    if (pantheonField) pantheonField.hidden = false;
    if (lineageHint) {
      lineageHint.textContent =
        "Patron type sits between Pantheon and parent: it switches whether the parent list is gods or Titans.";
    }
    if (socLab0) socLab0.textContent = "Society / Pantheon Path phrase";
    ps.disabled = false;
    const pkEl1 = document.getElementById("p-patron-kind");
    if (pkEl1) pkEl1.disabled = false;
    const deSel2 = document.getElementById("p-deity");
    if (deSel2) deSel2.disabled = false;
  }
  document.getElementById("p-deity").addEventListener("change", (e) => {
    if (isDragonHeirChargen(character) || sorcererPathsHidePatronStack(character.tier)) return;
    persistPathsPhrasesFromDom();
    character.parentDeityId = e.target.value;
    ensureSocietyDefaultAssetSkills();
    onPatronPurviewContextChange();
    render();
  });
  document.getElementById("p-origin").value = character.paths.origin;
  document.getElementById("p-role").value = character.paths.role;
  document.getElementById("p-soc").value = isDragonHeirChargen(character)
    ? String(character.dragon?.paths?.flight ?? character.paths.society ?? "")
    : character.paths.society;
  const mythDeedWrap = document.getElementById("p-mythos-deed-wrap");
  const mythDeedTa = document.getElementById("p-mythos-deed");
  if (mythDeedWrap && mythDeedTa) {
    const showMyth = pathsStepShowsMythosDeedFields();
    mythDeedWrap.hidden = !showMyth;
    if (typeof character.deeds?.mythos !== "string") character.deeds.mythos = "";
    mythDeedTa.value = character.deeds.mythos || "";
    mythDeedTa.oninput = () => {
      character.deeds.mythos = mythDeedTa.value;
    };
  }
  const hidePathsVirtuesUi = isDragonHeirChargen(character) || sorcererPathsHidePatronStack(character.tier);
  const virtuesAside = document.getElementById("p-pantheon-virtues");
  if (hidePathsVirtuesUi) {
    if (virtuesAside) {
      virtuesAside.innerHTML = "";
      virtuesAside.hidden = true;
    }
  } else {
    if (virtuesAside) virtuesAside.hidden = false;
    fillPantheonVirtuesDisplay(character.pantheonId);
  }
  const vm = document.getElementById("p-virtue-spectrum-mount");
  if (vm) {
    vm.innerHTML = "";
    if (!hidePathsVirtuesUi) {
      const row = buildVirtueSpectrumElement(
        { pantheonId: character.pantheonId, virtueSpectrum: character.virtueSpectrum ?? 0 },
        bundle,
        true,
        (dotIdx) => {
          const cur = Math.max(0, Math.min(5, Math.round(Number(character.virtueSpectrum) || 0)));
          character.virtueSpectrum = cur === dotIdx ? dotIdx - 1 : dotIdx;
          character.virtueSpectrum = Math.max(0, character.virtueSpectrum);
          render();
        },
      );
      if (row) vm.appendChild(row);
    }
  }
  applyHint(document.getElementById("p-origin"), "p-origin");
  applyHint(document.getElementById("p-role"), "p-role");
  applyHint(document.getElementById("p-soc"), isDragonHeirChargen(character) ? "p-flight-path" : "p-soc");
  if (!isDragonHeirChargen(character) && !sorcererPathsHidePatronStack(character.tier)) {
    ["p-pantheon", "p-patron-kind", "p-deity"].forEach((id) => applyHint(document.getElementById(id), id));
  }
  const mythDeedEl = document.getElementById("p-mythos-deed");
  if (pathsStepShowsMythosDeedFields()) {
    applyHint(mythDeedEl, "p-mythos-deed");
  } else if (mythDeedEl) {
    mythDeedEl.removeAttribute("title");
    mythDeedEl.classList.remove("has-doc-hint");
  }
}

function renderSkills(root) {
  ensureSkillDots();
  ensurePathSkillArrays();
  ensureSocietyDefaultAssetSkills();
  applyPathMathToSkillDots();
  const pathGate = validateAllPathSkillsDetailed();
  skillsGateIssues = pathGate.ok ? [] : [...pathGate.issues];
  if (pathGate.ok) {
    const pend = pathSkillOverflowDotsPending();
    if (pend > 0) {
      skillsGateIssues.push({
        pathKey: null,
        message: `Path overlap would put a Skill above 5 dots (Origin p. 97). Move exactly ${pend} excess Path dot(s) onto other Path Skills using the controls below — not into non-Path Skills. Finishing Touches (p. 98) are separate.`,
      });
    }
  }
  const wrap = document.createElement("div");
  if (skillsGateIssues.length > 0) {
    const box = document.createElement("div");
    box.className = "skills-gate-errors";
    box.setAttribute("role", "alert");
    const title = document.createElement("p");
    title.className = "skills-gate-errors-title";
    title.textContent = "Fix the following before leaving Skills:";
    box.appendChild(title);
    const ul = document.createElement("ul");
    for (const issue of skillsGateIssues) {
      const li = document.createElement("li");
      li.textContent = issue.message;
      ul.appendChild(li);
    }
    box.appendChild(ul);
    wrap.appendChild(box);
  }
  const intro = document.createElement("p");
  intro.className = "help";
  intro.textContent =
    "Assign three Skills to each Path, then prioritize which Path is primary, secondary, or tertiary. Skill ratings follow 3/2/1 Path math whenever you change Path picks or priority (Origin p. 97). If a Skill would exceed 5 dots from overlap, you must redistribute the excess onto other Path Skills only (same page); dot rows stay read-only.";
  wrap.appendChild(intro);

  const ovMeta = pathSkillTrimmedLostAndUnion();
  if (pathGate.ok && ovMeta.lost > 0) {
    const placed = sumPathSkillRedistribution(character.pathSkillRedistribution);
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
      const g = character.pathSkillRedistribution[sid] || 0;
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
      minus.disabled = g <= 0;
      minus.addEventListener("click", () => {
        bumpPathSkillRedistribution(sid, -1);
        render();
      });
      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "btn secondary";
      plus.textContent = "+1 overflow";
      const room = Math.max(0, 5 - t - g);
      plus.disabled = pending <= 0 || room <= 0;
      plus.addEventListener("click", () => {
        bumpPathSkillRedistribution(sid, 1);
        render();
      });
      cap.appendChild(minus);
      cap.appendChild(plus);
      row.appendChild(cap);
      ovPanel.appendChild(row);
    }
    wrap.appendChild(ovPanel);
  }

  const rankGrid = document.createElement("div");
  rankGrid.className = "grid-2";
  ["primary", "secondary", "tertiary"].forEach((rk) => {
    const field = document.createElement("div");
    field.className = "field";
    const lab = document.createElement("label");
    lab.textContent = `${rk} path`;
    const sel = document.createElement("select");
    sel.id = `path-rank-${rk}`;
    sel.dataset.rankKey = rk;
    PATH_KEYS_SORTED.forEach((pk) => {
      const o = document.createElement("option");
      o.value = pk;
      o.textContent = pk.charAt(0).toUpperCase() + pk.slice(1);
      sel.appendChild(o);
    });
    sel.value = character.pathRank[rk];
    sel.addEventListener("change", () => {
      const prev = { ...character.pathRank };
      const newPath = sel.value;
      const oldPath = prev[rk];
      if (newPath === oldPath) return;
      const otherRank = ["primary", "secondary", "tertiary"].find((key) => key !== rk && prev[key] === newPath);
      if (otherRank) {
        character.pathRank = { ...prev, [rk]: newPath, [otherRank]: oldPath };
      } else {
        character.pathRank = { ...prev, [rk]: newPath };
      }
      render();
    });
    field.appendChild(lab);
    field.appendChild(sel);
    rankGrid.appendChild(field);
  });
  wrap.appendChild(rankGrid);
  ["primary", "secondary", "tertiary"].forEach((rk) => applyHint(document.getElementById(`path-rank-${rk}`), `path-rank-${rk}`));

  const pathPanelInvalid = (pk) => skillsGateIssues.some((i) => i.pathKey === pk);

  PATH_KEYS.forEach((pk) => {
    const chips = document.createElement("div");
    chips.className = "panel" + (pathPanelInvalid(pk) ? " panel-gate-invalid" : "");
    chips.id = `path-skills-panel-${pk}`;
    const h = document.createElement("h2");
    h.className = "path-skills-heading";
    const pathTitle = pk.charAt(0).toUpperCase() + pk.slice(1);
    const snip = pathPhraseSnippet(pk);
    if (snip) {
      h.textContent = `Skills for ${pathTitle} path — ${snip.text}`;
      if (snip.truncated) h.title = snip.full;
    } else {
      h.textContent = `Skills for ${pathTitle} path`;
      h.title =
        "Describe this Path on the Paths step (Origin / Role / Society phrases); the text is shown here to guide Skill choices.";
    }
    chips.appendChild(h);

    const assets =
      pk === "society" && !sorcererPathsHidePatronStack(character.tier) ? societyPatronAssetSkillIds() : [];
    if (pk === "society") {
      const rule = document.createElement("p");
      rule.className = "help society-asset-rule";
      if (sorcererPathsHidePatronStack(character.tier)) {
        rule.textContent =
          "Sorcerer Society Path: any three Skills you can justify to the table (Saints & Monsters ch. 3, Step Two; Origin p. 95 for Path structure).";
      } else {
        const patronNoun = patronKindIsTitan() ? "Titan parent" : "divine parent";
        if (assets.length >= 2) {
          const aNames = assets.map((id) => bundle.skills[id]?.name || id).join(" & ");
          rule.innerHTML = `<strong>Required for Society Path:</strong> include every Asset Skill for your chosen ${patronNoun} (or pantheon) — <span class="asset-skill-names">${aNames}</span> — plus exactly <em>${Math.max(0, 3 - assets.length)}</em> other Skill(s) of your choice (Origin pp. 96–97).`;
        } else if (assets.length === 1) {
          const aNames = assets.map((id) => bundle.skills[id]?.name || id).join(", ");
          rule.innerHTML = `<strong>Required for Society Path:</strong> include the Asset Skill <span class="asset-skill-names">${aNames}</span> plus two other Skills (three total; Origin pp. 96–97).`;
        } else {
          rule.className = "warn";
          rule.textContent =
            "Choose a pantheon on the Paths step first; Society Path must use that pantheon’s Asset Skills until you pick a parent (Origin pp. 96–97).";
        }
      }
      chips.appendChild(rule);
    }

    const err = document.createElement("p");
    err.id = `path-skill-violation-${pk}`;
    err.className = "warn";
    err.style.minHeight = "1.25em";
    chips.appendChild(err);

    const count = (character.pathSkills[pk] || []).length;
    if (count !== 3) {
      const w = document.createElement("p");
      w.className = "warn";
      w.textContent =
        pk === "society" && assets.length >= 1
          ? "Select exactly three Skills: every highlighted Asset Skill plus enough other Skills to total three."
          : "Each Path should have exactly three Skills at creation (Origin p. 96).";
      chips.appendChild(w);
    }
    const cdiv = document.createElement("div");
    cdiv.className = "chips";
    for (const sid of skillIds()) {
      const s = bundle.skills[sid];
      const chip = document.createElement("button");
      chip.type = "button";
      const isOn = character.pathSkills[pk].includes(sid);
      const isAsset = pk === "society" && assets.includes(sid);
      chip.className = "chip" + (isOn ? " on" : "") + (isAsset ? " chip-pantheon-asset" : "");
      chip.textContent = s.name;
      applyGameDataHint(
        chip,
        s,
        isAsset
          ? { prefix: "Patron / pantheon Asset Skill — include in your three Society Path picks (Origin pp. 96–97)." }
          : undefined,
      );
      chip.addEventListener("click", () => {
        const set = new Set(character.pathSkills[pk]);
        if (set.has(sid)) set.delete(sid);
        else set.add(sid);
        const next = [...set];
        const viol = document.getElementById(`path-skill-violation-${pk}`);
        if (next.length > 3) {
          if (viol) viol.textContent = "Each Path may only include three Skills at creation (Origin p. 96).";
          return;
        }
        if (pk === "society") {
          const v = societySkillsAllowed(next);
          if (!v.ok) {
            if (viol) viol.textContent = v.reason;
            return;
          }
        }
        if (viol) viol.textContent = "";
        character.pathSkills[pk] = next;
        render();
      });
      cdiv.appendChild(chip);
    }
    chips.appendChild(cdiv);
    wrap.appendChild(chips);
  });

  const list = document.createElement("div");
  list.className = "panel skill-ratings-panel";
  const head = document.createElement("h2");
  head.textContent = "Skill ratings (0–5)";
  list.appendChild(head);
  const help = document.createElement("p");
  help.className = "help";
  help.textContent =
    "Ratings follow Path priority (3 / 2 / 1) when Path Skills or priority change; dots here are read-only. If overlap would exceed 5 in a Skill, use the overflow controls above (Origin p. 97). At 3+ dots, add free Specialties (Origin pp. 59–60, 97).";
  list.appendChild(help);

  const table = document.createElement("table");
  table.className = "skill-ratings-table";
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Skill", "Dots"].forEach((label, idx) => {
    const th = document.createElement("th");
    th.textContent = label;
    if (idx > 0) th.className = "skill-ratings-th-num";
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");

  for (const sid of skillIds()) {
    const s = bundle.skills[sid];
    const val = character.skillDots[sid] || 0;
    const tr = document.createElement("tr");
    tr.className = "skill-rating-row";
    appendSkillRatingNameCell(tr, sid, s, val);
    appendSkillRatingDotsCell(tr, sid, s, val, "skills");
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  list.appendChild(table);
  wrap.appendChild(list);
  root.appendChild(panel("Skills", wrap));
}

function renderAttributes(root) {
  const wrap = document.createElement("div");
  const help = document.createElement("p");
  help.className = "help";
  help.textContent =
    "Set arena priority (6 / 4 / 2 extra dots beyond the free 1 each in that arena), distribute those dots, then choose Favored Approach (+2 to each Attribute in that Approach, max 5). On this step only the 6 / 4 / 2 arena totals apply (Origin p. 97). The separate Finishing Attribute dot (Origin p. 98) is spent later on the Finishing step and may go on any one Attribute, still capped at five dots after Favored Approach. Dot rows show final ratings after Favored Approach.";
  wrap.appendChild(help);

  const rankRow = document.createElement("div");
  rankRow.className = "grid-2";
  ["Primary arena (6 extras)", "Secondary (4 extras)", "Tertiary (2 extras)"].forEach((label, idx) => {
    const field = document.createElement("div");
    field.className = "field";
    const lab = document.createElement("label");
    lab.textContent = label;
    const sel = document.createElement("select");
    sel.id = `arena-rank-${idx}`;
    ARENAS_SORTED.forEach((a) => {
      const o = document.createElement("option");
      o.value = a;
      o.textContent = a;
      sel.appendChild(o);
    });
    sel.value = character.arenaRank[idx];
    sel.addEventListener("change", () => {
      const prev = [...character.arenaRank];
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
      character.arenaRank = next;
      render();
    });
    field.appendChild(lab);
    field.appendChild(sel);
    rankRow.appendChild(field);
  });
  wrap.appendChild(rankRow);
  [0, 1, 2].forEach((idx) => applyHint(document.getElementById(`arena-rank-${idx}`), `arena-rank-${idx}`));

  const favField = document.createElement("div");
  favField.className = "field";
  const lab = document.createElement("label");
  lab.textContent = "Favored Approach";
  const sel = document.createElement("select");
  sel.id = "fav-approach";
  FAVORED_APPROACHES_SORTED.forEach((a) => {
    const o = document.createElement("option");
    o.value = a;
    o.textContent = a;
    sel.appendChild(o);
  });
  sel.value = character.favoredApproach;
  sel.addEventListener("change", () => {
    character.favoredApproach = sel.value;
    render();
  });
  favField.appendChild(lab);
  favField.appendChild(sel);
  wrap.appendChild(favField);
  applyHint(document.getElementById("fav-approach"), "fav-approach");

  normalizeCharacterAttributesToPools();
  const base = {};
  for (const arena of ARENA_ORDER) {
    for (const id of ARENAS[arena]) {
      base[id] = character.attributes[id] ?? 1;
    }
  }
  const msgs = validateAttributes(base);
  const msgBox = document.createElement("div");
  msgBox.className = msgs.length ? "warn" : "ok";
  msgBox.textContent = msgs.length ? msgs.join(" ") : "Arena totals match the 6/4/2 distribution.";
  wrap.appendChild(msgBox);

  const finalDisplay = applyFavoredApproach(base);

  for (const arena of ARENA_ORDER) {
    const sub = document.createElement("div");
    sub.className = "panel";
    sub.innerHTML = `<h2>${arena} (${arenaPools()[arena]} dots beyond base 1 each)</h2>`;
    for (const id of ARENAS[arena]) {
      const meta = bundle.attributes[id];
      const maxFinal = maxFinalRatingForAttr(id, base);
      const finalVal = finalDisplay[id] ?? 1;
      sub.appendChild(
        renderFinalAttrDotRow(meta.name, finalVal, maxFinal, (picked) => {
          const fav = character.favoredApproach;
          let pre = APPROACH_ATTRS[fav].includes(id) ? picked - 2 : picked;
          const cap = maxAttrRatingForArena(id, base);
          character.attributes[id] = Math.max(1, Math.min(pre, cap));
          render();
        }, meta),
      );
    }
    wrap.appendChild(sub);
  }

  const derivedRow = document.createElement("div");
  derivedRow.className = "attributes-derived-row";

  const def = originDefenseFromFinalAttrs(finalDisplay);
  const defPanel = document.createElement("div");
  defPanel.className = "panel derived-defense-panel";
  defPanel.innerHTML = `<h2>Defense</h2><p class="help"><strong>${def}</strong></p>`;
  derivedRow.appendChild(defPanel);

  const ath = Math.max(0, Math.min(5, Math.round(Number(character.skillDots?.athletics) || 0)));
  const move = originMovementPoolDice(finalDisplay, ath);
  const movePanel = document.createElement("div");
  movePanel.className = "panel derived-movement-panel";
  movePanel.innerHTML = `<h2>Movement dice</h2><p class="help"><strong>${move}</strong></p>`;
  derivedRow.appendChild(movePanel);

  wrap.appendChild(derivedRow);

  root.appendChild(panel("Attributes", wrap));
}

/**
 * @param {HTMLButtonElement} chip
 * @param {Record<string, unknown>} k
 */
function setKnackChipContents(chip, k) {
  const kk = k?.knackKind;
  const name = typeof k?.name === "string" ? k.name : "";
  chip.textContent = "";
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

function renderCalling(root) {
  syncCallingToParentDeity();
  const wrap = document.createElement("div");
  const allowedCallingIds = callingIdsAllowedForCharacter();
  const deity = selectedDeityRecord();
  if (allowedCallingIds) {
    const hint = document.createElement("p");
    hint.className = "help";
    hint.textContent = isMythosPantheonSelected()
      ? `Masks of the Mythos: only inverted Callings from this list appear — each id from ${deity?.name || "your divine parent"} in pantheon data is shown as its MotM Calling (standard names in the file map to inverted equivalents, e.g. Sage → Cosmos).`
      : `Calling is limited to those listed for ${deity?.name || "your divine parent"} in the pantheon data (three Favored Callings for Origin — Origin p. 98). Use the pantheon write-up that row cites (often Origin Appendix 2 or Mysteries of the World): a single “Calling:” line on a Pandora’s Box Birthright Guide NPC is that servitor’s template, not your parent’s full triple.`;
    wrap.appendChild(hint);
  } else if (!character.parentDeityId) {
    const hint = document.createElement("p");
    hint.className = "help";
    hint.textContent = isMythosPantheonSelected()
      ? "Choose a divine parent on the Paths step to limit Calling 1 to that deity’s MotM Calling list. Until then, the full library below shows each inverted Calling where MotM pairs one (standard sides like Sage are omitted when Cosmos exists); unpaired Callings (e.g. Liminal) stay listed."
      : "Choose a divine parent on the Paths step to limit Calling to that deity’s listed Callings. Until then, every standard Calling in the library is shown (MotM inverted Callings are hidden for non-Mythos characters).";
    wrap.appendChild(hint);
  }

  const mythosPan = isMythosPantheonSelected();
  const sortCallingEntries = (entries) =>
    [...entries].sort((a, b) =>
      String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0]), undefined, { sensitivity: "base" }),
    );
  const allCallingEntries = sortCallingEntries(
    Object.entries(bundle.callings || {}).filter(([cid]) =>
      callingIdInWizardLibraryChooser(cid, bundle, mythosPan),
    ),
  );
  /** Hero Calling 1: must be one of the divine parent’s listed Callings (when a parent is set). */
  const patronCallingEntries = allowedCallingIds
    ? sortCallingEntries(
        allowedCallingIds
          .filter((cid) => callingIdInWizardLibraryChooser(cid, bundle, mythosPan))
          .map((cid) => [cid, bundle.callings[cid]])
          .filter(([, c]) => c),
      )
    : null;
  let callingEntries = patronCallingEntries || allCallingEntries;
  const firstId = callingEntries[0]?.[0] || "";

  const grid = document.createElement("div");
  grid.className = "grid-2";
  const originTier = isOriginPlayTier(character.tier);

  if (heroUsesCallingSlots()) {
    ensureCallingSlotsForHero();
    const visPanel = document.createElement("div");
    visPanel.className = "calling-visitation-panel panel";
    const visH = document.createElement("h2");
    const visTier = normalizedTierId(character.tier);
    visH.textContent =
      visTier === "titanic"
        ? "Visitation (Origin → Titanic)"
        : visTier === "sorcerer_hero"
          ? "Heroic band (Mortal Sorcerer → Heroic Sorcerer)"
          : "Visitation (Origin → Hero)";
    visPanel.appendChild(visH);
    const visP = document.createElement("div");
    visP.className = "help";
    if (visTier === "titanic") {
      visP.innerHTML =
        "Use <strong>Review → Advance</strong> from Mortal when your table supports it, or start at <strong>Titanic</strong> on Welcome. After a Mortal tier-up, <strong>Calling 1</strong> stays your <strong>Origin Calling</strong> (dots can move). Assign <strong>three</strong> Callings and <strong>five</strong> dots (each at least one). <strong>Titans Rising:</strong> include <strong>at least one Titanic Calling</strong> (Adversary, Destroyer, Monster, Primeval, Tyrant). Knack budget equals the sum of row dots.";
    } else {
      const intro = document.createElement("p");
      intro.className = "calling-visitation-hero-intro";
      intro.innerHTML =
        "If you are advancing from Mortal, use <strong>Review → Advance to Hero</strong> (not Finishing) to reach this step. <strong>Calling 1</strong> stays your <strong>Origin Calling</strong> (only its dots can move here); pick two new Callings in rows 2–3. New rows default to <strong>1 dot</strong> each until you assign all <strong>five</strong> dots across the three rows (each Calling keeps at least one). Your knack budget equals the sum of these dots. <strong>Calling 1</strong>’s menu is your divine parent’s Calling list; <strong>Callings 2 and 3</strong> list the full Calling library.";
      visP.appendChild(intro);
      const rules = document.createElement("p");
      rules.className = "calling-visitation-hero-rules";
      rules.textContent =
        "Your character receives five dots among all their Callings, but each must have at least one dot.";
      visP.appendChild(rules);
      const ul = document.createElement("ul");
      ul.className = "calling-visitation-hero-list";
      const items = [
        "One of your Callings must be one of your divine parent’s three, but the other two are free choice.",
        "Each Calling is associated with three Fatebinding roles (Hero p. 197).",
        "At Legend 2, 4, 6, 8, and 10 you gain an extra dot of Calling, which can be applied to any of your three chosen Callings as long as it does not take that Calling above five dots.",
      ];
      for (const t of items) {
        const li = document.createElement("li");
        li.textContent = t;
        ul.appendChild(li);
      }
      visP.appendChild(ul);
    }
    visPanel.appendChild(visP);
    wrap.appendChild(visPanel);
    const lockPrimaryCallingSelect = visitationLocksPrimaryCallingChoice();
    for (let rowIdx = 0; rowIdx < HERO_CALLING_ROW_COUNT; rowIdx += 1) {
      const slot = character.callingSlots[rowIdx];
      const fieldH = document.createElement("div");
      fieldH.className = "field field-calling-row field-calling-row--hero";
      const labH = document.createElement("label");
      labH.htmlFor = `f-calling-hero-${rowIdx}`;
      labH.textContent =
        rowIdx === 0
          ? lockPrimaryCallingSelect
            ? "Calling 1 (primary — from Origin, locked)"
            : "Calling 1 (primary)"
          : `Calling ${rowIdx + 1}`;
      fieldH.appendChild(labH);
      const rowH = document.createElement("div");
      rowH.className = "calling-select-dots-row";
      const selH = document.createElement("select");
      selH.id = `f-calling-hero-${rowIdx}`;
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "—";
      selH.appendChild(blank);
      const selectedOnOtherRows = new Set();
      for (let j = 0; j < HERO_CALLING_ROW_COUNT; j += 1) {
        if (j === rowIdx) continue;
        const oid = String(character.callingSlots[j]?.id || "").trim();
        if (oid) selectedOnOtherRows.add(oid);
      }
      const curId = String(slot.id || "").trim();
      const rowEntries =
        rowIdx === 0 && patronCallingEntries?.length ? patronCallingEntries : allCallingEntries;
      for (const [cid, c] of rowEntries) {
        if (selectedOnOtherRows.has(cid) && cid !== curId) continue;
        const o = document.createElement("option");
        o.value = cid;
        o.textContent = c.name;
        applyGameDataHint(o, c);
        selH.appendChild(o);
      }
      selH.value = curId && rowEntries.some(([cid]) => cid === curId) ? curId : "";
      if (rowIdx === 0 && lockPrimaryCallingSelect) {
        selH.disabled = true;
      } else {
        selH.addEventListener("change", () => {
          ensureCallingSlotsForHero();
          character.callingSlots[rowIdx].id = selH.value || "";
          rebalanceHeroCallingSlotDotsOverFive();
          syncCallingAggregatesFromHeroSlots();
          pruneStaleKnackIds();
          render();
        });
      }
      rowH.appendChild(selH);
      const dotsWrapH = document.createElement("div");
      dotsWrapH.className = "dots calling-inline-dots";
      dotsWrapH.setAttribute("role", "radiogroup");
      const othersSum = character.callingSlots.reduce((a, s, j) => (j !== rowIdx ? a + s.dots : a), 0);
      const maxForRow = Math.min(5, Math.max(1, 5 - othersSum));
      const cdh = Math.max(1, Math.min(maxForRow, slot.dots));
      character.callingSlots[rowIdx].dots = cdh;
      dotsWrapH.setAttribute("aria-label", `Calling ${rowIdx + 1} rating ${cdh} of 5 (five dots shared across three Callings)`);
      for (let dotN = 1; dotN <= 5; dotN += 1) {
        const b = document.createElement("button");
        b.type = "button";
        const canPick = dotN >= 1 && dotN <= maxForRow;
        b.disabled = !canPick;
        b.className = "dot" + (dotN <= cdh ? " filled" : "") + (b.disabled ? " dot-capped" : "");
        b.setAttribute("aria-label", `Calling ${rowIdx + 1} — ${dotN} of 5`);
        if (canPick) {
          b.addEventListener("click", () => {
            ensureCallingSlotsForHero();
            character.callingSlots[rowIdx].dots = dotN;
            rebalanceHeroCallingSlotDotsOverFive();
            syncCallingAggregatesFromHeroSlots();
            pruneStaleKnackIds();
            render();
          });
        }
        dotsWrapH.appendChild(b);
      }
      rowH.appendChild(dotsWrapH);
      fieldH.appendChild(rowH);
      grid.appendChild(fieldH);
    }
    syncCallingAggregatesFromHeroSlots();
    wrap.appendChild(grid);
    const dotSumHero = character.callingSlots.reduce((a, s) => a + s.dots, 0);
    const missingCallingPick = character.callingSlots.some((s) => !String(s.id || "").trim());
    if (dotSumHero < 5 || missingCallingPick) {
      const wHero = document.createElement("p");
      wHero.className = "warn";
      wHero.textContent =
        (missingCallingPick ? "Pick a Calling in every row (three total). " : "") +
        (dotSumHero < 5
          ? `Distribute all five Calling dots for Hero Visitation (currently ${dotSumHero} / 5 on the three rows).`
          : "");
      wrap.appendChild(wHero);
    }
    if (normalizedTierId(character.tier) === "titanic" && !missingCallingPick && dotSumHero >= 5) {
      const hasTitanCalling = character.callingSlots.some((s) => TITANIC_CALLING_IDS_SM_KNACKS.has(String(s?.id || "").trim()));
      if (!hasTitanCalling) {
        const wTr = document.createElement("p");
        wTr.className = "warn";
        wTr.innerHTML =
          "<strong>Titans Rising (Titanic Rules):</strong> assign <strong>at least one</strong> of your three Calling rows to a <strong>Titanic Calling</strong> — Adversary, Destroyer, Monster, Primeval, or Tyrant.";
        wrap.appendChild(wTr);
      }
    }
    applyHint(document.getElementById("f-calling-hero-0"), "f-calling");
    if (lockPrimaryCallingSelect) {
      const h0 = document.getElementById("f-calling-hero-0");
      if (h0) {
        const lockNote =
          "This Calling was chosen at Origin; it cannot change after Visitation (you can still move Calling dots across the three rows).";
        h0.title = h0.title ? `${h0.title}\n\n${lockNote}` : lockNote;
      }
    }
  } else {
    const field = document.createElement("div");
    field.className = "field field-calling-row";
    field.innerHTML = "<label>Calling</label>";
    if (originTier) character.callingDots = 1;
    const cd = originTier
      ? 1
      : Math.max(1, Math.min(5, Math.round(Number(character.callingDots) || 1)));
    character.callingDots = cd;

    const row = document.createElement("div");
    row.className = "calling-select-dots-row";

    const sel = document.createElement("select");
    sel.id = "f-calling";
    for (const [cid, c] of callingEntries) {
      const o = document.createElement("option");
      o.value = cid;
      o.textContent = c.name;
      applyGameDataHint(o, c);
      sel.appendChild(o);
    }
    sel.value = character.callingId && callingEntries.some(([cid]) => cid === character.callingId) ? character.callingId : firstId;
    character.callingId = sel.value;
    sel.addEventListener("change", () => {
      character.callingId = sel.value;
      character.callingDots = 1;
      render();
    });
    row.appendChild(sel);

    const dotsWrap = document.createElement("div");
    dotsWrap.className = "dots calling-inline-dots";
    dotsWrap.setAttribute("role", originTier ? "img" : "radiogroup");
    dotsWrap.setAttribute(
      "aria-label",
      originTier ? "Calling rating 1 of 5 (fixed at Origin)" : `Calling rating ${cd} of 5`,
    );
    const maxPick = originTier ? 1 : 5;
    const shown = Math.min(cd, maxPick);
    for (let i = 1; i <= 5; i += 1) {
      const b = document.createElement("button");
      b.type = "button";
      const allowed = !originTier && i >= 1 && i <= maxPick;
      b.disabled = originTier || !allowed;
      b.className = "dot" + (i <= shown ? " filled" : "") + (b.disabled ? " dot-capped" : "");
      b.setAttribute("aria-label", `Calling ${i} of 5${originTier ? " (fixed at Origin)" : ""}`);
      if (allowed) {
        b.addEventListener("click", () => {
          character.callingDots = Math.max(1, Math.min(5, i));
          render();
        });
      }
      dotsWrap.appendChild(b);
    }
    row.appendChild(dotsWrap);
    field.appendChild(row);
    grid.appendChild(field);
    wrap.appendChild(grid);
    applyHint(document.getElementById("f-calling"), "f-calling");
  }

  const knackPanel = document.createElement("div");
  knackPanel.className = "panel calling-knacks-panel";
  const knackOriginNote = isOriginPlayTier(character.tier)
    ? " <strong>Origin (Mortal):</strong> only <strong>Mortal</strong> Knacks (one Calling slot each)—<strong>Immortal</strong> Knacks need Hero tier or higher. Chips are grouped under <strong>your Calling</strong> vs <strong>Any Calling</strong> (same layout as the Hero step)."
    : heroUsesCallingSlots()
      ? " <strong>Hero (three Callings):</strong> each Calling row’s <strong>dots</strong> are that row’s Knack budget (each <strong>Heroic</strong> Knack costs <strong>one</strong>; an <strong>Immortal</strong> Knack costs <strong>two</strong> and must sit on a row with at least <strong>two</strong> dots). A Knack only appears if <strong>some</strong> row that matches its Calling(s) still has room—Knacks that list <strong>several</strong> Callings stay available if <strong>any</strong> of your matching rows can pay."
      : " <strong>Hero+ (book):</strong> each additional dot you gain in any Calling allows you to purchase and know one additional Knack from that specific Calling. You may never have more Knacks known than your total Calling dots across all three Callings. <strong>This wizard:</strong> the dot row next to your primary Calling is your <strong>Calling rating</strong> budget for chips below—each <strong>Heroic</strong> (Mortal) Knack uses <strong>one</strong> slot. <strong>Alternately</strong>, you may take <strong>a single Immortal Knack instead of two Heroic Knacks</strong> when your Calling rating is <strong>two or higher</strong> (one Immortal costs <strong>two</strong> slot-equivalents; you cannot take more than one Immortal Knack from this swap).";
  const mythosKnackNote = isMythosPantheonSelected()
    ? " For <strong>Mythos</strong> (MotM pp. 47–49), Knacks treat your Calling as including its <strong>paired</strong> normal/inverted Calling (e.g. Cosmos ⇄ Sage), so you see MotM Knacks and the usual <cite>Pandora’s Box</cite> Calling lists for both sides."
    : "";
  const smTitanicNoteRaw = saintsMonstersBundle()?.titanicKnacksCallout;
  const smTitanicKnackNote = hasTitanicSaintsMonstersKnackCalling()
    ? ` <strong>Saints & Monsters:</strong> ${typeof smTitanicNoteRaw === "string" && smTitanicNoteRaw.trim() ? smTitanicNoteRaw.trim() : "Titanic Calling Knacks from Chapter Four appear as chips with ids prefixed <code>sm_</code> and this book in hints."}`
    : "";
  knackPanel.innerHTML = `<h2>Knacks</h2><p class="help">Each chip is tagged <strong>Mortal</strong> or <strong>Immortal</strong> (data: <code>knackKind</code>). <strong>Muted / disabled</strong> chips are Knacks you still pass the <strong>Calling / tier / patron-type / Purview / pantheon</strong> rules in the data for, but your current <strong>per-row dot budgets</strong> (or the one-Immortal cap) cannot pay for them yet—raise dots on a matching Calling row until they become clickable. <strong>Titans Rising</strong> (<code>tr_*</code>) and <strong>S&amp;M Titanic Calling</strong> (<code>sm_*</code>) entries use the same rules: they show up whenever those gates pass (often a <strong>Titanic Calling</strong> row or <code>callingsAny</code> on the card). Use <cite>Pandora’s Box</cite> at the table for full mechanics.${knackOriginNote}${mythosKnackNote}${smTitanicKnackNote} Picks that no longer fit stay visible so you can clear them. Knacks already taken as <strong>extra Finishing Knacks</strong> are omitted here so you cannot pick the same Knack twice.${
    heroUsesCallingSlots()
      ? " <strong>Hero:</strong> chips are grouped under the first Calling row they match (or <strong>Any Calling</strong> when the card applies to any Calling)."
      : isOriginPlayTier(character.tier)
        ? " <strong>Origin:</strong> chips are grouped under <strong>your selected Calling</strong> or <strong>Any Calling</strong>."
        : ""
  }</p>`;
  const finishingKnackSet = new Set(character.finishing?.finishingKnackIds || []);
  const knackEntries = Object.entries(bundle.knacks)
    .filter(([kid]) => !kid.startsWith("_"))
    .sort((a, b) => {
      const ea = knackEligible(a[1], character, bundle);
      const eb = knackEligible(b[1], character, bundle);
      if (ea !== eb) return ea ? -1 : 1;
      return (a[1].name || a[0]).localeCompare(b[1].name || b[0]);
    });

  /** @param {HTMLElement} container */
  function appendKnackChip(container, kid, k) {
    const baseOk = knackEligible(k, character, bundle);
    const eligible = knackEligibleForCallingStep(k, character, bundle);
    const on = character.knackIds.includes(kid);
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
        ? heroUsesCallingSlots()
          ? "This Knack no longer fits your per-Calling Knack budgets on the three rows (each row’s dots cap that row’s Knacks; one Immortal uses two on a row with two+ dots; at most one Immortal overall). Adjust dots, Callings, or clear Knacks."
          : "This Knack no longer fits your Calling dot budget (one Immortal Knack uses two dot-equivalents; you may only have one Immortal). Lower Calling dots or clear Knacks."
        : "This Knack no longer matches your Calling, tier, or optional gates—remove it or adjust your character.";
    }
    setKnackChipContents(chip, k);
    chip.addEventListener("click", () => {
      if (chip.disabled) return;
      const set = new Set(character.knackIds);
      const finSet = new Set(character.finishing?.finishingKnackIds || []);
      if (set.has(kid)) set.delete(kid);
      else if (eligible && !finSet.has(kid)) set.add(kid);
      character.knackIds = [...set];
      if (heroUsesCallingSlots()) syncHeroKnackSlotAssignments(character, bundle);
      render();
    });
    const appliesLine = knackAppliesToCallingsLine(k, bundle);
    applyGameDataHint(chip, k, appliesLine ? { prefix: appliesLine } : undefined);
    if (slotBlocked) {
      const gateHint = heroUsesCallingSlots()
        ? "You qualify for this Knack (Calling / tier / optional data gates), but none of your Calling rows can spend the Knack budget for it yet—each Heroic Knack needs one free dot on a matching row; one Immortal needs two free dots on a row with at least two dots, and you may only know one Immortal Knack."
        : "You qualify for this Knack (Calling / tier / optional data gates), but your Calling Knack budget is full—clear a pick first (Origin: one Mortal Knack from Calling dots).";
      chip.title = chip.title ? `${chip.title}\n\n${gateHint}` : gateHint;
    }
    if (on && heroUsesCallingSlots() && character.knackSlotById && character.knackSlotById[kid] != null && Array.isArray(character.callingSlots)) {
      const ri = character.knackSlotById[kid];
      const rowId = String(character.callingSlots[ri]?.id || "").trim();
      const rowName = (rowId && bundle.callings[rowId] && bundle.callings[rowId].name) || rowId || `row ${ri + 1}`;
      const payNote = `Charged to: ${rowName} (${ri + 1} of 3).`;
      chip.title = chip.title ? `${chip.title}\n\n${payNote}` : payNote;
    }
    container.appendChild(chip);
  }

  if (heroUsesCallingSlots()) {
    /** @type {Map<number | "any", [string, Record<string, unknown>][]>} */
    const buckets = new Map();
    const pushBucket = (key, pair) => {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(pair);
    };
    for (const [kid, k] of knackEntries) {
      const baseOk = knackEligible(k, character, bundle);
      const on = character.knackIds.includes(kid);
      if (!baseOk && !on) continue;
      if (!on && finishingKnackSet.has(kid)) continue;
      const tok = knackCallingTokensForRowMatch(k, character);
      let key = /** @type {number | "any"} */ ("any");
      if (tok !== null) {
        let placed = false;
        for (let ri = 0; ri < HERO_CALLING_ROW_COUNT; ri += 1) {
          if (heroCallingRowMatchesKnack(ri, k, character, bundle)) {
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
        const rid = String(character.callingSlots?.[key]?.id || "").trim();
        head.textContent = rid
          ? `${bundle.callings[rid]?.name || rid} (Calling ${key + 1})`
          : `Calling ${key + 1} — pick a Calling above`;
      }
      section.appendChild(head);
      const chipWrap = document.createElement("div");
      chipWrap.className = "chips chips--calling-knack-subgroup";
      for (const [kid, k] of list) {
        appendKnackChip(chipWrap, kid, k);
      }
      section.appendChild(chipWrap);
      knackPanel.appendChild(section);
    }
  } else if (isOriginPlayTier(character.tier)) {
    /** @type {Map<"selected" | "any", [string, Record<string, unknown>][]>} */
    const buckets = new Map([
      ["selected", []],
      ["any", []],
    ]);
    const pushBucket = (key, pair) => {
      buckets.get(key).push(pair);
    };
    for (const [kid, k] of knackEntries) {
      const baseOk = knackEligible(k, character, bundle);
      const on = character.knackIds.includes(kid);
      if (!baseOk && !on) continue;
      if (!on && finishingKnackSet.has(kid)) continue;
      const key = originCallingKnackChipGroupKey(k, character);
      pushBucket(key, [kid, k]);
    }
    const order = /** @type {("selected" | "any")[]} */ (["selected", "any"]);
    for (const key of order) {
      const list = buckets.get(key) || [];
      const section = document.createElement("div");
      section.className = "calling-knack-chip-group";
      const head = document.createElement("h3");
      head.className = "calling-knack-chip-group-title";
      if (key === "any") {
        head.textContent = "Any Calling";
      } else {
        const rid = String(character.callingId || "").trim();
        head.textContent = rid
          ? `${bundle.callings[rid]?.name || rid} (your Calling)`
          : "Your Calling — pick above";
      }
      section.appendChild(head);
      const chipWrap = document.createElement("div");
      chipWrap.className = "chips chips--calling-knack-subgroup";
      if (list.length === 0) {
        const empty = document.createElement("p");
        empty.className = "help";
        empty.textContent =
          "No Knacks in this group pass your current gates, or every match is already taken as an extra Finishing Knack — adjust Calling, clear picks on Finishing, or check tier / pantheon data.";
        chipWrap.appendChild(empty);
      } else {
        for (const [kid, k] of list) {
          appendKnackChip(chipWrap, kid, k);
        }
      }
      section.appendChild(chipWrap);
      knackPanel.appendChild(section);
    }
  } else {
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const [kid, k] of knackEntries) {
      const baseOk = knackEligible(k, character, bundle);
      const on = character.knackIds.includes(kid);
      if (!baseOk && !on) continue;
      if (!on && finishingKnackSet.has(kid)) continue;
      appendKnackChip(chips, kid, k);
    }
    knackPanel.appendChild(chips);
  }
  applyHint(knackPanel, "knack-select");
  wrap.appendChild(knackPanel);

  root.appendChild(panel("Calling & Knacks", wrap));
}

function renderPurviews(root) {
  ensurePatronPurviewSlots();
  restrictHeroPurviewsToPatronList();
  const tierNorm = normalizedTierId(character.tier);
  const singlePatronPurviewTier = tierNorm === "hero" || tierNorm === "titanic";
  const patronOpts = patronPurviewOptionIds();
  const patronSet = new Set(patronOpts);
  const wrap = document.createElement("div");
  const lim = patronPurviewSlotLimitForCharacter();
  const tierPvNote = bundle.tier[character.tier]?.purviewsChargenNote;
  if (typeof tierPvNote === "string" && tierPvNote.trim()) {
    const tierP = document.createElement("p");
    tierP.className = "help tier-purviews-note";
    tierP.textContent = tierPvNote.trim();
    wrap.appendChild(tierP);
  }
  if (singlePatronPurviewTier && character.pantheonId) {
    const sig = pantheonSignaturePurviewId();
    const pPant = selectedPantheon();
    const sigPanel = document.createElement("section");
    sigPanel.className = "panel hero-pantheon-signature-purview";
    const sigH = document.createElement("h2");
    sigH.textContent = "Pantheon Signature Purview";
    sigPanel.appendChild(sigH);
    const sigIntro = document.createElement("p");
    sigIntro.className = "help";
    const tierLab2 = tierNorm === "titanic" ? "Titanic Scions" : "Heroes";
    sigIntro.innerHTML = `Besides <strong>one innate Purview</strong> from your patron’s list, <strong>${tierLab2}</strong> of <strong>${pPant?.name || character.pantheonId}</strong> gain this pantheon’s Signature (Specialty) Purview. It is kept on your sheet automatically and does not use your single parent pick.`;
    sigPanel.appendChild(sigIntro);
    const sigVal = document.createElement("p");
    if (sig) {
      const disp = pantheonSignaturePurviewDisplayLabel();
      const pv = bundle.purviews?.[sig];
      const strong = document.createElement("strong");
      strong.textContent = disp;
      sigVal.appendChild(strong);
      const hintEntity = {
        name: disp,
        description: (pv?.description || "").trim(),
        mechanicalEffects: (pv?.mechanicalEffects || "").trim(),
        source: (pv?.source || "").trim(),
      };
      applyGameDataHint(sigVal, hintEntity);
    } else {
      sigVal.className = "warn";
      const motm = masksMotMBundle()?.heroPurviewsCallout;
      sigVal.textContent =
        String(character.pantheonId) === "mythos" && typeof motm === "string" && motm.trim()
          ? motm.trim()
          : "Add a valid signaturePurviewId for this pantheon in pantheons.json (and matching purviews.json) to show the Signature Purview name here.";
    }
    sigPanel.appendChild(sigVal);
    if (sig) {
      const innateSig = document.createElement("div");
      innateSig.className = "hero-signature-innate-preview";
      const ih = document.createElement("h3");
      ih.className = "hero-signature-innate-preview-title";
      ih.textContent = "Innate (automatic with Signature Purview)";
      innateSig.appendChild(ih);
      appendPurviewInnateDetails(innateSig, sig);
      sigPanel.appendChild(innateSig);
    }
    wrap.appendChild(sigPanel);
  }
  const help = document.createElement("p");
  help.className = "help";
  if (tierNorm === "titanic") {
    const ep = bundle?.epicenters;
    const epMeta = ep && typeof ep === "object" && typeof ep._meta === "object" ? ep._meta : null;
    const epNote = document.createElement("div");
    epNote.className = "panel titanic-epicenters-panel";
    const epH = document.createElement("h2");
    epH.textContent = "Epicenters (Titanic)";
    epNote.appendChild(epH);
    const epP = document.createElement("p");
    epP.className = "help";
    epP.innerHTML =
      "For each <strong>universal Purview</strong> you track, Saints & Monsters uses an <strong>Epicenter</strong> in place of the usual Innate while unsuppressed (imbue Legend to suppress—see PDF). Summaries below come from <code>epicenters.json</code> when a matching id exists.";
    epNote.appendChild(epP);
    if (ep && typeof ep === "object") {
      const tracked = new Set(character.purviewIds || []);
      for (const pid of [...tracked].sort()) {
        const row = ep[pid];
        if (!row || typeof row !== "object" || pid.startsWith("_")) continue;
        const pv = bundle.purviews?.[pid];
        const dl = document.createElement("div");
        dl.className = "titanic-epicenter-row";
        const title = document.createElement("div");
        title.className = "titanic-epicenter-title";
        title.innerHTML = `<strong>${purviewDisplayNameForPantheon(pid, bundle, character.pantheonId) || pid}</strong>`;
        dl.appendChild(title);
        const sum = document.createElement("div");
        sum.className = "help";
        sum.textContent = (row.summary || "").trim() || "—";
        dl.appendChild(sum);
        epNote.appendChild(dl);
      }
    } else {
      const miss = document.createElement("p");
      miss.className = "warn";
      miss.textContent = "No epicenters table in bundle — add epicenters.json to game data.";
      epNote.appendChild(miss);
    }
    if (epMeta?.note && typeof epMeta.note === "string" && epMeta.note.trim()) {
      const metaP = document.createElement("p");
      metaP.className = "help mono";
      metaP.textContent = epMeta.note.trim();
      epNote.appendChild(metaP);
    }
    wrap.appendChild(epNote);
  }

  if (singlePatronPurviewTier) {
    if (patronOpts.length > 0) {
      help.innerHTML = isMythosPantheonSelected()
        ? `Use <strong>Patron innate Purview</strong> (chips) for your <strong>standard</strong> innate Purview. The <strong>Mythos: Awareness Innate</strong> section below is <em>only</em> if you commit MotM’s optional Awareness Innate—same page, different choice. Your pantheon Signature stays automatic (see above). You can also set the patron pick on <strong>Paths</strong>.`
        : `Pick <strong>one</strong> innate Purview from your parent’s list—use the chips in <strong>Patron innate Purview</strong> below or the Patron Purview control on <strong>Paths</strong>. (Your pantheon Signature is separate; see above.)`;
    } else {
      const motmPaths = isMythosPantheonSelected() ? masksMotMBundle()?.pathsCallout : "";
      if (typeof motmPaths === "string" && motmPaths.trim()) {
        help.textContent = motmPaths.trim();
      } else {
        help.innerHTML =
          "At <strong>Hero</strong> or <strong>Titanic</strong>, choose a <strong>divine parent</strong> on Paths to see that parent’s innate Purview options. Your pantheon Signature Purview still applies when your pantheon is set.";
      }
    }
  } else if (patronOpts.length > 0 && lim > 0) {
    help.innerHTML = `Patron Purviews from your divine parent are chosen on the <strong>Paths</strong> step (up to <strong>${lim}</strong> from that parent’s list only). Here, add <em>other</em> Purviews you track (e.g. from Relics or other Birthrights). Full Boon and Purview write-ups: <em>Pandora’s Box (Revised)</em> first; tier books where PB references them.`;
  } else {
    help.innerHTML =
      "Select Purviews to track on the sheet (choose a divine parent on Paths to restrict patron picks to Appendix 2). Full Boon and Purview text: <em>Pandora’s Box (Revised)</em> (primary); <em>Origin</em> Appendix 2 lists patron Purviews by deity.";
  }
  applyHint(help, "purview-select");
  wrap.appendChild(help);
  const chips = document.createElement("div");
  chips.className = "chips purviews-patron-innate-chips";
  /** @type {[string, Record<string, unknown>][]} */
  let purviewEntries;
  if (singlePatronPurviewTier) {
    purviewEntries = patronOpts
      .map((pid) => [pid, bundle.purviews?.[pid]])
      .filter(([pid, p]) => !String(pid).startsWith("_") && p && typeof p === "object");
  } else {
    purviewEntries = Object.entries(bundle.purviews || {}).filter(
      ([pid, p]) =>
        !pid.startsWith("_") &&
        p &&
        typeof p === "object" &&
        !(patronOpts.length > 0 && patronSet.has(pid)),
    );
  }
  for (const [pid, p] of purviewEntries) {
    const chipWrap = document.createElement("div");
    chipWrap.className = "purview-chip-wrap";
    const chip = document.createElement("button");
    chip.type = "button";
    const chipOn = singlePatronPurviewTier
      ? (character.patronPurviewSlots[0] || "") === pid
      : character.purviewIds.includes(pid);
    chip.className = "chip" + (chipOn ? " on" : "");
    chip.textContent = purviewDisplayNameForPantheon(pid, bundle, character.pantheonId) || p.name;
    chip.addEventListener("click", () => {
      ensurePatronPurviewSlots();
      if (singlePatronPurviewTier) {
        const cur = character.patronPurviewSlots[0] || "";
        const next = cur === pid ? "" : pid;
        character.patronPurviewSlots[0] = next;
        for (let j = 1; j < PATRON_PURVIEW_SLOT_COUNT; j += 1) character.patronPurviewSlots[j] = "";
        syncPurviewIdsFromPatronSlots();
        render();
        return;
      }
      const set = new Set(character.purviewIds);
      if (set.has(pid)) set.delete(pid);
      else set.add(pid);
      character.purviewIds = [...set];
      syncPurviewIdsFromPatronSlots();
      render();
    });
    applyGameDataHint(chip, p);
    chipWrap.appendChild(chip);
    if (chipOn) {
      const innateUnder = document.createElement("div");
      innateUnder.className = "purview-innate-under-chip";
      appendPurviewInnateDetails(innateUnder, pid);
      chipWrap.appendChild(innateUnder);
    }
    chips.appendChild(chipWrap);
  }
  if (singlePatronPurviewTier) {
    const patronInnatePanel = document.createElement("section");
    patronInnatePanel.className = "panel purviews-patron-innate-panel";
    const ph = document.createElement("h2");
    ph.textContent = "Patron innate Purview";
    patronInnatePanel.appendChild(ph);
    const pIntro = document.createElement("p");
    pIntro.className = "help purviews-patron-innate-intro";
    if (isMythosPantheonSelected()) {
      pIntro.innerHTML =
        "Turn <strong>one</strong> chip on. That is the patron Purview whose <strong>standard innate</strong> you use (Pandora’s Box / Hero). It is <strong>not</strong> chosen with the Awareness dropdown—use the next panel only if you deliberately replace that model with MotM’s <strong>Awareness Innate</strong> (and commit).";
    } else {
      pIntro.innerHTML =
        "Turn <strong>one</strong> chip on for the innate Purview from your divine parent’s list (same value as Patron Purview 1 on Paths). Innate write-ups preview under the selected chip.";
    }
    patronInnatePanel.appendChild(pIntro);
    patronInnatePanel.appendChild(chips);
    wrap.appendChild(patronInnatePanel);
    renderMythosInnatePowerPanel(wrap);
  } else {
    renderMythosInnatePowerPanel(wrap);
    wrap.appendChild(chips);
  }
  const patronPickWarn = heroPurviewsPatronPickRequiredAndMissing();
  if (patronPickWarn) {
    const wPv = document.createElement("p");
    wPv.className = "warn";
    wPv.textContent = patronPickWarn;
    wrap.appendChild(wPv);
  }
  root.appendChild(panel("Purviews", wrap));
}

/** @returns {{ id: string, name: string, summary?: string }[]} */
function sorcererWorkingsCatalogRows() {
  const rows = saintsMonstersBundle()?.sorcererWorkingsCatalog;
  if (Array.isArray(rows) && rows.length) {
    return rows
      .filter((r) => r && typeof r === "object" && typeof r.id === "string" && r.id.trim() && typeof r.name === "string")
      .map((r) => ({ id: String(r.id).trim(), name: String(r.name).trim(), summary: typeof r.summary === "string" ? r.summary : "" }));
  }
  return [
    { id: "binding", name: "Binding", summary: "Curses, bindings, and hostile conditions (S&M from p. 66)." },
    { id: "divining", name: "Divining", summary: "Omens, investigation, and hidden knowledge (S&M from p. 68)." },
    { id: "summoning", name: "Summoning", summary: "Spirits and entities — calls, bargains, and banishments (S&M from p. 63 onward)." },
    { id: "wonderment", name: "Wonderment", summary: "Illusions and unreal creations (S&M from p. 64 onward)." },
    { id: "shapechanging", name: "Shapechanging", summary: "Forms and transformations (S&M from p. 66 onward)." },
  ];
}

function renderWorkings(root) {
  ensureSorceryProfileShape();
  const cap = sorcererWorkingPickCap(character.tier);
  const rows = sorcererWorkingsCatalogRows();
  const wrap = document.createElement("div");
  const intro = document.createElement("p");
  intro.className = "help";
  intro.innerHTML = `The five <strong>Workings</strong> in <cite>Saints & Monsters</cite> ch. 3 (see <strong>Workings, Techniques, and Charms</strong>, p. 65) group sorcery into broad families. Each Working includes an <strong>inherent Technique</strong>, optional <strong>Techniques</strong> as you gain Legend, and <strong>charms</strong>. Pick up to <strong>${cap}</strong> Working <em>names</em> here as sheet reminders — full mechanics stay in the PDF.`;
  wrap.appendChild(intro);

  const grid = document.createElement("div");
  grid.className = "grid-2";
  const sel = new Set(character.sorceryProfile.workingIds || []);
  for (const row of rows) {
    const id = row.id;
    const box = document.createElement("div");
    box.className = "field workings-pick-block";
    const lab = document.createElement("label");
    lab.htmlFor = `f-working-${id}`;
    lab.innerHTML = `<strong>${row.name}</strong> <span class="mono">(${id})</span>`;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = `f-working-${id}`;
    cb.value = id;
    cb.checked = sel.has(id);
    cb.addEventListener("change", () => {
      ensureSorceryProfileShape();
      let next = [...(character.sorceryProfile.workingIds || [])].filter((x) => x !== id);
      if (cb.checked) next.push(id);
      const cap2 = sorcererWorkingPickCap(character.tier);
      while (next.length > cap2) next = next.slice(1);
      character.sorceryProfile.workingIds = next;
      render();
    });
    const sm = document.createElement("p");
    sm.className = "help mono";
    sm.textContent = (row.summary || "").trim() || "—";
    box.appendChild(lab);
    box.appendChild(cb);
    box.appendChild(sm);
    grid.appendChild(box);
  }
  wrap.appendChild(grid);
  const foot = document.createElement("p");
  foot.className = "help";
  const n = (character.sorceryProfile.workingIds || []).length;
  foot.textContent = `Selected ${n} of ${cap} Working(s). Additional Workings and extra Techniques beyond chargen are milestones and Experience at the table (p. 65).`;
  wrap.appendChild(foot);
  root.appendChild(panel("Workings", wrap));
}

function renderSorcerer(root) {
  ensureSorceryProfileShape();
  const sp = character.sorceryProfile;
  const tierLab = bundle.tier?.[character.tier]?.name || "Sorcerer";

  const overview = document.createElement("div");
  const p1 = document.createElement("p");
  p1.className = "help";
  p1.innerHTML = `<strong>${tierLab}.</strong> This step mirrors the <strong>Deity</strong> wizard: same <strong>panel</strong> layout, book citations in help text, and cross-links to <strong>Purviews</strong> / <strong>Boons</strong> / <strong>Birthrights</strong> where Heroic-band Sorcerers spend Paraphernalia. Rules text: <cite>Saints & Monsters</cite> ch. 3 (character creation summary ~pp. 83–85; mechanics ~pp. 63–65).`;
  overview.appendChild(p1);
  const p2 = document.createElement("p");
  p2.className = "help";
  p2.innerHTML =
    "<strong>Motif</strong> is how your magic looks and feels; <strong>Sources of Power</strong> are how you refresh and risk Legend (Invocation, Patronage, Prohibition, Talisman — pp. 63–64). At <strong>Heroic band</strong> and up, pick a <strong>primary</strong> source for focus; you can still sketch the others if you blend methods.";
  overview.appendChild(p2);
  root.appendChild(panel("Sorcerer overview", overview));

  const detail = document.createElement("div");
  const primOpts = [
    ["", "— (Mortal band / undecided)"],
    ["invocation", "Invocation"],
    ["patronage", "Patronage"],
    ["prohibition", "Prohibition"],
    ["talisman", "Talisman"],
  ];
  const primHtml = primOpts.map(([v, lab]) => `<option value="${v}">${lab}</option>`).join("");
  detail.innerHTML = `
    <div class="field"><label for="f-sorc-motif">Motif</label><input type="text" id="f-sorc-motif" autocomplete="off" spellcheck="true" /></div>
    <div class="field"><label for="f-sorc-primary">Primary source (Heroic+)</label><select id="f-sorc-primary">${primHtml}</select></div>
    <div class="field"><label for="f-sorc-source">Sources of Power (freeform)</label><textarea id="f-sorc-source" rows="3"></textarea></div>
    <div class="field"><label for="f-sorc-invocation">Invocation (costs, hubris, disguise)</label><textarea id="f-sorc-invocation" rows="2"></textarea></div>
    <div class="field"><label for="f-sorc-patronage">Patronage (Fatebinding, compels)</label><textarea id="f-sorc-patronage" rows="2"></textarea></div>
    <div class="field"><label for="f-sorc-prohibition">Prohibition (Sorcerous Prohibition condition)</label><textarea id="f-sorc-prohibition" rows="2"></textarea></div>
    <div class="field"><label for="f-sorc-talisman">Talisman (Relic bond, Legend pool)</label><textarea id="f-sorc-talisman" rows="2"></textarea></div>
    <div class="field"><label for="f-sorc-techniques">Techniques and charms (notes)</label><textarea id="f-sorc-techniques" rows="4" placeholder="Inherent + chosen Techniques per Working; charms at the table (p. 65)."></textarea></div>
    <div class="field"><label for="f-sorc-notes">Chronicle / Marvel / SG notes</label><textarea id="f-sorc-notes" rows="3"></textarea></div>`;
  root.appendChild(panel("Sorcerer profile (Motif & sources)", detail));

  document.getElementById("f-sorc-motif").value = sp.motif || "";
  document.getElementById("f-sorc-primary").value = sp.primaryPowerSource || "";
  document.getElementById("f-sorc-source").value = sp.powerSource || "";
  document.getElementById("f-sorc-invocation").value = sp.invocation || "";
  document.getElementById("f-sorc-patronage").value = sp.patronage || "";
  document.getElementById("f-sorc-prohibition").value = sp.prohibition || "";
  document.getElementById("f-sorc-talisman").value = sp.talisman || "";
  document.getElementById("f-sorc-techniques").value = sp.techniquesNotes || "";
  document.getElementById("f-sorc-notes").value = sp.notes || "";

  const link = document.createElement("div");
  link.className = "panel";
  link.innerHTML =
    "<h2>Magic Purview and Paraphernalia</h2><p class=\"help\">Use the <strong>Purviews</strong> and <strong>Boons</strong> steps for the <strong>Magic</strong> Purview (merged from supplement data). Use <strong>Birthrights</strong> for <strong>Paraphernalia</strong> (Relics, Followers, etc.) at Heroic band and above — same seven-dot default as Hero Scions unless your table adjusts it.</p>";
  root.appendChild(link);
}

function renderTitanicExtras(root) {
  ensureTitanicProfileShape();
  const tp = character.titanicProfile;
  const wrap = document.createElement("div");
  const callOpts = [...TITANIC_CALLING_IDS_SM_KNACKS].sort((a, b) =>
    String(bundle.callings?.[a]?.name || a).localeCompare(String(bundle.callings?.[b]?.name || b), undefined, {
      sensitivity: "base",
    }),
  );
  const optsHtml = ['<option value="">—</option>']
    .concat(callOpts.map((cid) => `<option value="${cid}">${bundle.callings?.[cid]?.name || cid}</option>`))
    .join("");
  wrap.innerHTML = `
    <p class="help">Titanic <strong>Mutations</strong> and <strong>Maelstrom Hearts</strong> are PDF-first; use these fields as sheet reminders. Epicenter summaries appear on the <strong>Purviews</strong> step.</p>
    <div class="field"><label for="f-titan-motif">Motif (narrative)</label><input type="text" id="f-titan-motif" autocomplete="off" spellcheck="true" /></div>
    <div class="field"><label for="f-titan-mutation-calling">Mutation Calling facet</label><select id="f-titan-mutation-calling">${optsHtml}</select></div>
    <div class="field"><label for="f-titan-mutation-dots">Mutation dots (0–5)</label><input type="number" id="f-titan-mutation-dots" min="0" max="5" step="1" /></div>
    <div class="field"><label for="f-titan-condition">Condition / tag notes</label><textarea id="f-titan-condition" rows="3"></textarea></div>
    <div class="field"><label for="f-titan-suppress">Epicenter suppression / collateral notes</label><textarea id="f-titan-suppress" rows="2"></textarea></div>`;
  root.appendChild(panel("Titanic extras (Saints & Monsters)", wrap));
  document.getElementById("f-titan-motif").value = tp.motif || "";
  document.getElementById("f-titan-mutation-calling").value = tp.mutationCallingId || "";
  document.getElementById("f-titan-mutation-dots").value = String(tp.mutationDots ?? 0);
  document.getElementById("f-titan-condition").value = tp.condition || "";
  document.getElementById("f-titan-suppress").value = tp.suppressEpicenterNotes || "";
}

function renderBirthrights(root) {
  ensureFinishingShape();
  const cap = maxBirthrightPointsBudget();
  const used = finishingBirthrightPointsUsed();
  const wrap = document.createElement("div");
  const meta = bundle.birthrights?._meta || {};

  if (meta.introduction) {
    const p = document.createElement("p");
    p.className = "help";
    p.textContent = meta.introduction;
    wrap.appendChild(p);
  }
  if (meta.pointBudgets) {
    const p2 = document.createElement("p");
    p2.className = "help";
    p2.textContent = meta.pointBudgets;
    wrap.appendChild(p2);
  }

  if (Array.isArray(meta.typesTable) && meta.typesTable.length > 0) {
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
  const sum = document.createElement("p");
  sum.className = "help";
  sum.textContent = `Points used: ${used} / ${cap}. “Add” spends that row’s point cost; remove picks below to free points. The same catalog entry may be added more than once if your budget allows (each pick is separate).`;
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
  const entries = Object.entries(bundle.birthrights)
    .filter(([id]) => !id.startsWith("_"))
    .sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]));
  for (const [bid, br] of entries) {
    const cost = birthrightPointCost(bid);
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = br.name || bid;
    const tdType = document.createElement("td");
    tdType.textContent = br.birthrightType || "—";
    const tdCost = document.createElement("td");
    tdCost.textContent = String(cost);
    tdCost.className = "birthrights-td-num";
    const tdDesc = document.createElement("td");
    tdDesc.className = "birthrights-td-desc";
    tdDesc.textContent = br.description || br.mechanicalEffects || "—";
    const tdAct = document.createElement("td");
    tdAct.className = "birthrights-td-action";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn secondary";
    btn.textContent = "Add";
    btn.disabled = used + cost > cap;
    btn.addEventListener("click", () => {
      if (finishingBirthrightPointsUsed() + cost > cap) return;
      addFinishingBirthright(bid);
      render();
    });
    applyGameDataHint(btn, br);
    const addHint = btn.disabled
      ? `Not enough points left for this cost (${cost}). Remove picks below to free budget—you can add the same template again once it fits.`
      : "Adds another pick of this template if you want several of the same Birthright (each costs its points).";
    btn.title = btn.title ? `${btn.title}\n\n${addHint}` : addHint;
    tdAct.appendChild(btn);
    tr.appendChild(tdName);
    tr.appendChild(tdType);
    tr.appendChild(tdCost);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAct);
    tr.setAttribute(
      "data-filter-text",
      `${br.name || bid} ${bid} ${br.birthrightType || ""} ${(br.description || br.mechanicalEffects || "").slice(0, 160)}`.trim(),
    );
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

  const picks = document.createElement("section");
  picks.className = "panel birthrights-picks-panel";
  const hp = document.createElement("h2");
  hp.textContent = "Your Birthright picks";
  picks.appendChild(hp);
  const plist = document.createElement("ul");
  plist.className = "finishing-birthright-picks";
  (character.finishing.birthrightPicks || []).forEach((bid, idx) => {
    const li = document.createElement("li");
    const br = bundle.birthrights[bid];
    li.textContent = `${br?.name || bid} (${birthrightPointCost(bid)} pt) — `;
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn secondary";
    rm.textContent = "Remove";
    rm.addEventListener("click", () => {
      removeFinishingBirthright(idx);
      render();
    });
    li.appendChild(rm);
    plist.appendChild(li);
  });
  if ((character.finishing.birthrightPicks || []).length === 0) {
    const empty = document.createElement("p");
    empty.className = "help";
    empty.textContent = "No picks yet — use Add in the table above.";
    picks.appendChild(empty);
  } else {
    picks.appendChild(plist);
  }
  wrap.appendChild(picks);

  const panelEl = panel("Birthrights", wrap);
  applyHint(panelEl, "birthrights-step");
  root.appendChild(panelEl);
}

function renderBoons(root) {
  const wrap = document.createElement("div");

  if (isMythosPantheonSelected()) {
    const rawAwBoon = masksMotMBundle()?.mythosAwarenessBoonCallout;
    const awBoonText =
      typeof rawAwBoon === "string" && rawAwBoon.trim()
        ? rawAwBoon.trim()
        : "Boons — You may choose to pick up an Awareness Boon as one of your initial Boons. You can only start with one Awareness Boon at character creation.";
    const motmBoonNote = document.createElement("p");
    motmBoonNote.className = "help mythos-awareness-boon-callout";
    motmBoonNote.textContent = awBoonText;
    wrap.appendChild(motmBoonNote);
  }

  const capHelp = document.createElement("p");
  capHelp.className = "help";
  capHelp.textContent = `You may select up to ${MAX_WIZARD_BOON_PICKS} Boons from the lists below. Purview Innate powers are granted with each Purview you hold — they are not Boons and do not use a slot here. After ${MAX_WIZARD_BOON_PICKS} Boons are chosen, other options are hidden until you remove a pick.`;
  wrap.appendChild(capHelp);

  const entries = Object.entries(bundle.boons)
    .filter(([bid]) => !bid.startsWith("_"))
    .sort((a, b) => {
      const pa = String(boonPrimaryPurview(a[1]) || "").localeCompare(String(boonPrimaryPurview(b[1]) || ""));
      if (pa !== 0) return pa;
      return (Number(a[1].dot) || 0) - (Number(b[1].dot) || 0);
    });

  let lastPurview = null;
  let chips = null;
  let anyShown = false;
  const atBoonCap = (character.boonIds || []).length >= MAX_WIZARD_BOON_PICKS;

  for (const [bid, b] of entries) {
    if (boonIsPurviewInnateAutomaticGrant(b, bundle)) continue;
    const eligible = boonEligible(b, character, bundle);
    const on = character.boonIds.includes(bid);
    if (!on && (!eligible || atBoonCap)) continue;
    anyShown = true;
    const primaryPv = boonPrimaryPurview(b);
    if (primaryPv !== lastPurview) {
      const sec = document.createElement("section");
      sec.className = "boon-purview-group";
      const h = document.createElement("h4");
      h.className = "boon-purview-heading";
      const canonPid = String(primaryPv || "").trim();
      const pvHead = bundle.purviews[canonPid];
      const pvHeading = purviewDisplayNameForPantheon(canonPid, bundle, character.pantheonId);
      h.textContent = pvHeading || primaryPv || "Purview";
      if (pvHead && typeof pvHead === "object") {
        applyGameDataHint(h, { ...pvHead, name: pvHeading || pvHead.name });
      }
      sec.appendChild(h);
      const innateName =
        pvHead && typeof pvHead === "object" && typeof pvHead.purviewInnateName === "string" ? pvHead.purviewInnateName.trim() : "";
      const innateBody =
        purviewStandardInnateSummary(canonPid) ||
        "See Pandora’s Box (Revised) for this Purview’s standard Innate Power (Hero where PB cross-references it).";
      const innP = document.createElement("p");
      innP.className = "help boon-purview-innate-callout";
      innP.appendChild(document.createTextNode("Innate (granted with this Purview — not a Boon below): "));
      if (innateName) {
        const sn = document.createElement("strong");
        sn.textContent = innateName;
        innP.appendChild(sn);
        innP.appendChild(document.createTextNode(" — "));
      }
      innP.appendChild(document.createTextNode(innateBody));
      sec.appendChild(innP);
      chips = document.createElement("div");
      chips.className = "chips";
      sec.appendChild(chips);
      wrap.appendChild(sec);
      lastPurview = primaryPv;
    }
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (on ? " on" : "") + (!eligible && on ? " chip-unqualified" : "");
    if (!eligible && on) {
      chip.title =
        "This Boon no longer matches your Purviews, tier, or prerequisite chain—remove it or adjust your character.";
    }
    const boonChipLabel = boonDisplayLabel(b, bundle, character.pantheonId);
    chip.textContent = boonChipLabel;
    chip.addEventListener("click", () => {
      const set = new Set(character.boonIds);
      if (set.has(bid)) set.delete(bid);
      else if (eligible && set.size < MAX_WIZARD_BOON_PICKS) set.add(bid);
      character.boonIds = [...set];
      render();
    });
    applyGameDataHint(chip, { ...b, name: boonChipLabel });
    chips.appendChild(chip);
  }

  if (!anyShown) {
    const empty = document.createElement("p");
    empty.className = "help";
    const tracked = [...characterPurviewIdSet(character, bundle)].sort();
    const trackedNote =
      tracked.length > 0
        ? ` Purviews currently in scope for this wizard: <strong>${tracked.map((id) => purviewDisplayNameForPantheon(id, bundle, character.pantheonId)).join(", ")}</strong>.`
        : " <strong>No Purviews in scope yet</strong> — at Hero/Titanic set your patron innate on <strong>Paths</strong> (and confirm your pantheon Signature); at Demigod+ add Purviews on the Purviews step.";
    empty.innerHTML =
      "No qualifying Boons yet — confirm <strong>tier</strong> (e.g. some Boons need Demigod or God tier) and Purviews in scope. (Legend and printed Boon prerequisites from the books are not enforced in this wizard; both change in play — confirm at the table.)" +
      trackedNote +
      " If this list omits a Purview you expect, open <strong>Paths</strong> / <strong>Purviews</strong> so patron slots and sheet picks sync, then return here.";
    wrap.appendChild(empty);
  }

  const boonPanel = panel("Boons", wrap);
  applyHint(boonPanel, "boon-select");
  root.appendChild(boonPanel);
}

function renderFinishing(root) {
  ensureFinishingShape();
  ensureSheetAppendicesShape();
  ensureFinishingBaselines();
  ensureSkillDots();

  const tierFin = normalizedTierId(character.tier);
  const heroLikeFinishing = tierFin === "hero" || tierFin === "titanic" || tierFin === "sorcerer_hero";
  const wrap = document.createElement("div");
  const intro = document.createElement("p");
  intro.className = "help";
  if (isOriginPlayTier(character.tier)) {
    intro.innerHTML =
      tierFin === "sorcerer"
        ? "<strong>Saints & Monsters ch. 3 — Finishing:</strong> spend <em>extra Skill dots</em> and <em>extra Attribute dot(s)</em> as for Origin characters, then either <em>two extra Knacks</em> or <em>four Birthright points</em> toward optional Paraphernalia (confirm finishing packages with the PDF)."
        : "<strong>Origin p. 99 — Finishing Touches:</strong> spend your <em>extra Skill dots</em> and <em>extra Attribute dot(s)</em> on the sheet here, then take either <em>two extra Knacks</em> or <em>four Birthright points</em> (Birthright templates — see <cite>Scion: Hero</cite> p. 201 for post-Visitation detail). Budgets below are table limits; place dots and picks in the sections that follow.";
  } else if (heroLikeFinishing) {
    if (tierFin === "sorcerer_hero") {
      intro.innerHTML =
        "<strong>Heroic Sorcerer — Finishing:</strong> spend <em>extra Skill dots</em> and <em>extra Attribute dot(s)</em> here only. <strong>Paraphernalia</strong> (seven dots) lives on the <strong>Birthrights</strong> step; <strong>Knacks</strong> on the <strong>Calling</strong> step (<cite>Saints & Monsters</cite> ch. 3). If you <strong>advanced</strong> from Mortal Sorcerer and already took Origin-style finishing there, keep budgets consistent with your save.";
    } else {
      const lab = tierFin === "titanic" ? "Titanic" : "Hero";
      intro.innerHTML = `<strong>${lab} — Finishing Touches:</strong> spend your <em>extra Skill dots</em> and <em>extra Attribute dot(s)</em> here only. At <strong>Origin</strong> you already chose either <em>two extra Knacks</em> or <em>four Birthright points</em> on Finishing — that is not repeated at ${lab}. Tier <strong>Birthrights</strong> (seven points) are on the <strong>Birthrights</strong> step; <strong>Calling</strong> is where you place Knacks from your Calling rows.`;
    }
  } else {
    intro.innerHTML =
      "<strong>Finishing Touches:</strong> spend your <em>extra Skill dots</em> and <em>extra Attribute dot(s)</em> on the sheet here, then take either <em>two extra Knacks</em> or <em>four Birthright points</em> toward your tier Birthrights budget (see <cite>Scion: Demigod</cite> / <cite>God</cite> and the Birthrights step). Budgets below are table limits.";
  }
  wrap.appendChild(intro);

  const budget = document.createElement("div");
  budget.className = "grid-2";
  if (heroLikeFinishing) {
    budget.innerHTML = `
    <div class="field"><label>Extra skill dots (budget)</label><input type="number" id="fin-skill" min="0" max="20" /></div>
    <div class="field"><label>Extra attribute dot(s) (budget)</label><input type="number" id="fin-attr" min="0" max="10" /></div>
    <p class="help" id="fin-focus-hero-note">Extra Knacks from Origin Finishing stay in your save; this step does not offer them again. Birthrights at Hero/Titanic (seven points) are on the <strong>Birthrights</strong> step.</p>`;
  } else {
    budget.innerHTML = `
    <div class="field"><label>Extra skill dots (budget)</label><input type="number" id="fin-skill" min="0" max="20" /></div>
    <div class="field"><label>Extra attribute dot(s) (budget)</label><input type="number" id="fin-attr" min="0" max="10" /></div>
    <div class="field"><label>Knacks vs Birthrights</label>
      <select id="fin-focus">
        <option value="birthrights">Four Birthright points</option>
        <option value="knacks">Two extra Knacks</option>
      </select>
    </div>`;
  }
  wrap.appendChild(budget);

  const placedSk = finishingSkillDotsPlaced();
  const remSk = finishingSkillDotsRemaining();
  const placedAt = finishingAttrDotsPlaced();
  const remAt = finishingAttrDotsRemaining();
  const overSk = placedSk > (character.finishing.extraSkillDots || 0);
  const overAt = placedAt > (character.finishing.extraAttributeDots || 0);

  const sum = document.createElement("p");
  sum.className = "help finishing-budget-summary";
  sum.textContent = `Skill finishing: ${placedSk} / ${character.finishing.extraSkillDots || 0} dots placed (${remSk} remaining). Attribute finishing: ${placedAt} / ${character.finishing.extraAttributeDots || 0} dot(s) placed (${remAt} remaining).`;
  wrap.appendChild(sum);

  if (overSk || overAt) {
    const w = document.createElement("p");
    w.className = "warn";
    w.textContent =
      (overSk ? "Placed skill dots exceed the budget — raise “Extra skill dots” or lower Skills below. " : "") +
      (overAt ? "Placed attribute dots exceed the budget — raise “Extra attribute dot(s)” or lower Attributes below." : "");
    wrap.appendChild(w);
  }

  const skPanel = document.createElement("section");
  skPanel.className = "panel finishing-place-panel";
  skPanel.innerHTML =
    "<h2>Skills — spend finishing dots</h2><p class='help'>Same layout as the Skills step. Dots cannot go below your last snapshot from the Skills step; raised dots count against the finishing Skill budget. At 3+ dots, note Specialties.</p>";
  const skTable = document.createElement("table");
  skTable.className = "skill-ratings-table finishing-skills-table";
  const skThead = document.createElement("thead");
  const skHr = document.createElement("tr");
  ["Skill", "Dots"].forEach((lab, i) => {
    const th = document.createElement("th");
    th.textContent = lab;
    if (i > 0) th.className = "skill-ratings-th-num";
    skHr.appendChild(th);
  });
  skThead.appendChild(skHr);
  skTable.appendChild(skThead);
  const skBody = document.createElement("tbody");
  for (const sid of skillIds()) {
    const s = bundle.skills[sid];
    const val = character.skillDots[sid] || 0;
    const tr = document.createElement("tr");
    tr.className = "skill-rating-row";
    appendSkillRatingNameCell(tr, sid, s, val);
    appendSkillRatingDotsCell(tr, sid, s, val, "finishing");
    skBody.appendChild(tr);
  }
  skTable.appendChild(skBody);
  skPanel.appendChild(skTable);
  wrap.appendChild(skPanel);

  const atPanel = document.createElement("section");
  atPanel.className = "panel finishing-place-panel";
  const atH = document.createElement("h2");
  atH.textContent = "Attributes — spend finishing dot(s)";
  atPanel.appendChild(atH);
  const atHelp = document.createElement("p");
  atHelp.className = "help";
  atHelp.textContent =
    "Origin p. 98: one extra Attribute dot at character creation for each player character. It must be spent on an Attribute (not banked or traded). The book does not tie it to the 6 / 4 / 2 arenas; it still cannot break the five-dot-per-Attribute cap after Favored Approach (Origin p. 97). Dots show final ratings after Favored Approach.";
  atPanel.appendChild(atHelp);
  const finAttrBase = buildCharacterAttrsPre();
  const finAttrFinal = applyFavoredApproach(finAttrBase);
  for (const id of Object.keys(bundle.attributes)) {
    const meta = bundle.attributes[id];
    if (!meta || String(id).startsWith("_")) continue;
    const maxFinal = maxFinalAttrFinishing(id);
    const finalVal = finAttrFinal[id] ?? 1;
    const snap = character.finishing.attrBaseline?.[id];
    const baselinePre =
      snap != null ? Math.max(1, Math.min(5, Math.round(Number(snap)))) : (finAttrBase[id] ?? 1);
    const attrsLockedPre = { ...finAttrBase, [id]: baselinePre };
    const finalLockedThrough = Math.min(applyFavoredApproach(attrsLockedPre)[id] ?? 1, maxFinal);
    const block = document.createElement("div");
    block.className = "finishing-attr-block";
    block.appendChild(
      renderFinalAttrDotRow(
        meta.name,
        finalVal,
        maxFinal,
        (picked) => {
          const fav = character.favoredApproach;
          let pre = APPROACH_ATTRS[fav].includes(id) ? picked - 2 : picked;
          const minPre = character.finishing.attrBaseline?.[id] ?? 1;
          const maxPre = maxAttrFinishing(id);
          character.attributes[id] = Math.max(minPre, Math.min(pre, maxPre));
          render();
        },
        meta,
        1,
        "(after Favored Approach)",
        finalLockedThrough,
      ),
    );
    atPanel.appendChild(block);
  }
  wrap.appendChild(atPanel);

  /* Hero / Titanic / Heroic Sorcerer: Origin Finishing already offered extra Knacks or four Birthright points — do not repeat that UI here. */
  if (!heroLikeFinishing) {
    const knBr = document.createElement("section");
    knBr.className = "panel finishing-place-panel";
    if (character.finishing.knackOrBirthright === "knacks") {
      const finKnackNote = isOriginPlayTier(character.tier)
        ? " <strong>Origin:</strong> extra picks must also be <strong>Mortal</strong> Knacks only."
        : "";
      const finSmNote = hasTitanicSaintsMonstersKnackCalling()
        ? " <strong>Saints & Monsters</strong> Titanic Knacks (<code>sm_*</code>) follow the same gates."
        : "";
      knBr.innerHTML = `<h2>Extra Knacks (pick up to 2)</h2><p class="help">These are <strong>in addition to</strong> your Calling-dot Knacks from the Calling step (they do <strong>not</strong> spend that dot budget). The same Calling / tier / <code>knackKind</code> gates apply, plus at most <strong>one Immortal Knack</strong> across Calling + Finishing combined. Knacks already on Calling are hidden here. Up to two extra picks.${finKnackNote}${finSmNote}${
        isOriginPlayTier(character.tier)
          ? " <strong>Origin:</strong> chips are split under <strong>your Calling</strong> and <strong>Any Calling</strong>; you may pick from either group (same rules)."
          : ""
      }</p>`;
      const callingKnackSet = new Set(character.knackIds || []);
      const finUniq = [...new Set(character.finishing.finishingKnackIds || [])];
      const knackEntriesFin = Object.entries(bundle.knacks)
        .filter(([kid]) => !kid.startsWith("_"))
        .sort((a, b) => {
          const ea = knackEligibleForFinishingExtraKnack(a[1], character, bundle);
          const eb = knackEligibleForFinishingExtraKnack(b[1], character, bundle);
          if (ea !== eb) return ea ? -1 : 1;
          return (a[1].name || a[0]).localeCompare(b[1].name || b[0]);
        });

      /** @param {HTMLElement} container */
      function appendFinishingKnackChip(container, kid, k) {
        const eligibleFin = knackEligibleForFinishingExtraKnack(k, character, bundle);
        const on = character.finishing.finishingKnackIds.includes(kid);
        const eligibleShow = on ? knackFinishingPickIsValidHeld(k, character, bundle) : eligibleFin;
        if (!eligibleShow && !on) return;
        if (eligibleFin && !on && callingKnackSet.has(kid)) return;
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (on ? " on" : "") + (!eligibleShow && on ? " chip-unqualified" : "");
        const atFinCap = finUniq.length >= 2 && !on;
        chip.disabled = Boolean(eligibleFin && !on && atFinCap);
        if (chip.disabled) {
          chip.title = "Remove a Finishing Knack pick first (maximum two extra Knacks).";
        } else if (!eligibleShow && on) {
          chip.title =
            "No longer qualifies for your current Calling/tier/gates—remove or adjust your character.";
        }
        setKnackChipContents(chip, k);
        const appliesLine = knackAppliesToCallingsLine(k, bundle);
        applyGameDataHint(chip, k, appliesLine ? { prefix: appliesLine } : undefined);
        chip.addEventListener("click", () => {
          toggleFinishingKnack(kid);
          render();
        });
        container.appendChild(chip);
      }

      if (isOriginPlayTier(character.tier)) {
        /** @type {Map<"selected" | "any", [string, Record<string, unknown>][]>} */
        const finBuckets = new Map([
          ["selected", []],
          ["any", []],
        ]);
        for (const [kid, k] of knackEntriesFin) {
          const eligibleFin = knackEligibleForFinishingExtraKnack(k, character, bundle);
          const on = character.finishing.finishingKnackIds.includes(kid);
          const eligibleShow = on ? knackFinishingPickIsValidHeld(k, character, bundle) : eligibleFin;
          if (!eligibleShow && !on) continue;
          if (eligibleFin && !on && callingKnackSet.has(kid)) continue;
          finBuckets.get(originCallingKnackChipGroupKey(k, character)).push([kid, k]);
        }
        for (const key of /** @type {("selected" | "any")[]} */ (["selected", "any"])) {
          const list = finBuckets.get(key) || [];
          const section = document.createElement("div");
          section.className = "calling-knack-chip-group finishing-extra-knack-group";
          const head = document.createElement("h3");
          head.className = "calling-knack-chip-group-title";
          if (key === "any") {
            head.textContent = "Any Calling";
          } else {
            const rid = String(character.callingId || "").trim();
            head.textContent = rid
              ? `${bundle.callings[rid]?.name || rid} (your Calling)`
              : "Your Calling — set on Calling step";
          }
          section.appendChild(head);
          const chipWrap = document.createElement("div");
          chipWrap.className = "chips chips--calling-knack-subgroup";
          if (list.length === 0) {
            const empty = document.createElement("p");
            empty.className = "help";
            empty.textContent =
              "No extra Knacks in this group match your gates, or every candidate is already your Calling Knack — adjust Calling or clear picks.";
            chipWrap.appendChild(empty);
          } else {
            for (const [kid, k] of list) {
              appendFinishingKnackChip(chipWrap, kid, k);
            }
          }
          section.appendChild(chipWrap);
          knBr.appendChild(section);
        }
      } else {
        const kchips = document.createElement("div");
        kchips.className = "chips";
        for (const [kid, k] of knackEntriesFin) {
          appendFinishingKnackChip(kchips, kid, k);
        }
        knBr.appendChild(kchips);
      }
    } else {
      const cap = maxBirthrightPointsBudget();
      knBr.innerHTML = `<h2>Birthrights (up to ${cap} points)</h2><p class='help'>Add templates or examples below; each pick costs its listed points (data). Remove picks to free points. The same catalog entry may be picked more than once if your budget allows. These picks count toward your tier Birthrights budget (same list as the Birthrights step).</p>`;
      const used = finishingBirthrightPointsUsed();
      const pts = document.createElement("p");
      pts.className = "help";
      pts.textContent = `Points used: ${used} / ${cap}`;
      knBr.appendChild(pts);
      const finBar = document.createElement("div");
      finBar.className = "picker-toolbar";
      const finBrSearch = document.createElement("input");
      finBrSearch.type = "search";
      finBrSearch.className = "picker-search";
      finBrSearch.placeholder = "Filter by name, type, or id…";
      finBrSearch.autocomplete = "off";
      finBrSearch.setAttribute("aria-label", "Filter finishing birthrights");
      finBar.appendChild(finBrSearch);
      knBr.appendChild(finBar);
      const finScroll = document.createElement("div");
      finScroll.className = "picker-scroll";
      const finTbl = document.createElement("table");
      finTbl.className = "skill-ratings-table birthrights-table";
      const finThead = document.createElement("thead");
      const finHr = document.createElement("tr");
      ["Entry", "Type", "Pts", "Summary", ""].forEach((lab, idx) => {
        const th = document.createElement("th");
        th.textContent = lab;
        if (idx === 4) th.className = "birthrights-th-action";
        finHr.appendChild(th);
      });
      finThead.appendChild(finHr);
      finTbl.appendChild(finThead);
      const finBody = document.createElement("tbody");
      const capBr = maxBirthrightPointsBudget();
      const usedBr = finishingBirthrightPointsUsed();
      const finEntries = Object.entries(bundle.birthrights)
        .filter(([id]) => !id.startsWith("_"))
        .sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]));
      for (const [bid, br] of finEntries) {
        const cost = birthrightPointCost(bid);
        const tr = document.createElement("tr");
        const tagHay = `${birthrightTagIds(br).join(" ")} ${birthrightTagLabels(br, bundle).join(" ")}`.trim();
        tr.setAttribute(
          "data-filter-text",
          `${br.name || bid} ${bid} ${br.birthrightType || ""} ${tagHay} ${typeof br.description === "string" ? br.description : ""} ${typeof br.mechanicalEffects === "string" ? br.mechanicalEffects : ""}`.trim(),
        );
        const tdName = document.createElement("td");
        tdName.textContent = br.name || bid;
        const tdType = document.createElement("td");
        tdType.textContent = br.birthrightType || "—";
        const tdCost = document.createElement("td");
        tdCost.textContent = String(cost);
        tdCost.className = "birthrights-td-num";
        const tdDesc = document.createElement("td");
        tdDesc.className = "birthrights-td-desc";
        tdDesc.textContent = birthrightFinishingSummaryLine(br);
        const tdAct = document.createElement("td");
        tdAct.className = "birthrights-td-action";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn secondary";
        btn.textContent = "Add";
        btn.disabled = usedBr + cost > capBr;
        applyGameDataHint(btn, br);
        const addHintFin = btn.disabled
          ? `Not enough points left for this cost (${cost}). Remove picks below to free budget—you can add the same template again once it fits.`
          : "Adds another pick of this template if you want several of the same Birthright (each costs its points).";
        btn.title = btn.title ? `${btn.title}\n\n${addHintFin}` : addHintFin;
        btn.addEventListener("click", () => {
          if (finishingBirthrightPointsUsed() + cost > capBr) return;
          addFinishingBirthright(bid);
          render();
        });
        tdAct.appendChild(btn);
        tr.appendChild(tdName);
        tr.appendChild(tdType);
        tr.appendChild(tdCost);
        tr.appendChild(tdDesc);
        tr.appendChild(tdAct);
        finBody.appendChild(tr);
      }
      finTbl.appendChild(finBody);
      wirePickerRowFilter(finBrSearch, finBody);
      wireSortableTableColumns(finThead, finBody, [
        { get: (tr) => (tr.cells[0]?.textContent || "").trim() },
        { get: (tr) => (tr.cells[1]?.textContent || "").trim() },
        { get: (tr) => parseInt(String(tr.cells[2]?.textContent || "0"), 10) || 0, numeric: true },
        null,
        null,
      ]);
      finScroll.appendChild(finTbl);
      knBr.appendChild(finScroll);
      const list = document.createElement("ul");
      list.className = "finishing-birthright-picks";
      (character.finishing.birthrightPicks || []).forEach((bid, idx) => {
        const li = document.createElement("li");
        const br = bundle.birthrights[bid];
        li.textContent = `${br?.name || bid} (${birthrightPointCost(bid)} pt) — `;
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "btn secondary";
        rm.textContent = "Remove";
        rm.addEventListener("click", () => {
          removeFinishingBirthright(idx);
          render();
        });
        li.appendChild(rm);
        list.appendChild(li);
      });
      knBr.appendChild(list);
    }
    wrap.appendChild(knBr);
  }

  const sheetAppendix = document.createElement("section");
  sheetAppendix.className = "panel finishing-place-panel";
  sheetAppendix.innerHTML =
    "<h2>Sheet appendix (extra pages)</h2><p class='help'>The printable character sheet adds separate pages for <strong>equipment</strong> (from the equipment library), <strong>Fatebindings</strong>, and <strong>extended notes</strong>. Player / group notes from the Concept step still appear on page 1.</p>";
  const eqIntro = document.createElement("p");
  eqIntro.className = "help";
  eqIntro.textContent =
    "Pick gear for the printable Equipment page: search the library, then Add. Your list stays on the right; Remove anytime.";
  sheetAppendix.appendChild(eqIntro);
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
    .filter(([eid]) => !eid.startsWith("_"))
    .sort((a, b) => String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0])));
  for (const [eid, eq] of eqEntries) {
    const tr = document.createElement("tr");
    tr.setAttribute("data-filter-text", equipmentFilterHaystack(eid, eq));
    const nm = document.createElement("td");
    nm.textContent = eq.name || eid;
    const descTd = document.createElement("td");
    descTd.className = "equipment-picker-desc";
    descTd.textContent = equipmentPickerDescriptionLine(eq);
    const typ = document.createElement("td");
    typ.textContent = eq.equipmentType || "—";
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
      ensureSheetAppendicesShape();
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
    { get: (tr) => (tr.cells[0]?.textContent || "").trim() },
    { get: (tr) => (tr.cells[1]?.textContent || "").trim() },
    { get: (tr) => (tr.cells[2]?.textContent || "").trim() },
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
      lab.textContent = eq?.name || eid;
      applyGameDataHint(lab, eq);
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn secondary";
      rm.textContent = "Remove";
      rm.addEventListener("click", () => {
        ensureSheetAppendicesShape();
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
  sheetAppendix.appendChild(eqLayout);
  const fbWrap = document.createElement("div");
  fbWrap.className = "field";
  const fbLab = document.createElement("label");
  fbLab.htmlFor = "fin-fatebindings";
  fbLab.textContent = "Fatebindings (sheet page)";
  const fbTa = document.createElement("textarea");
  fbTa.id = "fin-fatebindings";
  fbTa.rows = 6;
  fbTa.placeholder = "NPC, bond strength, story beats…";
  fbWrap.appendChild(fbLab);
  fbWrap.appendChild(fbTa);
  sheetAppendix.appendChild(fbWrap);
  const snWrap = document.createElement("div");
  snWrap.className = "field";
  const snLab = document.createElement("label");
  snLab.htmlFor = "fin-sheet-notes";
  snLab.textContent = "Extended session / chronicle notes (sheet page)";
  const snTa = document.createElement("textarea");
  snTa.id = "fin-sheet-notes";
  snTa.rows = 8;
  snTa.placeholder = "Long-form notes for print — separate from page 1 “Player / group notes”.";
  snWrap.appendChild(snLab);
  snWrap.appendChild(snTa);
  sheetAppendix.appendChild(snWrap);
  wrap.appendChild(sheetAppendix);

  root.appendChild(panel("Finishing Touches", wrap));

  document.getElementById("fin-skill").value = String(character.finishing.extraSkillDots);
  document.getElementById("fin-attr").value = String(character.finishing.extraAttributeDots);
  const finFocusEl = document.getElementById("fin-focus");
  if (finFocusEl) finFocusEl.value = character.finishing.knackOrBirthright;
  const fateEl = document.getElementById("fin-fatebindings");
  if (fateEl) fateEl.value = character.fatebindings || "";
  const sheetNotesEl = document.getElementById("fin-sheet-notes");
  if (sheetNotesEl) sheetNotesEl.value = character.sheetNotesExtra || "";

  const syncBudget = () => {
    ensureFinishingShape();
    character.finishing.extraSkillDots = Math.max(0, Number(document.getElementById("fin-skill")?.value || 0));
    character.finishing.extraAttributeDots = Math.max(0, Number(document.getElementById("fin-attr")?.value || 0));
    render();
  };
  document.getElementById("fin-skill").onchange = syncBudget;
  document.getElementById("fin-attr").onchange = syncBudget;
  if (finFocusEl) {
    finFocusEl.onchange = (e) => {
      ensureFinishingShape();
      character.finishing.knackOrBirthright = e.target.value;
      render();
    };
    applyHint(finFocusEl, "fin-focus");
  }

  applyHint(document.getElementById("fin-skill"), "fin-skill");
  applyHint(document.getElementById("fin-attr"), "fin-attr");
}

function renderReview(root) {
  persistFromForm();
  const exportObj = buildExportObject();
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
  btnSheet.className = reviewViewMode === "sheet" ? "btn primary" : "btn secondary";
  btnSheet.textContent = "Character sheet";
  btnSheet.addEventListener("click", () => {
    reviewViewMode = "sheet";
    render();
  });
  const btnJson = document.createElement("button");
  btnJson.type = "button";
  btnJson.className = reviewViewMode === "json" ? "btn primary" : "btn secondary";
  btnJson.textContent = "JSON";
  btnJson.addEventListener("click", () => {
    reviewViewMode = "json";
    render();
  });
  const btnPrint = document.createElement("button");
  btnPrint.type = "button";
  btnPrint.className = "btn secondary review-print-btn";
  btnPrint.textContent = "Print sheet";
  btnPrint.title = "Opens the browser print dialog for the character sheet (hidden controls are omitted).";
  btnPrint.addEventListener("click", () => {
    const runPrint = () => window.print();
    if (reviewViewMode !== "sheet") {
      reviewViewMode = "sheet";
      render();
      requestAnimationFrame(() => {
        requestAnimationFrame(runPrint);
      });
      return;
    }
    runPrint();
  });
  const btnMrGonePdf = document.createElement("button");
  btnMrGonePdf.type = "button";
  btnMrGonePdf.className = "btn secondary";
  btnMrGonePdf.textContent = "Download MrGone Sheet";
  btnMrGonePdf.title =
    "Fills the community four-page AcroForm PDF (Mr. Gone / lnodiv style). Server needs that template file and PyMuPDF.";
  btnMrGonePdf.addEventListener("click", async () => {
    persistFromForm();
    const data = buildExportObject();
    const fields = buildScionInteractivePdfFields(data, bundle);
    const nm = String(data.characterName ?? "").trim() || "character";
    btnMrGonePdf.disabled = true;
    try {
      await downloadInteractiveCharacterPdf("scion", fields, nm);
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      btnMrGonePdf.disabled = false;
    }
  });
  const btnThisSheetPdf = document.createElement("button");
  btnThisSheetPdf.type = "button";
  btnThisSheetPdf.className = "btn secondary";
  btnThisSheetPdf.textContent = "Download This Sheet";
  btnThisSheetPdf.title =
    "A4 PDF from the on-screen sheet (Chromium + extra A4 layout CSS). Requires Playwright + `playwright install chromium` on the server; otherwise a simpler PDF engine is used. Not the MrGone AcroForm file.";
  btnThisSheetPdf.addEventListener("click", async () => {
    persistFromForm();
      const el = document.querySelector(".review-sheet-panel.character-sheet");
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
  toolbar.appendChild(btnMrGonePdf);
  toolbar.appendChild(btnThisSheetPdf);
  wrap.appendChild(toolbar);

  const sheetHooks = {
    getLegendPoolSpentAt: (idx) => {
      ensureLegendAwarenessPoolSlotArrays();
      return !!(character.legendPoolDotSpentSlots && character.legendPoolDotSpentSlots[idx]);
    },
    setLegendPoolSpentAt: (idx, v) => {
      ensureLegendAwarenessPoolSlotArrays();
      if (idx >= 0 && idx < character.legendPoolDotSpentSlots.length) {
        character.legendPoolDotSpentSlots[idx] = !!v;
        render();
      }
    },
    onLegendDotClick: (i) => {
      const maxT = legendDotMaxForTier(character.tier);
      const cur = clampLegendRating(character.legendRating ?? 0, character.tier);
      if (cur === i) character.legendRating = Math.max(0, i - 1);
      else character.legendRating = Math.min(i, maxT);
      syncLegendToTier();
      render();
    },
    getAwarenessPoolSpentAt: (idx) => {
      ensureLegendAwarenessPoolSlotArrays();
      return !!(character.awarenessPoolDotSpentSlots && character.awarenessPoolDotSpentSlots[idx]);
    },
    setAwarenessPoolSpentAt: (idx, v) => {
      ensureLegendAwarenessPoolSlotArrays();
      if (idx >= 0 && idx < character.awarenessPoolDotSpentSlots.length) {
        character.awarenessPoolDotSpentSlots[idx] = !!v;
        render();
      }
    },
  };
  const sheet = buildCharacterSheet(exportObj, bundle, sheetHooks);
  sheet.classList.add("review-sheet-panel");
  sheet.hidden = reviewViewMode !== "sheet";
  wrap.appendChild(sheet);

  const pre = document.createElement("pre");
  pre.className = "mono review-json-panel";
  pre.hidden = reviewViewMode !== "json";
  pre.textContent = JSON.stringify(exportObj, null, 2);
  wrap.appendChild(pre);

  if (!isDragonHeirChargen(character)) {
    const advRow = document.createElement("div");
    advRow.className = "review-advance-row";
    const adv = getTierAdvancementRule(character.tier);
    const nextId = adv?.nextTier;
    const nextMeta = nextId ? bundle.tier[nextId] : null;
    const btnAdv = document.createElement("button");
    btnAdv.type = "button";
    btnAdv.className = "btn secondary";
    btnAdv.id = "btn-advance-tier";
    if (!nextId) {
      btnAdv.disabled = true;
      btnAdv.textContent = isSorcererLineTier(character.tier)
        ? normalizedTierId(character.tier) === "sorcerer_god"
          ? "Already at top Sorcerer tier"
          : "No scripted next tier"
        : character.tier === "god"
          ? "Already at God tier"
          : "No further tier";
    } else {
      btnAdv.textContent = `Advance to ${nextMeta?.name || nextId}`;
    }
    btnAdv.addEventListener("click", () => {
      if (!nextId || !adv) return;
      const msg = buildAdvanceConfirmMessage(adv, nextMeta?.name || nextId);
      if (!confirm(msg)) return;
      const res = applyTierAdvancementFromBundle();
      if (!res) return;
      updateHeaderTierDisplay();
      stepIndex = firstNewWizardStepIndex(res.oldTier, res.newTier);
      reviewViewMode = "sheet";
      render();
      scrollWizardStepIntoView();
    });
    applyHint(btnAdv, "tier-advance");
    advRow.appendChild(btnAdv);
    wrap.appendChild(advRow);
  }

  root.appendChild(panel("Review / Export", wrap));
}

function buildExportObject() {
  ensureFinishingShape();
  if (isDragonHeirChargen(character)) {
    ensureDragonShape(character, bundle);
    const snap = buildDragonReviewSnapshot(character, bundle);
    const tierMeta = bundle.tier?.[character.tier];
    return {
      tier: character.tier,
      tierId: character.tier,
      tierName: tierMeta?.name || character.tier,
      tierAlsoKnownAs: tierMeta?.alsoKnownAs || "",
      characterName: character.characterName ?? "",
      concept: character.concept,
      deeds: character.deeds,
      notes: character.notes ?? "",
      legendRating: character.legendRating ?? 0,
      legendDotMax: legendDotMaxForTier(character.tier),
      legendPoolDotSpentSlots: padPoolSlotArray(
        character.legendPoolDotSpentSlots || [],
        Math.max(LEGEND_SHEET_DOT_COUNT, legendDotMaxForTier(character.tier)),
      ),
      awarenessRating: clampAwarenessRating(character.awarenessRating ?? 1),
      awarenessDotMax: isMythosPantheonSelected() ? awarenessDotMaxForTier(character.tier) : 1,
      awarenessPoolDotSpentSlots: padPoolSlotArray(
        character.awarenessPoolDotSpentSlots || [],
        isMythosPantheonSelected() ? awarenessDotMaxForTier(character.tier) : 1,
      ),
      ...snap,
    };
  }
  const p = selectedPantheon();
  const deity = patronListForPantheon(p).find((d) => d.id === character.parentDeityId);
  const baseAttrs = { ...character.attributes };
  for (const id of Object.keys(bundle.attributes)) {
    if (baseAttrs[id] == null) baseAttrs[id] = 1;
  }
  const finalAttrs = applyFavoredApproach(baseAttrs);
  const tierMeta = bundle.tier?.[character.tier];
  const heroSeven = getTierAdvancementRule("mortal")?.heroBirthrightDotTotal ?? 7;
  const tnEx = normalizedTierId(character.tier);
  const heroUnused =
    tnEx === "hero" || tnEx === "titanic" || tnEx === "sorcerer_hero"
      ? Math.max(0, heroSeven - finishingBirthrightPointsUsed())
      : null;
  return {
    tier: character.tier,
    tierId: character.tier,
    tierName: tierMeta?.name || character.tier,
    tierAlsoKnownAs: tierMeta?.alsoKnownAs || "",
    legendRating: character.legendRating ?? 0,
    legendDotMax: legendDotMaxForTier(character.tier),
    legendPoolDotSpentSlots: padPoolSlotArray(
      character.legendPoolDotSpentSlots || [],
      Math.max(LEGEND_SHEET_DOT_COUNT, legendDotMaxForTier(character.tier)),
    ),
    awarenessRating: clampAwarenessRating(character.awarenessRating ?? 1),
    awarenessDotMax: isMythosPantheonSelected() ? awarenessDotMaxForTier(character.tier) : 1,
    awarenessPoolDotSpentSlots: padPoolSlotArray(
      character.awarenessPoolDotSpentSlots || [],
      isMythosPantheonSelected() ? awarenessDotMaxForTier(character.tier) : 1,
    ),
    tierAdvancementLog: [...(character.tierAdvancementLog || [])],
    characterName: character.characterName ?? "",
    concept: character.concept,
    deeds: { ...character.deeds, mythos: isMythosPantheonSelected() ? String(character.deeds?.mythos ?? "").trim() : "" },
    paths: character.paths,
    pantheon: p?.name || "",
    pantheonId: character.pantheonId || "",
    parentDeity: deity?.name || "",
    parentDeityId: character.parentDeityId || "",
    patronKind: patronKindIsTitan() ? "titan" : "deity",
    virtueSpectrum: Math.max(0, Math.min(5, Math.round(Number(character.virtueSpectrum) || 0))),
    pathPriority: character.pathRank,
    pathSkills: character.pathSkills,
    ...(sumPathSkillRedistribution(character.pathSkillRedistribution) > 0
      ? { pathSkillRedistribution: { ...character.pathSkillRedistribution } }
      : {}),
    skills: character.skillDots,
    skillSpecialties: { ...character.skillSpecialties },
    attributesBeforeFavored: baseAttrs,
    attributesAfterFavored: finalAttrs,
    /** Origin Storypath: highest of Stamina, Resolve, Composure after Favored Approach. */
    defense: originDefenseFromFinalAttrs(finalAttrs),
    /** Total dice when rolling Athletics + higher of Might or Dexterity (skill + attr dots after Favored Approach). */
    movementDice: originMovementPoolDice(
      finalAttrs,
      Math.max(0, Math.min(5, Math.round(Number(character.skillDots?.athletics) || 0))),
    ),
    favoredApproach: character.favoredApproach,
    arenaPriority: character.arenaRank,
    calling: bundle.callings[character.callingId]?.name || "",
    callingId: character.callingId || "",
    callingDots: isOriginPlayTier(character.tier)
      ? 1
      : Math.max(1, Math.min(5, Math.round(Number(character.callingDots) || 1))),
    ...(heroUsesCallingSlots() && Array.isArray(character.callingSlots)
      ? {
          callingSlots: character.callingSlots.map((s) => ({
            id: String(s.id || "").trim(),
            dots: Math.max(1, Math.min(5, Math.round(Number(s.dots) || 1))),
          })),
          knackSlotById: { ...(character.knackSlotById && typeof character.knackSlotById === "object" ? character.knackSlotById : {}) },
        }
      : {}),
    knackIds: [...character.knackIds],
    knacks: character.knackIds.map((id) => bundle.knacks[id]?.name || id),
    finishingKnacks: (character.finishing.finishingKnackIds || []).map((id) => bundle.knacks[id]?.name || id),
    purviews: mergedPurviewIdsForSheet({
      purviews: character.purviewIds,
      patronPurviewSlots: character.patronPurviewSlots,
    }),
    patronPurviewSlots: [...(character.patronPurviewSlots || [])],
    boons: (character.boonIds || []).filter((id) => {
      const bb = bundle.boons?.[id];
      return !bb || !boonIsPurviewInnateAutomaticGrant(bb, bundle);
    }),
    finishing: {
      ...character.finishing,
      finishingKnacksNamed: (character.finishing.finishingKnackIds || []).map((id) => bundle.knacks[id]?.name || id),
      birthrightsNamed: (character.finishing.birthrightPicks || []).map((id) => bundle.birthrights[id]?.name || id),
    },
    notes: character.notes,
    sheetDescription: character.sheetDescription ?? "",
    sheetEquipmentIds: [...(character.sheetEquipmentIds || [])],
    sheetEquipment: (character.sheetEquipmentIds || [])
      .map((eid) => {
        const eq = bundle.equipment?.[eid];
        if (!eq || String(eid).startsWith("_")) return null;
        const tagIds = Array.isArray(eq.tagIds) ? eq.tagIds : [];
        const tagNames = tagIds.map((tid) => bundle.tags?.[tid]?.name || tid).filter(Boolean);
        return {
          id: eid,
          name: eq.name || eid,
          equipmentType: eq.equipmentType || "",
          tagNames,
          description: eq.description || "",
          mechanicalEffects: eq.mechanicalEffects || "",
          source: eq.source || "",
        };
      })
      .filter(Boolean),
    fatebindings: character.fatebindings ?? "",
    sheetNotesExtra: character.sheetNotesExtra ?? "",
    /** Hero: seven Birthright points total minus points already in picks (Birthrights step; Visitation, Hero p. 172). */
    heroBirthrightDotsUnusedFromSeven: heroUnused,
    sorceryProfile: (ensureSorceryProfileShape(), { ...character.sorceryProfile }),
    titanicProfile: (ensureTitanicProfileShape(), { ...character.titanicProfile }),
    mythosInnatePower: (ensureMythosInnatePowerShape(), { ...character.mythosInnatePower }),
  };
}

/**
 * Deserialize an export payload (`buildExportObject()`) into a fresh wizard character object.
 * Resolves deity/calling by name when ids are missing (older exports).
 * @param {Record<string, unknown>} data
 */
function importCharacterFromExportPayload(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid export: expected a JSON object");
  if (!bundle) throw new Error("Game data not loaded");

  const base = defaultCharacter();
  let tier = normalizedTierId(String(data.tier ?? data.tierId ?? base.tier));
  if (!bundle.tier?.[tier]) tier = "mortal";

  let pantheonId =
    typeof data.pantheonId === "string" && data.pantheonId.trim() ? data.pantheonId.trim() : base.pantheonId;
  if (pantheonId && !bundle.pantheons?.[pantheonId]) pantheonId = "";

  let patronKind = typeof data.patronKind === "string" && data.patronKind.trim() === "titan" ? "titan" : "deity";

  let parentDeityId = typeof data.parentDeityId === "string" && data.parentDeityId.trim() ? data.parentDeityId.trim() : "";
  if (!parentDeityId && data.parentDeity && pantheonId && bundle.pantheons?.[pantheonId]) {
    const label = String(data.parentDeity).trim();
    const pant = bundle.pantheons[pantheonId];
    const list =
      patronKind === "titan"
        ? Array.isArray(pant.titans)
          ? pant.titans
          : []
        : Array.isArray(pant.deities)
          ? pant.deities
          : [];
    const dMatch = list.find((d) => d.id === label || d.name === label);
    if (dMatch) parentDeityId = dMatch.id;
  }
  if (pantheonId && parentDeityId) {
    const pant = bundle.pantheons[pantheonId];
    const list =
      patronKind === "titan"
        ? Array.isArray(pant?.titans)
          ? pant.titans
          : []
        : Array.isArray(pant?.deities)
          ? pant.deities
          : [];
    const ok = list.some((d) => d.id === parentDeityId);
    if (!ok) parentDeityId = "";
  }

  let callingId = typeof data.callingId === "string" && data.callingId.trim() ? data.callingId.trim() : "";
  if (!callingId && data.calling && bundle.callings) {
    const lab = String(data.calling).trim();
    const found = Object.entries(bundle.callings).find(
      ([id, c]) => !id.startsWith("_") && (c?.name === lab || id === lab),
    );
    if (found) callingId = found[0];
  }
  if (callingId && (!bundle.callings?.[callingId] || String(callingId).startsWith("_"))) callingId = "";

  const pr = data.pathPriority && typeof data.pathPriority === "object" ? data.pathPriority : data.pathRank;
  const normPath = (v, fb) => {
    const s = String(v ?? "")
      .trim()
      .toLowerCase();
    return PATH_KEYS.includes(s) ? s : fb;
  };
  let pathRank = {
    primary: normPath(pr?.primary, base.pathRank.primary),
    secondary: normPath(pr?.secondary, base.pathRank.secondary),
    tertiary: normPath(pr?.tertiary, base.pathRank.tertiary),
  };
  if (new Set([pathRank.primary, pathRank.secondary, pathRank.tertiary]).size !== 3) {
    pathRank = { ...base.pathRank };
  }

  const pathSkills = { origin: [], role: [], society: [] };
  const psk = data.pathSkills && typeof data.pathSkills === "object" ? data.pathSkills : {};
  const validSkill = new Set(skillIds());
  for (const pk of ["origin", "role", "society"]) {
    const arr = Array.isArray(psk[pk]) ? psk[pk] : [];
    pathSkills[pk] = arr.filter((id) => typeof id === "string" && validSkill.has(id));
  }

  const skillDots = { ...base.skillDots };
  const sk = data.skills && typeof data.skills === "object" ? data.skills : {};
  for (const sid of skillIds()) {
    const v = sk[sid];
    if (v == null || Number.isNaN(Number(v))) continue;
    skillDots[sid] = Math.max(0, Math.min(5, Math.round(Number(v))));
  }

  const pathSkillRedistribution = {};
  const psr = data.pathSkillRedistribution;
  if (psr && typeof psr === "object") {
    for (const [k, v] of Object.entries(psr)) {
      if (!validSkill.has(k)) continue;
      const n = Math.round(Number(v));
      if (Number.isFinite(n) && n > 0) pathSkillRedistribution[k] = n;
    }
  }

  const attrs = { ...base.attributes };
  const srcAttrs =
    data.attributesBeforeFavored && typeof data.attributesBeforeFavored === "object"
      ? data.attributesBeforeFavored
      : data.attributesAfterFavored && typeof data.attributesAfterFavored === "object"
        ? data.attributesAfterFavored
        : data.attributes && typeof data.attributes === "object"
          ? data.attributes
          : null;
  if (srcAttrs) {
    for (const aid of Object.keys(bundle.attributes || {})) {
      if (aid.startsWith("_")) continue;
      const v = srcAttrs[aid];
      if (v == null || Number.isNaN(Number(v))) continue;
      attrs[aid] = Math.max(1, Math.min(5, Math.round(Number(v))));
    }
  }
  for (const aid of Object.keys(bundle.attributes || {})) {
    if (aid.startsWith("_")) continue;
    if (attrs[aid] == null || Number.isNaN(Number(attrs[aid]))) attrs[aid] = 1;
    else attrs[aid] = Math.max(1, Math.min(5, Math.round(Number(attrs[aid]))));
  }

  const deeds = {
    short: typeof data.deeds?.short === "string" ? data.deeds.short : base.deeds.short,
    long: typeof data.deeds?.long === "string" ? data.deeds.long : base.deeds.long,
    band: typeof data.deeds?.band === "string" ? data.deeds.band : base.deeds.band,
    mythos: typeof data.deeds?.mythos === "string" ? data.deeds.mythos : base.deeds.mythos,
  };

  const paths = {
    origin: typeof data.paths?.origin === "string" ? data.paths.origin : base.paths.origin,
    role: typeof data.paths?.role === "string" ? data.paths.role : base.paths.role,
    society: typeof data.paths?.society === "string" ? data.paths.society : base.paths.society,
  };

  const normArena = (s) => {
    const t = String(s ?? "").trim();
    return ARENA_ORDER.find((a) => a.toLowerCase() === t.toLowerCase()) || null;
  };
  const rawArena =
    Array.isArray(data.arenaPriority) && data.arenaPriority.length === 3
      ? data.arenaPriority
      : Array.isArray(data.arenaRank) && data.arenaRank.length === 3
        ? data.arenaRank
        : null;
  let arenaRank = rawArena ? rawArena.map(normArena) : [...base.arenaRank];
  if (arenaRank.length !== 3 || arenaRank.some((a) => !a) || new Set(arenaRank).size !== 3) {
    arenaRank = [...base.arenaRank];
  }

  const favOpts = new Set(["Force", "Finesse", "Resilience"]);
  let favoredApproach =
    typeof data.favoredApproach === "string" && data.favoredApproach ? String(data.favoredApproach).trim() : base.favoredApproach;
  if (!favOpts.has(favoredApproach)) favoredApproach = base.favoredApproach;

  const validPurview = new Set(Object.keys(bundle.purviews || {}).filter((k) => !k.startsWith("_")));
  let purviewIds = mergedPurviewIdsForSheet(data).filter((id) => validPurview.has(id));

  const rawSlots = Array.isArray(data.patronPurviewSlots) ? data.patronPurviewSlots.filter((x) => typeof x === "string") : [];
  const patronPurviewSlots = Array(PATRON_PURVIEW_SLOT_COUNT)
    .fill("")
    .map((_, i) => (rawSlots[i] && validPurview.has(rawSlots[i]) ? rawSlots[i] : ""));

  const validBoon = new Set(Object.keys(bundle.boons || {}).filter((k) => !k.startsWith("_")));
  const validKnack = new Set(Object.keys(bundle.knacks || {}).filter((k) => !k.startsWith("_")));
  const validBirthright = new Set(Object.keys(bundle.birthrights || {}).filter((k) => !k.startsWith("_")));
  let boonIds = Array.isArray(data.boons)
    ? data.boons.filter((x) => typeof x === "string" && !x.startsWith("_") && validBoon.has(x))
    : [];
  boonIds = boonIds.filter((id) => {
    const bb = bundle.boons?.[id];
    return !bb || !boonIsPurviewInnateAutomaticGrant(bb, bundle);
  });
  if (boonIds.length > MAX_WIZARD_BOON_PICKS) boonIds = boonIds.slice(0, MAX_WIZARD_BOON_PICKS);
  let knackIds = Array.isArray(data.knackIds)
    ? data.knackIds.filter((x) => typeof x === "string" && !x.startsWith("_") && validKnack.has(x))
    : [];

  const legendRating = Math.max(0, Math.round(Number(data.legendRating) || 0));

  let awarenessRating = 1;
  if (pantheonId === "mythos") {
    const ar = data.awarenessRating;
    if (ar != null && !Number.isNaN(Number(ar))) awarenessRating = Math.round(Number(ar));
    const awCap = awarenessDotMaxForTier(tier);
    awarenessRating = Math.max(1, Math.min(awCap, awarenessRating));
  }

  const finBase = { ...base.finishing };
  if (data.finishing && typeof data.finishing === "object") {
    const f = { ...data.finishing };
    delete f.finishingKnacksNamed;
    delete f.birthrightsNamed;
    Object.assign(finBase, f);
  }
  if (!Array.isArray(finBase.finishingKnackIds)) finBase.finishingKnackIds = [];
  if (!Array.isArray(finBase.birthrightPicks)) finBase.birthrightPicks = [];
  let callingDots =
    data.callingDots != null && !Number.isNaN(Number(data.callingDots)) ? Math.round(Number(data.callingDots)) : base.callingDots;
  if (isOriginPlayTier(tier)) callingDots = 1;
  else callingDots = Math.max(1, Math.min(5, callingDots));
  let callingSlots = null;
  const tierNormImp = normalizedTierId(tier);
  if (
    (tierNormImp === "hero" || tierNormImp === "titanic" || tierNormImp === "sorcerer_hero") &&
    Array.isArray(data.callingSlots) &&
    data.callingSlots.length >= 3
  ) {
    callingSlots = data.callingSlots.slice(0, 3).map((x) =>
      x && typeof x === "object"
        ? {
            id: typeof x.id === "string" ? x.id.trim() : "",
            dots: Math.max(1, Math.min(5, Math.round(Number(x.dots) || 1))),
          }
        : { id: "", dots: 1 },
    );
    callingDots = Math.max(1, Math.min(5, callingSlots.reduce((a, s) => a + s.dots, 0)));
  }
  const knackImportCtx = {
    tier,
    callingId,
    pantheonId,
    parentDeityId,
    patronKind,
    purviewIds,
    legendRating,
    awarenessRating,
    callingDots,
    callingSlots: callingSlots || undefined,
  };
  knackIds = knackIds.filter((id) => {
    const kn = bundle.knacks[id];
    return !!kn && knackEligible(kn, knackImportCtx, bundle);
  });
  knackIds = pruneKnackIdsToCallingSlotCap(knackIds, knackImportCtx, bundle);
  /** Hero: optional row index per Knack id from export; normalized again in `syncHeroKnackSlotAssignments`. */
  const knackSlotById = {};
  if (callingSlots && data.knackSlotById && typeof data.knackSlotById === "object") {
    for (const [knid, rv] of Object.entries(data.knackSlotById)) {
      if (!validKnack.has(knid) || !knackIds.includes(knid)) continue;
      const r = Math.round(Number(rv));
      if (Number.isFinite(r) && r >= 0 && r < 3) knackSlotById[knid] = r;
    }
  }
  finBase.finishingKnackIds = finBase.finishingKnackIds.filter((id) => {
    const kn = bundle.knacks[id];
    return typeof id === "string" && !!kn && knackEligible(kn, knackImportCtx, bundle);
  });
  finBase.birthrightPicks = finBase.birthrightPicks.filter((id) => typeof id === "string" && validBirthright.has(id));

  const validEquipment = new Set(Object.keys(bundle.equipment || {}).filter((k) => !k.startsWith("_")));
  let sheetEquipmentIds = Array.isArray(data.sheetEquipmentIds)
    ? data.sheetEquipmentIds.filter((x) => typeof x === "string" && x.trim())
    : [];
  sheetEquipmentIds = sheetEquipmentIds.map((id) => id.trim()).filter((id) => validEquipment.has(id));
  const virtueSpectrum = Math.max(0, Math.min(5, Math.round(Number(data.virtueSpectrum) || 0)));
  const log = Array.isArray(data.tierAdvancementLog)
    ? data.tierAdvancementLog.filter((e) => e && typeof e === "object")
    : [];

  const skillIdSet = new Set(skillIds());
  const rawSpec = data.skillSpecialties && typeof data.skillSpecialties === "object" ? { ...data.skillSpecialties } : {};
  const spec = {};
  for (const [k, v] of Object.entries(rawSpec)) {
    if (!skillIdSet.has(k) || typeof v !== "string") continue;
    const t = v.trim();
    if (t) spec[k] = v;
  }

  const sorceryProfile = { ...base.sorceryProfile };
  if (data.sorceryProfile && typeof data.sorceryProfile === "object") {
    for (const k of Object.keys(sorceryProfile)) {
      const v = data.sorceryProfile[k];
      if (k === "workingIds" && Array.isArray(v)) {
        sorceryProfile.workingIds = v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
      } else if (typeof v === "string") sorceryProfile[k] = v;
    }
  }
  const titanicProfile = { ...base.titanicProfile };
  if (data.titanicProfile && typeof data.titanicProfile === "object") {
    for (const k of Object.keys(titanicProfile)) {
      const v = data.titanicProfile[k];
      if (k === "mutationDots" && v != null && !Number.isNaN(Number(v))) {
        titanicProfile[k] = Math.max(0, Math.min(5, Math.round(Number(v))));
      } else if (typeof v === "string") titanicProfile[k] = v;
    }
  }
  {
    const mcid = String(titanicProfile.mutationCallingId || "").trim();
    if (mcid && !TITANIC_CALLING_IDS_SM_KNACKS.has(mcid)) titanicProfile.mutationCallingId = "";
  }

  const mythosInnatePower = { ...base.mythosInnatePower };
  if (pantheonId === "mythos" && data.mythosInnatePower && typeof data.mythosInnatePower === "object") {
    const src = data.mythosInnatePower;
    const st = String(src.style || "").trim();
    if (st === "standard" || st === "awareness") mythosInnatePower.style = st;
    const ap = String(src.awarenessPurviewId || "").trim();
    if (ap) mythosInnatePower.awarenessPurviewId = ap;
    if (src.awarenessLocked === true) mythosInnatePower.awarenessLocked = true;
  }

  const chargenLineage = String(data.chargenLineage ?? "scion").trim() === "dragonHeir" ? "dragonHeir" : "scion";

  const legNImp = Math.max(LEGEND_SHEET_DOT_COUNT, legendDotMaxForTier(tier));
  let legendPoolDotSpentSlots = padPoolSlotArray([], legNImp);
  if (Array.isArray(data.legendPoolDotSpentSlots) && data.legendPoolDotSpentSlots.length) {
    legendPoolDotSpentSlots = padPoolSlotArray(data.legendPoolDotSpentSlots.map((x) => !!x), legNImp);
  } else if (data.legendPoolDotSpent === true) {
    legendPoolDotSpentSlots = Array(legNImp).fill(false);
    legendPoolDotSpentSlots[0] = true;
  }
  const awNImp = pantheonId === "mythos" ? awarenessDotMaxForTier(tier) : 1;
  let awarenessPoolDotSpentSlots = padPoolSlotArray([], awNImp);
  if (Array.isArray(data.awarenessPoolDotSpentSlots) && data.awarenessPoolDotSpentSlots.length) {
    awarenessPoolDotSpentSlots = padPoolSlotArray(data.awarenessPoolDotSpentSlots.map((x) => !!x), awNImp);
  } else if (data.awarenessPoolDotSpent === true) {
    awarenessPoolDotSpentSlots = Array(awNImp).fill(false);
    awarenessPoolDotSpentSlots[0] = true;
  }

  return {
    ...base,
    tier,
    patronKind,
    chargenLineage,
    characterName: typeof data.characterName === "string" ? data.characterName : "",
    concept: typeof data.concept === "string" ? data.concept : "",
    deeds,
    paths,
    pantheonId,
    virtueSpectrum,
    parentDeityId,
    pathRank,
    pathSkills,
    pathSkillRedistribution,
    pathSkillRedistSourceHash: null,
    skillDots,
    skillSpecialties: spec,
    attributes: attrs,
    favoredApproach: favoredApproach,
    arenaRank,
    callingId,
    callingDots,
    callingSlots,
    knackIds,
    knackSlotById: callingSlots ? knackSlotById : {},
    purviewIds,
    patronPurviewSlots,
    boonIds,
    birthrightIds: Array.isArray(data.birthrightIds)
      ? data.birthrightIds.filter((x) => typeof x === "string" && validBirthright.has(x))
      : [...base.birthrightIds],
    legendRating,
    awarenessRating,
    tierAdvancementLog: log,
    finishing: finBase,
    notes: typeof data.notes === "string" ? data.notes : "",
    sheetDescription: typeof data.sheetDescription === "string" ? data.sheetDescription : "",
    sheetEquipmentIds,
    fatebindings: typeof data.fatebindings === "string" ? data.fatebindings : "",
    sheetNotesExtra: typeof data.sheetNotesExtra === "string" ? data.sheetNotesExtra : "",
    sorceryProfile,
    titanicProfile,
    mythosInnatePower,
    legendPoolDotSpentSlots,
    awarenessPoolDotSpentSlots,
    ...(chargenLineage === "dragonHeir" && data.dragon && typeof data.dragon === "object"
      ? {
          dragon: (() => {
            try {
              return JSON.parse(JSON.stringify(data.dragon));
            } catch {
              return { ...data.dragon };
            }
          })(),
        }
      : {}),
  };
}

/** Drop Knack picks that fail Calling / tier / pantheon gates (e.g. Immortal knacks after returning to Origin). */
function pruneStaleKnackIds() {
  if (!bundle?.knacks) return;
  character.knackIds = (character.knackIds || []).filter((id) => {
    const k = bundle.knacks[id];
    return !!(k && knackEligible(k, character, bundle));
  });
  character.knackIds = pruneKnackIdsToCallingSlotCap(character.knackIds, character, bundle);
  syncHeroKnackSlotAssignments(character, bundle);
  if (character.finishing?.finishingKnackIds) {
    character.finishing.finishingKnackIds = character.finishing.finishingKnackIds.filter((id) => {
      const k = bundle.knacks[id];
      return !!(k && knackFinishingPickIsValidHeld(k, character, bundle));
    });
  }
  const mainKnackIds = new Set(character.knackIds || []);
  if (character.finishing?.finishingKnackIds?.length && mainKnackIds.size) {
    character.finishing.finishingKnackIds = character.finishing.finishingKnackIds.filter((id) => !mainKnackIds.has(id));
  }
}

/** After replacing `character` (import) or on first load: clamp, hydrate paths/purviews, prune invalid ids. */
function normalizeCharacterStateAfterLoad() {
  const lineageRaw = String(character.chargenLineage ?? "scion").trim();
  character.chargenLineage = lineageRaw === "dragonHeir" ? "dragonHeir" : "scion";
  if (character.chargenLineage === "dragonHeir") {
    ensureDragonShape(character, bundle);
    character.tier = "mortal";
    return;
  }
  if (!character.deeds || typeof character.deeds !== "object") {
    character.deeds = { short: "", long: "", band: "", mythos: "" };
  } else {
    if (typeof character.deeds.short !== "string") character.deeds.short = "";
    if (typeof character.deeds.long !== "string") character.deeds.long = "";
    if (typeof character.deeds.band !== "string") character.deeds.band = "";
    if (typeof character.deeds.mythos !== "string") character.deeds.mythos = "";
  }
  ensureLegendAwarenessPoolSlotArrays();
  if (character.legendRating == null || Number.isNaN(Number(character.legendRating))) character.legendRating = 0;
  if (character.virtueSpectrum == null || Number.isNaN(Number(character.virtueSpectrum))) character.virtueSpectrum = 0;
  if (isOriginPlayTier(character.tier)) {
    character.callingDots = 1;
    character.callingSlots = null;
    character.knackSlotById = {};
  } else if (!heroUsesCallingSlots()) {
    if (character.callingDots == null || Number.isNaN(Number(character.callingDots))) character.callingDots = 1;
    character.callingDots = Math.max(1, Math.min(5, Math.round(Number(character.callingDots) || 1)));
    character.callingSlots = null;
    character.knackSlotById = {};
  } else if (character.callingDots == null || Number.isNaN(Number(character.callingDots))) {
    character.callingDots = 1;
  }
  syncLegendToTier();
  character.patronKind = String(character.patronKind ?? "deity").trim().toLowerCase() === "titan" ? "titan" : "deity";
  const pantNorm = bundle?.pantheons?.[character.pantheonId];
  if (pantNorm && character.parentDeityId) {
    const okPat = patronListForPantheon(pantNorm).some((d) => d && d.id === character.parentDeityId);
    if (!okPat) character.parentDeityId = "";
  }
  syncAwarenessWithPantheon();
  if (!Array.isArray(character.tierAdvancementLog)) character.tierAdvancementLog = [];
  ensureSkillDots();
  ensurePathSkillArrays();
  syncCallingToParentDeity();
  if (heroUsesCallingSlots()) {
    ensureCallingSlotsForHero();
    if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  } else character.callingSlots = null;
  ensureFinishingShape();
  ensureSheetAppendicesShape();
  ensureSorceryProfileShape();
  ensureTitanicProfileShape();
  ensureMythosInnatePowerShape();
  if (!isMythosPantheonSelected()) {
    character.mythosInnatePower = defaultMythosInnatePower();
  } else {
    const m = character.mythosInnatePower;
    const validAw = new Set(mythosAwarenessInnatePurviewIds());
    if (m.awarenessPurviewId && !validAw.has(m.awarenessPurviewId)) m.awarenessPurviewId = "";
    if (m.style === "awareness" && m.awarenessPurviewId) m.awarenessLocked = true;
    if (m.style === "awareness" && !m.awarenessPurviewId) {
      m.style = "standard";
      m.awarenessLocked = false;
    }
  }
  clearPurviewsAndBoonsIfInapplicableTier();
  ensurePatronPurviewSlots();
  const hadAnySlot = character.patronPurviewSlots.some(Boolean);
  if (!hadAnySlot) hydratePatronPurviewSlotsFromPurviewIds();
  else {
    const allowed = new Set(patronPurviewOptionIds());
    if (allowed.size > 0) {
      character.patronPurviewSlots = character.patronPurviewSlots.map((s) => (allowed.has(s) ? s : ""));
    }
  }
  syncPurviewIdsFromPatronSlots();
  migrateAesirLegacyFortuneSignatureToWyrd();
  migrateLegacyPantheonSignaturePurviewIds();
  pruneStaleKnackIds();
  if (tierHasPurviewStep(character.tier)) restrictHeroPurviewsToPatronList();
  trimBirthrightPicksToBudget();
  pruneStaleBoonIds();
  if (character.chargenLineage !== "dragonHeir") {
    ensurePathSkillArrays();
    inferPathSkillOverflowFromImportedDotsOnce();
    applyPathMathToSkillDots();
  }
  if (isOriginPlayTier(character.tier)) {
    normalizeCharacterAttributesToPools();
  }
}

function persistPathsPhrasesFromDom() {
  character.paths.origin = document.getElementById("p-origin")?.value || "";
  character.paths.role = document.getElementById("p-role")?.value || "";
  const socVal = document.getElementById("p-soc")?.value || "";
  character.paths.society = socVal;
  if (isDragonHeirChargen(character)) {
    ensureDragonShape(character, bundle);
    character.dragon.paths.flight = socVal;
  }
  const mythTa = document.getElementById("p-mythos-deed");
  const mythWrap = document.getElementById("p-mythos-deed-wrap");
  if (mythTa && mythWrap && !mythWrap.hidden && character.deeds) {
    character.deeds.mythos = mythTa.value || "";
  } else if (character.deeds && !pathsStepShowsMythosDeedFields()) {
    character.deeds.mythos = "";
  }
}

/** Paths step: phrases, pantheon, divine parent, patron Purview slots → `character` + merged `purviewIds`. */
function persistPathsStepFromDom() {
  persistPathsPhrasesFromDom();
  if (isDragonHeirChargen(character)) {
    persistDragonFromDom(character, bundle);
    return;
  }
  if (sorcererPathsHidePatronStack(character.tier)) {
    return;
  }
  character.pantheonId = document.getElementById("p-pantheon")?.value || "";
  const pk = document.getElementById("p-patron-kind")?.value;
  character.patronKind = pk === "titan" ? "titan" : "deity";
  character.parentDeityId = document.getElementById("p-deity")?.value || "";
  syncAwarenessWithPantheon();
  ensurePatronPurviewSlots();
  const lim = patronPurviewSlotLimitForCharacter();
  for (let i = 0; i < PATRON_PURVIEW_SLOT_COUNT; i += 1) {
    const sel = document.getElementById(`p-patron-pv-${i}`);
    if (sel) character.patronPurviewSlots[i] = sel.value || "";
    else if (i >= lim) character.patronPurviewSlots[i] = "";
  }
  syncPurviewIdsFromPatronSlots();
  syncCallingToParentDeity();
}

function persistSkillSpecialtiesFromForm() {
  for (const sid of skillIds()) {
    if ((character.skillDots[sid] || 0) < 3) {
      delete character.skillSpecialties[sid];
      continue;
    }
    const inp = document.getElementById(`specialty-${sid}`);
    if (!inp) continue;
    const t = inp.value.trim();
    if (t) character.skillSpecialties[sid] = inp.value;
    else delete character.skillSpecialties[sid];
  }
}

function persistFromForm() {
  if (isDragonHeirChargen(character)) {
    ensureDragonShape(character, bundle);
    const d = character.dragon;
    if (d.pastConcept !== true) {
      const step = stepDefsForTier(character.tier)[stepIndex];
      if (step === "concept") {
        character.characterName = document.getElementById("f-char-name")?.value || "";
        character.concept = document.getElementById("f-concept")?.value || "";
        character.notes = document.getElementById("f-notes")?.value || "";
        character.deeds.short = document.getElementById("f-deed-short")?.value || "";
        character.deeds.long = document.getElementById("f-deed-long")?.value || "";
        character.deeds.band = document.getElementById("f-deed-band")?.value || "";
        character.sheetDescription = document.getElementById("f-sheet-description")?.value || "";
      }
      if (step === "paths") persistPathsPhrasesFromDom();
      persistDragonFromDom(character, bundle);
      return;
    }
    persistDragonFromDom(character, bundle);
    return;
  }
  const step = stepDefsForTier(character.tier)[stepIndex];
  if (step === "concept") {
    character.characterName = document.getElementById("f-char-name")?.value || "";
    character.concept = document.getElementById("f-concept")?.value || "";
    character.notes = document.getElementById("f-notes")?.value || "";
    character.deeds.short = document.getElementById("f-deed-short")?.value || "";
    character.deeds.long = document.getElementById("f-deed-long")?.value || "";
    character.deeds.band = document.getElementById("f-deed-band")?.value || "";
    character.sheetDescription = document.getElementById("f-sheet-description")?.value || "";
  }
  if (step === "paths") persistPathsStepFromDom();
  if (step === "skills") {
    persistSkillSpecialtiesFromForm();
    captureFinishingSkillBaseline();
  }
  if (step === "attributes") {
    captureFinishingAttrBaseline();
  }
  if (step === "finishing") {
    persistSkillSpecialtiesFromForm();
    ensureFinishingShape();
    ensureSheetAppendicesShape();
    character.finishing.extraSkillDots = Number(document.getElementById("fin-skill")?.value || 0);
    character.finishing.extraAttributeDots = Number(document.getElementById("fin-attr")?.value || 0);
    character.finishing.knackOrBirthright =
      normalizedTierId(character.tier) === "hero" ||
      normalizedTierId(character.tier) === "titanic" ||
      normalizedTierId(character.tier) === "sorcerer_hero"
        ? "knacks"
        : document.getElementById("fin-focus")?.value || "knacks";
    character.fatebindings = document.getElementById("fin-fatebindings")?.value ?? "";
    character.sheetNotesExtra = document.getElementById("fin-sheet-notes")?.value ?? "";
  }
  if (step === "workings") {
    ensureSorceryProfileShape();
    const cap = sorcererWorkingPickCap(character.tier);
    const chosen = [];
    for (const row of sorcererWorkingsCatalogRows()) {
      const id = row.id;
      if (document.getElementById(`f-working-${id}`)?.checked) chosen.push(id);
    }
    character.sorceryProfile.workingIds = chosen.slice(0, cap);
  }
  if (step === "sorcerer") {
    ensureSorceryProfileShape();
    const sp = character.sorceryProfile;
    sp.motif = document.getElementById("f-sorc-motif")?.value ?? "";
    const pr = document.getElementById("f-sorc-primary")?.value ?? "";
    sp.primaryPowerSource = pr === "invocation" || pr === "patronage" || pr === "prohibition" || pr === "talisman" ? pr : "";
    sp.powerSource = document.getElementById("f-sorc-source")?.value ?? "";
    sp.invocation = document.getElementById("f-sorc-invocation")?.value ?? "";
    sp.patronage = document.getElementById("f-sorc-patronage")?.value ?? "";
    sp.prohibition = document.getElementById("f-sorc-prohibition")?.value ?? "";
    sp.talisman = document.getElementById("f-sorc-talisman")?.value ?? "";
    sp.techniquesNotes = document.getElementById("f-sorc-techniques")?.value ?? "";
    sp.notes = document.getElementById("f-sorc-notes")?.value ?? "";
  }
  if (step === "titanicExtras") {
    ensureTitanicProfileShape();
    const tp = character.titanicProfile;
    tp.motif = document.getElementById("f-titan-motif")?.value ?? "";
    tp.mutationCallingId = document.getElementById("f-titan-mutation-calling")?.value ?? "";
    const md = Math.round(Number(document.getElementById("f-titan-mutation-dots")?.value || 0));
    tp.mutationDots = Math.max(0, Math.min(5, Number.isNaN(md) ? 0 : md));
    tp.condition = document.getElementById("f-titan-condition")?.value ?? "";
    tp.suppressEpicenterNotes = document.getElementById("f-titan-suppress")?.value ?? "";
  }
  if (step === "purviews" && isMythosPantheonSelected()) {
    ensureMythosInnatePowerShape();
    const m = character.mythosInnatePower;
    if (!m.awarenessLocked) {
      const selEl = document.getElementById("f-mythos-innate-purview");
      if (selEl) m.awarenessPurviewId = selEl.value || "";
    }
  }
}

function render() {
  const root = document.getElementById("wizard-root");
  if (!root) return;
  try {
  renderAppMainTabs();
  const wnav = document.getElementById("wizard-nav");
  if (appMainTab !== "wizard") {
    if (wnav) {
      wnav.style.display = "none";
      wnav.innerHTML = "";
    }
    root.innerHTML = "<p class=\"help\">Loading library editor…</p>";
    const reloadBundle = async () => {
      const r = await fetchGameBundle();
      bundle = await r.json();
    };
    const ctx = { getBundle: () => bundle, reloadBundle };
    loadEditorsOnce()
      .then((ed) => {
        root.innerHTML = "";
        if (appMainTab === "birthrights_data") ed.mountBirthrightsDataEditor(root, ctx);
        else if (appMainTab === "tags_data") ed.mountTagsDataEditor(root, ctx);
        else if (appMainTab === "equipment_data") ed.mountEquipmentDataEditor(root, ctx);
        updateHeaderTierDisplay();
      })
      .catch((err) => {
        console.error(err);
        root.innerHTML = "";
        const p = document.createElement("p");
        p.className = "warn";
        p.textContent = `Could not load library editors: ${err instanceof Error ? err.message : String(err)}`;
        root.appendChild(p);
        updateHeaderTierDisplay();
      });
    return;
  }
  if (wnav) wnav.style.display = "";

  if (isDragonHeirChargen(character)) {
    if (!bundle?.dragonFlights || typeof bundle.dragonFlights !== "object" || !bundle?.dragonTier) {
      root.innerHTML = "";
      const p = document.createElement("p");
      p.className = "warn";
      p.textContent =
        "Dragon Heir data is missing from the game bundle. Add dragonTier, dragonCallingKnacks, dragonFlights, dragonMagic, and dragonKnacks to data/meta.json, restart the server, and hard-refresh.";
      root.appendChild(p);
      updateHeaderTierDisplay();
      return;
    }
    ensureDragonShape(character, bundle);
    if (character.dragon?.pastConcept !== true && stepIndex > 1) stepIndex = 1;
    if (character.dragon?.pastConcept === true) {
      if (wnav) wnav.style.display = "none";
      root.innerHTML = "";
      renderDragonChargen({
        root,
        character,
        bundle,
        render,
        scrollStepIntoView: scrollWizardStepIntoView,
        onBackToHeirConcept: () => {
          persistDragonFromDom(character, bundle);
          character.dragon.pastConcept = false;
          stepIndex = 1;
          render();
          scrollWizardStepIntoView();
        },
      });
      updateHeaderTierDisplay();
      return;
    }
  }

  if (!bundle?.tier || typeof bundle.tier !== "object") {
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "warn";
    p.textContent =
      "Game bundle has no tier data yet. Confirm the app is served by this project’s FastAPI server (so GET /api/bundle works) and that data/tier.json is listed in data/meta.json gameDataFiles.";
    root.appendChild(p);
    updateHeaderTierDisplay();
    return;
  }

  syncLegendToTier();
  syncAwarenessWithPantheon();
  ensureSheetAppendicesShape();
  if (character.virtueSpectrum == null || Number.isNaN(Number(character.virtueSpectrum))) character.virtueSpectrum = 0;
  if (isOriginPlayTier(character.tier)) {
    character.callingDots = 1;
    character.callingSlots = null;
  } else if (heroUsesCallingSlots()) {
    ensureCallingSlotsForHero();
  } else {
    character.callingSlots = null;
    if (character.callingDots == null || Number.isNaN(Number(character.callingDots))) character.callingDots = 1;
    character.callingDots = Math.max(1, Math.min(5, Math.round(Number(character.callingDots) || 1)));
  }
  clearPurviewsAndBoonsIfInapplicableTier();
  if (tierHasPurviewStep(character.tier)) restrictHeroPurviewsToPatronList();
  trimBirthrightPicksToBudget();
  pruneStaleBoonIds();
  const stepsPre = stepDefsForTier(character.tier);
  if (stepIndex >= stepsPre.length) stepIndex = Math.max(0, stepsPre.length - 1);
  /* Only persist Paths from the DOM when the Paths form is actually mounted (nav can change stepIndex before DOM is rebuilt). */
  if (stepsPre[stepIndex] === "paths" && document.getElementById("p-origin")) persistPathsStepFromDom();
  root.innerHTML = "";
  renderNav();
  const steps = stepDefsForTier(character.tier);
  const step = steps[stepIndex] || "welcome";
  if (step === "calling" || step === "finishing") pruneStaleKnackIds();
  if (step === "welcome") renderWelcome(root);
  if (step === "concept") renderConcept(root);
  if (step === "paths") renderPaths(root);
  if (step === "skills") renderSkills(root);
  if (step === "attributes") renderAttributes(root);
  if (step === "calling") renderCalling(root);
  if (step === "purviews") renderPurviews(root);
  if (step === "birthrights") renderBirthrights(root);
  if (step === "boons") renderBoons(root);
  if (step === "workings") renderWorkings(root);
  if (step === "sorcerer") renderSorcerer(root);
  if (step === "titanicExtras") renderTitanicExtras(root);
  if (step === "finishing") renderFinishing(root);
  if (step === "review") renderReview(root);

  const actions = document.createElement("div");
  actions.className = "step-actions";
  if (stepIndex > 0) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn secondary";
    back.textContent = "Back";
    back.addEventListener("click", () => {
      persistFromForm();
      stepIndex -= 1;
      render();
      scrollWizardStepIntoView();
    });
    actions.appendChild(back);
  }
  if (stepIndex < steps.length - 1) {
    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn primary";
    next.textContent = "Next";
    next.addEventListener("click", () => {
      if (step === "attributes") {
        normalizeCharacterAttributesToPools();
        const attrMsgs = validateAttributes(buildCharacterAttrsPre());
        if (attrMsgs.length) {
          window.alert(attrMsgs.join("\n"));
          render();
          return;
        }
      }
      persistFromForm();
      /* Use same `step` as this render (stepDefsForTier + stepIndex) so gate matches visible screen. */
      if (step === "skills") {
        applyPathMathToSkillDots();
        const gate = validateAllPathSkillsDetailed();
        if (!gate.ok) {
          skillsGateIssues = gate.issues;
          render();
          return;
        }
        if (pathSkillOverflowDotsPending() > 0) {
          const pend = pathSkillOverflowDotsPending();
          skillsGateIssues = [
            {
              pathKey: null,
              message: `Redistribute Path overflow: ${pend} dot(s) still unplaced (Origin p. 97 — max 5 per Skill from Paths; excess only onto other Path Skills).`,
            },
          ];
          render();
          return;
        }
        skillsGateIssues = [];
      }
      if (step === "purviews") {
        const pvBlock = heroPurviewsPatronPickRequiredAndMissing();
        if (pvBlock) {
          window.alert(pvBlock);
          return;
        }
      }
      if (isDragonHeirChargen(character) && step === "concept") {
        ensureDragonShape(character, bundle);
        character.dragon.pastConcept = true;
        character.dragon.stepIndex = 0;
      }
      stepIndex += 1;
      render();
      scrollWizardStepIntoView();
    });
    if (step === "purviews") {
      const pvBlock = heroPurviewsPatronPickRequiredAndMissing();
      if (pvBlock) {
        next.disabled = true;
        next.title = pvBlock;
      }
    }
    actions.appendChild(next);
  }
  root.appendChild(actions);
  updateHeaderTierDisplay();
  } catch (err) {
    console.error(err);
    root.innerHTML = "";
    const p = document.createElement("p");
    p.className = "warn";
    p.textContent =
      err instanceof Error
        ? `Wizard UI error: ${err.message}`
        : "Wizard UI error — check the browser console.";
    root.appendChild(p);
    updateHeaderTierDisplay();
  }
}

async function init() {
  const embedded = readEmbeddedBundleFromDom();
  if (embedded && typeof embedded === "object" && embedded.tier && typeof embedded.tier === "object") {
    bundle = embedded;
  } else {
    if (typeof window !== "undefined" && window.__SCION_EMBEDDED_BUNDLE) {
      throw new Error(
        "This page was built with an embedded game bundle, but it could not be decoded. Hard-refresh (Ctrl+Shift+R) or restart uvicorn; if it persists, view page source and confirm the hidden textarea is intact.",
      );
    }
    const res = await fetchGameBundle();
    if (!res.ok) {
      throw new Error(`GET /api/bundle failed: ${res.status} ${res.statusText || ""}`.trim());
    }
    const payload = await res.json();
    if (!payload || typeof payload !== "object" || !payload.tier || typeof payload.tier !== "object") {
      throw new Error("GET /api/bundle returned JSON without a tier table — check server data and meta.json gameDataFiles.");
    }
    bundle = payload;
  }
  normalizeCharacterStateAfterLoad();
  updateHeaderTierDisplay();

  const fileImport = document.getElementById("input-import-json");
  document.getElementById("btn-import-json")?.addEventListener("click", () => fileImport?.click());
  fileImport?.addEventListener("change", async () => {
    const file = fileImport.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      character = importCharacterFromExportPayload(parsed);
      stepIndex = 0;
      reviewViewMode = "sheet";
      appMainTab = "wizard";
      skillsGateIssues = [];
      normalizeCharacterStateAfterLoad();
      updateHeaderTierDisplay();
      render();
      scrollWizardStepIntoView();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`Could not import character JSON: ${msg}`);
    } finally {
      fileImport.value = "";
    }
  });

  document.getElementById("btn-export-json")?.addEventListener("click", () => {
    persistFromForm();
    const blob = new Blob([JSON.stringify(buildExportObject(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scion-character.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  render();
}

init().catch((err) => {
  console.error(err);
  const rootEl = document.getElementById("wizard-root");
  const msg = err instanceof Error ? err.message : String(err);
  if (rootEl) {
    rootEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "warn";
    p.textContent = `Failed to load game data: ${msg}`;
    rootEl.appendChild(p);
  }
});
