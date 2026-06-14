import { isEntryVisibleForBooks } from "./bookFilter.js";
import {
  experienceAdvancementTableRows,
  experienceAttributeBumpCount,
  experienceAttributeBumpsTotal,
  experienceCanAfford,
  experiencePointsAvailable,
  experiencePointsSpent,
  experiencePointsTotal,
  experiencePurchaseCost,
  experienceRefund,
  experienceSkillBumpCount,
  experienceSkillBumpsTotal,
  experienceSpend,
  ensureExperienceAdvancementBumps,
  recordExperienceAttributeBump,
  recordExperienceSkillBump,
} from "./experience.js";
import { applyHint, applySkillSpecialtyHints, applyGameDataHint } from "./fieldHelp.js";
import {
  activateExpLevelingSession,
  discardExpLevelingSession,
  expLevelingSessionActive,
  expLevelingSessionDirty,
  RESET_CONFIRM_MESSAGE,
  resetExpLevelingSession,
  resolveLeaveExpLevelingStep,
} from "./expLevelingSession.js";
import {
  buildCharacterSheet,
  buildVirtueSpectrumElement,
  originDefenseFromFinalAttrs,
  originMovementPoolDice,
} from "./characterSheet.js";
import {
  LEGEND_SHEET_DOT_COUNT,
  DRAGON_INHERITANCE_POOL_SHEET_DOT_COUNT,
} from "./characterSheetLegendPools.js";
import {
  knackEligible,
  knackEligibleForCallingStep,
  knackEligibleForFinishingExtraKnack,
  knackFinishingPickIsValidHeld,
  pruneKnackIdsToCallingSlotCap,
  settleUnassignedHeldKnackSlots,
  repairUnmappedHeroKnackSlots,
  pruneOrphanUnmappedKnackPurchases,
  stripRowPaidKnacksFromExperiencePools,
  ensureFinishingBonusKnackIds,
  pinLockedOriginBudgetKnackToPrimaryRow,
  snapshotKnackRowBudgetCostsBeforeTierAdvance,
  snapshotMissingLockedKnackRowBudgetCosts,
  seedHeroKnackRowAssignments,
  knackSelectedOnCallingRow,
  syncHeroKnackSlotAssignments,
  ensureHeroKnackSlotAssignments,
  knackAppliesToCallingsLine,
  heroCallingRowMatchesKnack,
  knackCallingTokensForRowMatch,
  originCallingKnackChipGroupKey,
  countOriginSelectedCallingKnacks,
  knackRuleTier,
  knackTierBadgeClass,
  knackTierBadgeLabel,
  GENERAL_CALLING_LABEL,
  heroUsesCallingSlotRows,
  isHeroBandCallingTierId,
  isPostHeroBandCallingTierId,
  maxWizardBoonPicksForTier,
  immortalKnackCostsTwoCallingSlots,
  boonEligible,
  boonIsPurviewInnateAutomaticGrant,
  boonPrimaryPurview,
  characterPurviewIdSet,
  mythosCallingTwinId,
  isMythosPantheonForCharacter,
  mythosPatronCallingIdForChooser,
  callingIdInWizardLibraryChooser,
  isMythosInvertedTwinCallingId,
  isMythosStandardTwinCallingId,
  motmInvertedKnackSubpoolKey,
  dedupeMotmTwinKnackSubpoolLists,
  splitMotmKnackEntriesBySubpool,
  heroKnackChipBucketKey,
  heroKnackChipPanelBucketKeys,
  motmCallingPairForRow,
  motmKnackSubpoolSectionTitle,
  motmTwinKnackPoolSectionTitle,
  motmTwinKnackPoolSectionHelp,
  motmTwinKnackPoolOrder,
  motmCallingKnackGroupTitle,
  isSorcererLineTierId,
  isGeneralCallingKnack,
  callingRowDotCap,
  callingRowsThatCanPayForKnack,
  callingKnackSlotCap,
  knackIdsCallingSlotsUsed,
  rowKnackPointsUsed,
  knackSlotMapForRowBudgetUi,
  knackPayingCallingRowLabel,
  knackPointCost,
  isKnackLocked,
  lockKnacksAtTierAdvance,
  knackLockedIdSet,
  finishingBonusKnackIdSet,
  carriedExperienceKnackIdSet,
  experienceKnackIdSet,
  knackRowBudgetCost,
  knackEligibleOrLockedHeld,
  reconcileLockedKnackIds,
  settleExperienceKnacksAfterTierAdvance,
  settleLockedExperienceKnacks,
  knackOwnedFromPriorChargenPick,
} from "./eligibility.js";
import {
  toggleHeroKnackWithRowPayment,
  commitKnackToCallingRow,
  knackPointCostLabel,
  callingRowBudgetLine,
} from "./knackPayingRowPicker.js";
import { boonDisplayLabel } from "./boonLabels.js";
import { birthrightTagIds, birthrightTagLabels } from "./birthrightTags.js";
import { mergedPurviewIdsForSheet, purviewDisplayNameForPantheon } from "./purviewDisplayName.js";
import { purviewInnateBlocks, purviewStandardInnateText } from "./purviewInnate.js";
import { apiUrl } from "./apiBase.js";
import { wirePickerRowFilter, wireSortableTableColumns } from "./pickerTableUtils.js";
import {
  isChargenWizardHiddenBirthrightRow,
  isChargenWizardHiddenEquipmentRow,
} from "./chargenWizardCatalogFilters.js";
import {
  trimTrailingEmptyFatebindings,
  sanitizeFatebindingsForEditor,
  coerceFatebindingsStoredList,
  persistFatebindingEditorRowFromDom,
} from "./fatebindingsSheet.js";
import { appendFatebindingsFinishingEditor } from "./fatebindingsFinishingEditor.js";
import { appendFinishingExtendedNotesPanel } from "./finishingExtendedNotesPanel.js";
import { downloadReviewSheetAsPdf } from "./reviewSheetPdf.js";
import {
  buildDominionStuntExportFromCharacter,
  dominionStuntPurviewKeysForExport,
  dominionStuntsGroupedByPurview,
  tierSupportsDominionStunts,
} from "./dominionStuntsExport.js";
import {
  applyDominionMarkPayment,
  boonBudgetSnapshot,
  clearDominionMarkPayment,
  dominionForgoneBoonIds,
  dominionMarkPaymentOptions,
  experienceBoonIdSet,
  legendBoonSlotsRemaining,
  legendBoonSlotsUsed,
  pruneDominionForgoneMaps,
  sacrificableBoonIds,
  DOMINION_BOON_FORGONE_COST,
} from "./boonBudget.js";
import {
  dominionBoonLedgerSummary,
  legendBookMinForTier,
  legendDotMaxForTier,
  legendTraitBoonPurchasesFromRating,
  legendTraitEffectsSummary,
  tierUsesLegendTraitEffects,
} from "./legendTrait.js";
import { createBookSourceFilterPanel } from "./bookSourceFilter.js";
import { detectConflicts } from "./bookConflictDetection.js";
import { showConflictModal } from "./bookConflictModal.js";
import {
  dragonHeirPostConceptStepList,
  renderDragonHeirStepInRoot,
  dragonHeirStepLeaveBlockedReason,
  syncDragonFlightPathRequiredSkills,
  persistDragonFromDom,
  ensureDragonShape,
  isDragonHeirChargen,
  dragonHeirAttributesCoreLayoutLocked,
  buildDragonReviewSnapshot,
  captureDragonFinishingAttrBaseline,
  appendDragonHeirFlightsPathStep,
} from "./chargen/DragonChargenWizard.js";
import { sheetFinalAttrsAfterFavored } from "./sheetExportAttrs.js";
import { formatGameDataSourceForDisplay } from "./sourceDisplayForUi.js";
import { appendSkillRatingsTableThead, skillIdsSplitForSkillsTables } from "./skillTableColumns.js";

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

/** Safe `APPROACH_ATTRS` key for math and dot rows (invalid imports default to Force). */
function resolvedFavoredApproach() {
  const f = String(character.favoredApproach ?? "").trim();
  return APPROACH_ATTRS[f] ? f : "Force";
}

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
  /** Titans Rising + S&M: same Apotheosis jump as deity-line Hero → Demigod when bundle JSON is absent. */
  titanic: {
    nextTier: "demigod",
    source: "Saints & Monsters / Titans Rising — Titanic Apotheosis toward Demigod-scale play.",
    checklist: [
      "Resolve Maelstrom Heart / Epicenter suppression and Collateral (or Tension alternate) per PDF.",
      "Update Calling dots, Knacks, Purviews, and Birthrights for Demigod when your table advances you.",
      "Raise Legend in the header when your chronicle agrees.",
    ],
  },
  god: {
    nextTier: null,
    source: "Scion: God — top of the deity/titanic ladder in this app; further growth is chronicle-specific.",
    checklist: ["Record Mantles, Purviews, Fatebindings, and Marvel limits with Scion: God at the table."],
  },
  sorcerer_god: {
    nextTier: null,
    source: "Saints & Monsters — top of the written Sorcerer ladder in this chapter.",
    checklist: [
      "You may know four of the five Workings; the fifth remains inaccessible without Storyguide exception (p. 65).",
      "Record Motif, Sources of Power, and any Denizen / Saint crossover hooks at the table.",
    ],
  },
};

function normalizedTierId(tierId) {
  const raw = String(tierId ?? "mortal").trim();
  if (!raw) return "mortal";
  const lower = raw.toLowerCase();
  if (lower === "origin") return "mortal";
  return lower;
}

/** @param {string} [tierId] */
function isSorcererLineTier(tierId) {
  return isSorcererLineTierId(tierId);
}

/** Sorcerers use Workings / Techniques / Paraphernalia only — strip any legacy Calling / Knack state. */
function stripSorcererLineCallingAndKnacks() {
  if (!isSorcererLineTier(character.tier)) return;
  character.callingId = "";
  character.callingSlots = null;
  character.callingDots = 1;
  character.knackIds = [];
  character.knackSlotById = {};
  character.lockedKnackIds = [];
  character.finishingBonusKnackIds = [];
  if (character.finishing && Array.isArray(character.finishing.finishingKnackIds)) {
    character.finishing.finishingKnackIds = [];
  }
}

/** Heuristic: export / embedded `dragon` blob is clearly Heir state (not an empty stub). */
function dragonPayloadImpliesHeir(d) {
  if (!d || typeof d !== "object") return false;
  const inh = d.inheritance;
  const hasInh = inh != null && String(inh).trim() !== "";
  const hasVer = d.dragonWizardVersion != null && Number(d.dragonWizardVersion) > 0;
  const hasFlight = String(d.flightId ?? "").trim() !== "";
  const hasMagics = Array.isArray(d.knownMagics) && d.knownMagics.some((x) => String(x ?? "").trim());
  const knackCount = Array.isArray(d.callingKnackIds) ? d.callingKnackIds.filter(Boolean).length : 0;
  return Boolean(hasInh || hasVer || hasFlight || hasMagics || knackCount > 0);
}

/**
 * If Heir state exists but `chargenLineage` was dropped or wrong, set `dragonHeir` so the wizard uses Heir steps (not a trimmed Mortal `wizardSteps` list).
 */
function healDragonHeirLineageFromState() {
  if (isDragonHeirChargen(character)) return;
  if (!dragonPayloadImpliesHeir(character?.dragon)) return;
  if (normalizedTierId(character.tier) !== "mortal") return;
  if (isSorcererLineTier(character.tier)) return;
  character.chargenLineage = "dragonHeir";
}

/**
 * How many Workings a Sorcerer may know at chargen for this tier (S&M p. 65: one at Legend 0; +1 at Legend 1, 5, 9;
 * Heroic band: two Workings at Legend 1 with one extra Technique each beyond the inherent, p. 86).
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

/** Max Inheritance dot on the Heir track (Scion: Dragon pp. 117–119); keep in sync with `data/dragonTier.json`. */
const DRAGON_INHERITANCE_MAX = 10;

/**
 * When false, the wizard omits the Finishing tab: no Origin-style extra Skill/Attribute dots or bonus Knacks/Birthrights
 * here (Hero+, Demigod, God, Sorcerer Hero+, Titanic extras→Review, Dragon Heir past Hatchling — books use other steps).
 */
function wizardIncludesFinishingTouchesStep(tierId) {
  if (isDragonHeirChargen(character)) {
    const inh = Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(character?.dragon?.inheritance) || 1)));
    return inh <= 1;
  }
  return isOriginPlayTier(tierId);
}

/** Max Legend dots on the track per tier — see `legendTrait.js` (`LEGEND_DOT_MAX_BY_TIER`). */

/** Clamp stored Legend to the sheet track (15); chronicles may exceed tier advisory max. */
function clampLegendRating(value, _tierId) {
  const max = LEGEND_SHEET_DOT_COUNT;
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
  const awN = isMythosPantheonSelected()
    ? Math.max(LEGEND_SHEET_DOT_COUNT, awarenessDotMaxForTier(character.tier))
    : 1;
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
 * Legend: fixed {@link LEGEND_SHEET_DOT_COUNT} dots (community sheet / pool columns); rating is 0..tier cap.
 * Click dot i to set toward i (capped at tier max); click again on the active cap to lower by one (minimum 0).
 * @param {number} value
 * @param {string} tierId
 * @param {boolean} interactive
 */
function buildLegendDotTrack(value, tierId, interactive) {
  const trackDots = LEGEND_SHEET_DOT_COUNT;
  const tierCap = legendDotMaxForTier(tierId);
  const v = clampLegendRating(value, tierId);
  const wrap = document.createElement("span");
  wrap.className = "legend-dot-track legend-dot-track-dense legend-dot-track--header-sheet";
  wrap.setAttribute("role", interactive ? "radiogroup" : "img");
  wrap.setAttribute("aria-label", `Legend ${v} of ${tierCap} (max this tier; ${trackDots} dots on sheet)`);
  for (let i = 1; i <= trackDots; i += 1) {
    const d = document.createElement("span");
    const beyond = i > tierCap;
    d.className = "legend-dot" + (i <= v ? " on" : "") + (beyond ? " legend-dot--beyond-tier-cap" : "");
    d.setAttribute("aria-hidden", "true");
    if (interactive) {
      d.tabIndex = beyond ? -1 : 0;
      d.addEventListener("click", () => {
        const maxT = LEGEND_SHEET_DOT_COUNT;
        const cur = clampLegendRating(character.legendRating ?? 0, character.tier);
        const target = Math.min(i, maxT);
        if (cur === target) character.legendRating = Math.max(0, target - 1);
        else character.legendRating = target;
        syncLegendToTier();
        render();
      });
    }
    wrap.appendChild(d);
  }
  return wrap;
}

/**
 * Mythos Awareness: fixed {@link LEGEND_SHEET_DOT_COUNT} dots; rating is 1..tier cap (same as Legend track length on the sheet).
 * @param {number} value
 * @param {string} tierId
 * @param {boolean} interactive
 */
function buildAwarenessDotTrack(value, tierId, interactive) {
  const cap = awarenessDotMaxForTier(tierId);
  const trackDots = LEGEND_SHEET_DOT_COUNT;
  const v = clampAwarenessRating(value, tierId);
  const wrap = document.createElement("span");
  wrap.className = "legend-dot-track legend-dot-track-dense legend-dot-track--header-sheet";
  wrap.setAttribute("role", interactive ? "radiogroup" : "img");
  wrap.setAttribute("aria-label", `Awareness ${v} of ${cap} (${trackDots} dots)`);
  for (let i = 1; i <= trackDots; i += 1) {
    const d = document.createElement("span");
    const beyond = i > cap;
    d.className = "legend-dot" + (i <= v ? " on" : "") + (beyond ? " legend-dot--beyond-tier-cap" : "");
    d.setAttribute("aria-hidden", "true");
    if (interactive) {
      d.tabIndex = beyond ? -1 : 0;
      d.addEventListener("click", () => {
        const maxA = awarenessDotMaxForTier(character.tier);
        const cur = clampAwarenessRating(character.awarenessRating ?? 1, character.tier);
        const target = Math.min(i, maxA);
        if (cur === target) character.awarenessRating = Math.max(1, target - 1);
        else character.awarenessRating = target;
        syncAwarenessWithPantheon();
        render();
      });
    }
    wrap.appendChild(d);
  }
  return wrap;
}

function dragonInheritancePoolMaxFromCharacter() {
  ensureDragonShape(character, bundle);
  const d = character.dragon;
  return Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(d?.inheritance) || 1)));
}

/** Current pool on the 10-dot track (0 when all points are imbued/spent; not capped to Inheritance milestone). */
function clampDragonInheritancePoolRating(value) {
  const maxT = DRAGON_INHERITANCE_POOL_SHEET_DOT_COUNT;
  const n = Math.round(Number(value));
  const x = Number.isNaN(n) ? 0 : n;
  return Math.max(0, Math.min(maxT, x));
}

/**
 * Dragon Heir: Inheritance pool dots in the wizard header (Heirs have no Legend pool; Dragon p. 114).
 * @param {number} value
 * @param {boolean} interactive
 */
function buildInheritancePoolDotTrack(value, interactive) {
  const trackDots = DRAGON_INHERITANCE_POOL_SHEET_DOT_COUNT;
  const inhN = dragonInheritancePoolMaxFromCharacter();
  const v = clampDragonInheritancePoolRating(value);
  const wrap = document.createElement("span");
  wrap.className = "legend-dot-track legend-dot-track-dense legend-dot-track--header-sheet";
  wrap.setAttribute("role", interactive ? "radiogroup" : "img");
  wrap.setAttribute(
    "aria-label",
    `Inheritance pool ${v} on ${trackDots}-dot track (milestone ${inhN}; can be 0 when imbued/spent; Dragon Heir has no Legend rating)`,
  );
  for (let i = 1; i <= trackDots; i += 1) {
    const dot = document.createElement("span");
    dot.className = "legend-dot" + (i <= v ? " on" : "");
    dot.setAttribute("aria-hidden", "true");
    if (interactive) {
      dot.tabIndex = 0;
      dot.addEventListener("click", () => {
        ensureDragonShape(character, bundle);
        const cur = clampDragonInheritancePoolRating(character.dragon?.inheritancePoolRating ?? 0);
        const target = Math.min(i, trackDots);
        if (cur === target) character.dragon.inheritancePoolRating = Math.max(0, target - 1);
        else character.dragon.inheritancePoolRating = target;
        ensureDragonShape(character, bundle);
        render();
      });
    }
    wrap.appendChild(dot);
  }
  return wrap;
}

/** Rules for advancing `tierId`, merging `data/tierAdvancement.json` over these defaults. */
function getTierAdvancementRule(tierId) {
  const id = normalizedTierId(tierId);
  const fallback = DEFAULT_TIER_ADVANCEMENT[id];
  const fromBundle = bundle?.tierAdvancement?.[id];
  const merged = { ...(fallback || {}), ...(fromBundle || {}) };
  /* Top tiers use `nextTier: null`; still return metadata (checklist/source) for Review UI. */
  if (!("nextTier" in merged)) return null;
  return merged;
}

/** @type {any} */
let bundle = null;

/** Set of allowed book slugs for filtering. All books enabled by default (populated during init). */
let allowedBooks = new Set();

/** Sync the book-filter panel checkboxes to match the current `allowedBooks` Set. */
function syncBookFilterPanelCheckboxes() {
  const panel = document.querySelector(".book-source-filter");
  if (!panel) return;
  const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    cb.checked = allowedBooks.has(cb.value);
  }
}

/** @type {ReturnType<typeof defaultCharacter>} */
let character = defaultCharacter();

let stepIndex = 0;

/** Purviews step: which Purview id shows the innate preview below the chip row (cleared when that chip is toggled off). */
let purviewInnateDetailFocusId = "";

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
    /** Locked Knack row-budget cost at tier advance (chargen spend carried forward; XP knacks omit this). */
    knackLockedRowBudgetCostById: {},
    /** Knacks chosen before tier advance — cannot be deselected when picking additional Knacks. */
    lockedKnackIds: [],
    /** Origin Finishing extras merged at Hero+ — locked, but free against Calling row knack budgets. */
    finishingBonusKnackIds: [],
    /** Exp Leveling Knack purchases — on the sheet but free against Calling knack budgets. */
    experienceKnackIds: [],
    experienceBoonIds: [],
    /** Origin-tier XP knack buys carried after tier advance — still free against Hero row budgets. */
    carriedExperienceKnackIds: [],
    /** Per-attribute dots bought with Experience (post-chargen; excluded from Finishing / arena validation). */
    experienceAttributeBumps: {},
    /** Per-skill dots bought with Experience (post-chargen; excluded from Finishing / path validation). */
    experienceSkillBumps: {},
    knackIds: [],
    purviewIds: [],
    /** Four slots, each `""` or a Purview id from the current divine parent’s list. */
    patronPurviewSlots: ["", "", "", ""],
    boonIds: [],
    /** Purview ids where the character purchased a Dominion Boon (Demigod+; costs two Boon slots per Purview in play). */
    dominionBoonPurviewIds: [],
    /** Per-Purview ids of two sheet Boons forgone when Dominion was paid with existing picks (not Legend reserve). */
    dominionBoonForgoneByPurview: {},
    /** Subset of dominionBoonForgoneByPurview ids that were bought with Experience. */
    dominionBoonForgoneXpByPurview: {},
    /** Unspent Experience (Origin p. 113); purchases deduct from this pool. */
    experiencePoints: 0,
    /** XP spent via Exp Leveling (remaining + spent = total earned on sheet). */
    experiencePointsSpent: 0,
    /** Human-readable Exp Leveling purchases for the review sheet “Spent on” block. */
    experiencePurchaseLog: [],
    /** Birthright template ids purchased with Experience (5 XP each; not counted toward chargen point budget). */
    experienceBirthrightPickIds: [],
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
      /** Mortal Sorcerer (S&M p. 87): `two_techniques` | `four_paraphernalia` | `one_technique_two_paraphernalia` */
      sorcererMortalFinishingPackage: "four_paraphernalia",
      sorcererMortalExtraTechniquesNotes: "",
      skillBaseline: null,
      attrBaseline: null,
      finishingKnackIds: [],
      birthrightPicks: [],
    },
    notes: "",
    /** Freeform look / vitals / etc. for the sheet “Description” block (page 2). */
    sheetDescription: "",
    /** Equipment ids from `equipment.json` for the printable equipment section. */
    sheetEquipmentIds: [],
    /** Fatebinding rows for the printable Fatebinding section (name, strength, story per slot). */
    fatebindings: [],
    /** Finishing-step extended notes (sheet appendices). */
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
      /** @type {string[]} — additional Technique ids from `saintsMonsters.sorcererTechniquesByWorking` (not inherent). */
      additionalTechniqueIds: [],
      inherentTechniqueNotes: "",
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

/** Normalize imports / hand edits so Dragon gates match `isDragonHeirChargen` (case-insensitive). */
function canonChargenLineageFromRaw(raw) {
  const x = String(raw ?? "scion").trim().toLowerCase();
  return x === "dragonheir" || x === "dragon_heir" ? "dragonHeir" : "scion";
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
    additionalTechniqueIds: [],
    /** Techniques beyond natural/chargen budget — 10 XP each (Saints & Monsters ch. 3). */
    experienceAdditionalTechniqueIds: [],
    inherentTechniqueNotes: "",
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
  if (!Array.isArray(character.sorceryProfile.additionalTechniqueIds)) character.sorceryProfile.additionalTechniqueIds = [];
  else {
    character.sorceryProfile.additionalTechniqueIds = [
      ...new Set(character.sorceryProfile.additionalTechniqueIds.filter((x) => typeof x === "string" && x.trim())),
    ];
  }
  if (!Array.isArray(character.sorceryProfile.experienceAdditionalTechniqueIds)) {
    character.sorceryProfile.experienceAdditionalTechniqueIds = [];
  } else {
    character.sorceryProfile.experienceAdditionalTechniqueIds = [
      ...new Set(character.sorceryProfile.experienceAdditionalTechniqueIds.filter((x) => typeof x === "string" && x.trim())),
    ];
  }
  pruneSorceryAdditionalTechniques();
  const tSorc = normalizedTierId(character.tier);
  if (tSorc === "sorcerer") {
    character.sorceryProfile.primaryPowerSource = "";
    character.sorceryProfile.powerSource = "";
    character.sorceryProfile.invocation = "";
    character.sorceryProfile.patronage = "";
    character.sorceryProfile.prohibition = "";
    character.sorceryProfile.talisman = "";
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

  const singlePatronSlotUi = patronPurviewSingleSlotHeroStyle();

  const stdBlock = document.createElement("div");
  stdBlock.className = "field mythos-innate-standard-block";
  const stdTitle = document.createElement("div");
  stdTitle.className = "field mythos-innate-subhead";
  stdTitle.textContent = singlePatronSlotUi ? "Standard innate (patron Purview)" : "Standard innate Purview";
  stdBlock.appendChild(stdTitle);
  const stdP = document.createElement("p");
  stdP.className = "help";
  if (singlePatronSlotUi) {
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
  } else if (!singlePatronSlotUi) {
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
  awIntro.innerHTML = singlePatronSlotUi
    ? "The <strong>dropdown</strong> is only for picking <strong>which parent Purview</strong> receives MotM’s <strong>Awareness Innate</strong> text if you press <strong>Awareness Innate Power…</strong>. It does <strong>not</strong> set your normal innate—that stays the chip selection above unless you commit and replace the model (MotM pp. 49–59; irreversible once committed)."
    : "Optionally commit to the <strong>Awareness Innate</strong> for <strong>one</strong> Purview from your <strong>divine parent’s</strong> list (MotM pp. 49–59). Once confirmed, you cannot revert.";
  fieldset.appendChild(awIntro);

  const mythosAwarenessInlineLayout = singlePatronSlotUi;
  const rowPv = document.createElement("div");
  rowPv.className =
    "field mythos-innate-awareness-row" + (mythosAwarenessInlineLayout ? " mythos-innate-awareness-row--hero-inline" : "");
  const labPv = document.createElement("label");
  labPv.htmlFor = "f-mythos-innate-purview";
  labPv.textContent = singlePatronSlotUi
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

  if (mythosAwarenessInlineLayout) {
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
      "None of this parent’s Purviews have MotM Awareness Innate text in this app yet (see purviews.json mythosAwarenessInnate).";
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
  character.fatebindings = coerceFatebindingsStoredList(character.fatebindings);
  ensureFinishingShape();
  const fi = character.finishing;
  const n = character.fatebindings.length;
  if (typeof fi.fatebindingEditorIndex !== "number" || Number.isNaN(fi.fatebindingEditorIndex)) fi.fatebindingEditorIndex = 0;
  else fi.fatebindingEditorIndex = Math.max(0, Math.round(fi.fatebindingEditorIndex));
  if (n === 0) fi.fatebindingEditorIndex = 0;
  else if (fi.fatebindingEditorIndex >= n) fi.fatebindingEditorIndex = n - 1;
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

/**
 * Name + optional Specialty field.
 * @param {{ skillsTableSpecialty?: boolean; specialtyReadOnly?: boolean }} [opts] If true (Skills + Finishing skill rows): specialty input only, placeholder `specialty`, to the right of the name. `specialtyReadOnly`: Skills step after Origin — no specialty edits.
 */
function appendSkillRatingNameCell(tr, sid, skillMeta, val, opts) {
  const skillsTable = opts?.skillsTableSpecialty === true;
  const specReadOnly = opts?.specialtyReadOnly === true;
  const nameTd = document.createElement("td");
  nameTd.className = "skill-ratings-col-name" + (skillsTable ? " skill-ratings-col-name--skills-step" : "");
  const nameRow = document.createElement("div");
  nameRow.className = "skill-ratings-name-row";
  const nameSpan = document.createElement("span");
  nameSpan.className = "skill-ratings-skill-label";
  nameSpan.textContent = skillMeta.name;
  applyGameDataHint(nameSpan, skillMeta);
  nameRow.appendChild(nameSpan);
  if (val >= 3) {
    const specWrap = document.createElement("div");
    specWrap.className =
      "field skill-specialty-field skill-specialty-inline" +
      (skillsTable ? " skill-specialty-inline--skills-table" : "");
    const specIn = document.createElement("input");
    specIn.type = "text";
    specIn.id = `specialty-${sid}`;
    specIn.autocomplete = "off";
    if (skillsTable) {
      specIn.placeholder = "specialty";
      specIn.setAttribute("aria-label", `${skillMeta.name} specialty`);
      specIn.value = character.skillSpecialties[sid] || "";
      const ghostLab = document.createElement("label");
      ghostLab.htmlFor = `specialty-${sid}`;
      ghostLab.className = "skill-specialty-sr-only";
      ghostLab.textContent = "Specialty";
      specWrap.appendChild(ghostLab);
      specWrap.appendChild(specIn);
      applySkillSpecialtyHints(ghostLab, specIn, sid);
    } else {
      const specLab = document.createElement("label");
      specLab.htmlFor = `specialty-${sid}`;
      specLab.textContent = "Specialties";
      specIn.placeholder = "e.g. Greek Mythology, Parkour…";
      specIn.value = character.skillSpecialties[sid] || "";
      specWrap.appendChild(specLab);
      specWrap.appendChild(specIn);
      applySkillSpecialtyHints(specLab, specIn, sid);
    }
    const specXpBuy =
      (specReadOnly || experiencePurchasesEnabled()) &&
      experiencePurchasesEnabled() &&
      val >= 3 &&
      !(character.skillSpecialties[sid] || "").trim() &&
      experienceCanAfford(character, bundle, "specialty");
    if (specReadOnly && !specXpBuy) {
      specIn.readOnly = true;
      specIn.disabled = true;
    } else if (specXpBuy) {
      specIn.placeholder = `specialty (${experiencePurchaseCost(bundle, "specialty")} XP)`;
      const syncSpecXp = () => {
        const t = specIn.value.trim();
        if (!t) return;
        if ((character.skillSpecialties[sid] || "").trim()) {
          character.skillSpecialties[sid] = specIn.value;
          return;
        }
        if (!experienceSpend(character, bundle, "specialty", `${skillMeta.name} specialty`)) return;
        character.skillSpecialties[sid] = specIn.value;
        render();
      };
      specIn.addEventListener("change", syncSpecXp);
      specIn.addEventListener("blur", syncSpecXp);
    } else {
      const syncSpec = () => {
        const t = specIn.value.trim();
        if (t) character.skillSpecialties[sid] = specIn.value;
        else delete character.skillSpecialties[sid];
      };
      const onSpecFieldEdit = () => {
        syncSpec();
        refreshFinishingWizardGateUiFromDom();
      };
      specIn.addEventListener("input", onSpecFieldEdit);
      specIn.addEventListener("change", onSpecFieldEdit);
      specIn.addEventListener("blur", onSpecFieldEdit);
      specIn.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        onSpecFieldEdit();
      });
    }
    nameRow.appendChild(specWrap);
  }
  nameTd.appendChild(nameRow);
  tr.appendChild(nameTd);
}

/** Dots column: `"skills"` = full 0–5 (or XP raises when post-chargen locked); `"finishing"` = baseline–cap from finishing budget. */
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
  const skillsXpLocked = mode === "skills" && postOriginMortalChargenLocked(character);
  const skillsXpMode = mode === "skills" && experiencePurchasesEnabled();
  const skillsReadonlyLocked = mode === "skills" && skillsXpLocked && !experiencePurchasesEnabled();
  const skillXpCost = experiencePurchaseCost(bundle, "skill");
  for (let i = 1; i <= 5; i += 1) {
    if (mode === "skills" && !skillsXpLocked && !skillsXpMode) {
      const sp = document.createElement("span");
      sp.className = "dot dot-unmodifiable" + (i <= val ? " filled" : "");
      sp.setAttribute("aria-hidden", "true");
      dots.appendChild(sp);
    } else if (skillsReadonlyLocked) {
      const sp = document.createElement("span");
      sp.className = "dot dot-unmodifiable" + (i <= val ? " filled" : "");
      sp.setAttribute("aria-hidden", "true");
      dots.appendChild(sp);
    } else if (mode === "skills" && skillsXpMode) {
      const cur = character.skillDots[sid] || 0;
      const btn = document.createElement("button");
      btn.type = "button";
      const filled = i <= cur;
      const canRaise = !filled && i === cur + 1 && cur < 5 && experienceCanAfford(character, bundle, "skill");
      btn.disabled = !filled && !canRaise;
      btn.className =
        "dot" +
        (filled ? " filled" : "") +
        (canRaise ? " dot-experience-unlock" : filled ? "" : " dot-capped");
      if (canRaise) {
        btn.title = `Spend ${skillXpCost} Experience to raise ${skillMeta.name} to ${i}`;
        btn.addEventListener("click", () => {
          if (!experienceSpend(character, bundle, "skill", `${skillMeta.name} +1`)) return;
          recordExperienceSkillBump(character, sid);
          character.skillDots[sid] = cur + 1;
          render();
        });
      }
      dots.appendChild(btn);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      const allowed = i >= minV && i <= maxV;
      btn.disabled = !allowed;
      const baselineLocked = i <= disp && i <= minV;
      btn.className =
        "dot" + (i <= disp ? " filled" : "") + (allowed ? "" : " dot-capped") + (baselineLocked ? " dot-finishing-locked-fill" : "");
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
  if (isDragonHeirChargen(character)) return;
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
 * Path + redistribution totals only (no Finishing Skill dots). Mutates `pathSkillRedistribution` like `applyPathMathToSkillDots`.
 * @returns {Record<string, number>}
 */
function pathOnlySkillDotsMap() {
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
  /** @type {Record<string, number>} */
  const out = {};
  for (const sid of skillIds()) {
    const t = trimmed[sid] || 0;
    const g = G[sid] || 0;
    out[sid] = Math.max(0, Math.min(5, t + g));
  }
  return out;
}

/**
 * Overwrite skill ratings from Path priority + Path Skills (3 / 2 / 1 cumulative).
 * Overlap above 5 is not dropped: `pathSkillRedistribution` holds dots moved to other Path Skills (Origin p. 97).
 * When `finishing.skillBaseline` exists, it tracks the Skills-step totals and Finishing bumps stay in `skillDots`.
 */
function applyPathMathToSkillDots() {
  const pathOnly = pathOnlySkillDotsMap();
  ensureFinishingShape();
  const oldBaseline =
    character.finishing?.skillBaseline && typeof character.finishing.skillBaseline === "object"
      ? character.finishing.skillBaseline
      : null;
  /** @type {Record<string, number>} */
  const bumps = {};
  if (oldBaseline) {
    for (const sid of skillIds()) {
      bumps[sid] = Math.max(0, (character.skillDots[sid] || 0) - (oldBaseline[sid] || 0));
    }
  }
  if (oldBaseline) {
    for (const sid of skillIds()) {
      const po = pathOnly[sid] ?? 0;
      const xp = experienceSkillBumpCount(character, sid);
      const chargenBump = Math.max(0, (bumps[sid] || 0) - xp);
      character.finishing.skillBaseline[sid] = po;
      character.skillDots[sid] = Math.max(0, Math.min(5, po + chargenBump + xp));
    }
  } else {
    for (const sid of skillIds()) {
      const po = pathOnly[sid] ?? 0;
      const cur = character.skillDots[sid] || 0;
      // Hero+ clears skillBaseline; keep Finishing carryover and Experience bumps above Path totals.
      const abovePath = Math.max(0, cur - po);
      character.skillDots[sid] = Math.max(0, Math.min(5, po + abovePath));
    }
  }
  for (const sid of skillIds()) {
    if ((character.skillDots[sid] || 0) < 3) delete character.skillSpecialties[sid];
  }
}

function pantheonList() {
  const list = Object.values(bundle.pantheons || {}).filter(
    (p) => p && typeof p === "object" && p.id && !String(p.id).startsWith("_") && isEntryVisibleForBooks(p, allowedBooks),
  );
  return list.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, { sensitivity: "base" }));
}

/** Pantheons with at least one divine parent (Paths when Patron type is Deity). */
function pantheonListForDeityParents() {
  return pantheonList().filter((p) => Array.isArray(p.deities) && p.deities.length > 0);
}

/**
 * Paths step pantheon chooser: same list for Deity and Titan lines (pantheons with at least one divine parent
 * row in `deities`). Titan mode still fills the parent dropdown from `titans` / `titans.json` merge.
 */
function pantheonOptionsForCurrentPatronKind() {
  return pantheonListForDeityParents();
}

const WELCOME_DEITY_TIER_ORDER = ["mortal", "hero", "demigod", "god"];
const WELCOME_TITAN_TIER_ORDER = ["mortal", "titanic", "demigod", "god"];
const WELCOME_SORCERER_TIER_ORDER = ["sorcerer", "sorcerer_hero", "sorcerer_demigod", "sorcerer_god"];

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

/** Deity / Titan Paths step: pantheon + parent required (set on Welcome: Divine vs Titan line). */
function pathsStepRequiresPantheonAndParent() {
  if (isDragonHeirChargen(character) || isSorcererLineTier(character.tier)) return false;
  const p = welcomePartsFromCharacter();
  return p.line === "deity" || p.line === "titan";
}

function pathsPantheonAndParentSatisfiedOnCharacter() {
  return Boolean(String(character.pantheonId || "").trim() && String(character.parentDeityId || "").trim());
}

/** Keep `patronKind` aligned with Welcome line — Paths no longer exposes Divine/Titan toggle. */
function syncPatronKindFromWelcomeLine() {
  if (isSorcererLineTier(character.tier) || isDragonHeirChargen(character)) return;
  const wp = welcomePartsFromCharacter();
  if (wp.line === "titan") character.patronKind = "titan";
  else if (wp.line === "deity") character.patronKind = "deity";
}

/** @returns {{ line: "deity"|"titan"|"dragon"|"sorcerer"; payload: string }} */
function welcomePartsFromCharacter() {
  if (isDragonHeirChargen(character)) {
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
    character.tier = isSorcererLineTierId(raw) ? raw : "sorcerer";
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

/** @returns {Record<string, unknown> | null} */
function sorcererTechniquesByWorkingTable() {
  const t = saintsMonstersBundle()?.sorcererTechniquesByWorking;
  return t && typeof t === "object" ? t : null;
}

/** @param {string} workingId */
function sorceryWorkingTechniqueDef(workingId) {
  const tbl = sorcererTechniquesByWorkingTable();
  const wid = String(workingId || "").trim();
  if (!tbl || !wid) return null;
  const def = tbl[wid];
  return def && typeof def === "object" ? def : null;
}

/** Which Working owns this Technique id (inherent or additional), or "". */
function techniqueWorkingOwner(techniqueId) {
  const tid = String(techniqueId || "").trim();
  if (!tid) return "";
  const tbl = sorcererTechniquesByWorkingTable();
  if (!tbl) return "";
  for (const wid of Object.keys(tbl)) {
    const def = tbl[wid];
    if (!def || typeof def !== "object") continue;
    if (def.inherent && typeof def.inherent === "object" && def.inherent.id === tid) return wid;
    const add = Array.isArray(def.additional) ? def.additional : [];
    if (add.some((x) => x && x.id === tid)) return wid;
  }
  return "";
}

/** Total additional Technique picks allowed at chargen for the current tier + Mortal Finishing package. */
function sorceryAdditionalTechniqueBudgetTotal() {
  const t = normalizedTierId(character.tier);
  if (t === "sorcerer") {
    const pkg = String(character.finishing?.sorcererMortalFinishingPackage || "four_paraphernalia").trim();
    if (pkg === "two_techniques") return 2;
    if (pkg === "one_technique_two_paraphernalia") return 1;
    return 0;
  }
  if (t === "sorcerer_hero" || t === "sorcerer_demigod" || t === "sorcerer_god") {
    const w = (character.sorceryProfile?.workingIds || []).filter((x) => typeof x === "string" && x.trim());
    return Math.min(sorcererWorkingPickCap(character.tier), w.length) || 0;
  }
  return 0;
}

/** Drop invalid / over-budget additional Technique ids (Saints & Monsters Workings chapter). */
function pruneSorceryAdditionalTechniques() {
  if (!character.sorceryProfile) return;
  const tbl = sorcererTechniquesByWorkingTable();
  let ids = [...new Set((character.sorceryProfile.additionalTechniqueIds || []).filter((x) => typeof x === "string" && x.trim()))];
  if (!tbl) {
    character.sorceryProfile.additionalTechniqueIds = [];
    return;
  }
  const wset = new Set((character.sorceryProfile.workingIds || []).filter((x) => typeof x === "string" && x.trim()));
  ids = ids.filter((tid) => {
    const ow = techniqueWorkingOwner(tid);
    if (!ow || !wset.has(ow)) return false;
    const def = sorceryWorkingTechniqueDef(ow);
    return Array.isArray(def?.additional) && def.additional.some((x) => x && x.id === tid);
  });
  const budget = sorceryAdditionalTechniqueBudgetTotal();
  if (ids.length > budget) ids = ids.slice(0, budget);
  const tierN = normalizedTierId(character.tier);
  if (tierN === "sorcerer") {
    const firstW = (character.sorceryProfile.workingIds || []).find((x) => typeof x === "string" && x.trim());
    if (firstW) ids = ids.filter((tid) => techniqueWorkingOwner(tid) === firstW);
  }
  character.sorceryProfile.additionalTechniqueIds = ids;

  let xpIds = [...(character.sorceryProfile.experienceAdditionalTechniqueIds || [])];
  xpIds = xpIds.filter((tid) => {
    const ow = techniqueWorkingOwner(tid);
    if (!ow || !wset.has(ow)) return false;
    const def = sorceryWorkingTechniqueDef(ow);
    return Array.isArray(def?.additional) && def.additional.some((x) => x && x.id === tid);
  });
  character.sorceryProfile.experienceAdditionalTechniqueIds = xpIds;
}

function sorceryTechniquePickedSet() {
  ensureSorceryProfileShape();
  return new Set([
    ...(character.sorceryProfile.additionalTechniqueIds || []),
    ...(character.sorceryProfile.experienceAdditionalTechniqueIds || []),
  ]);
}

/** @param {string} techniqueId */
function removeSorceryTechniquePick(techniqueId) {
  ensureSorceryProfileShape();
  const tid = String(techniqueId || "").trim();
  if (!tid) return;
  const ids = [...(character.sorceryProfile.additionalTechniqueIds || [])];
  const i = ids.indexOf(tid);
  if (i >= 0) {
    ids.splice(i, 1);
    character.sorceryProfile.additionalTechniqueIds = ids;
    return;
  }
  const xpIds = [...(character.sorceryProfile.experienceAdditionalTechniqueIds || [])];
  const j = xpIds.indexOf(tid);
  if (j >= 0) {
    xpIds.splice(j, 1);
    character.sorceryProfile.experienceAdditionalTechniqueIds = xpIds;
  }
}

function toggleSorceryAdditionalTechnique(techniqueId) {
  ensureSorceryProfileShape();
  const tid = String(techniqueId || "").trim();
  if (!tid) return;
  const ownerW = techniqueWorkingOwner(tid);
  if (!ownerW) return;
  const wids = (character.sorceryProfile.workingIds || []).filter((x) => typeof x === "string" && x.trim());
  if (!wids.includes(ownerW)) return;
  const def = sorceryWorkingTechniqueDef(ownerW);
  const extraOk = Array.isArray(def?.additional) && def.additional.some((x) => x && x.id === tid);
  if (!extraOk) return;
  if (sorceryTechniquePickedSet().has(tid)) {
    removeSorceryTechniquePick(tid);
    pruneSorceryAdditionalTechniques();
    render();
    return;
  }
  const tierN = normalizedTierId(character.tier);
  const budget = sorceryAdditionalTechniqueBudgetTotal();
  let ids = [...(character.sorceryProfile.additionalTechniqueIds || [])];
  if (tierN === "sorcerer" && ownerW !== wids[0]) return;
  const chargenForW = ids.filter((x) => techniqueWorkingOwner(x) === ownerW).length;
  const heroOnePerW = tierN !== "sorcerer" && chargenForW >= 1;
  const atChargenCap = tierN === "sorcerer" ? ids.length >= budget : heroOnePerW || ids.length >= budget;
  const techniqueSpendLabel = `Technique: ${
    def.additional.find((x) => x && x.id === tid)?.name || tid
  }`;
  if (!atChargenCap) {
    if (tierN !== "sorcerer") ids = ids.filter((x) => techniqueWorkingOwner(x) !== ownerW);
    ids.push(tid);
    character.sorceryProfile.additionalTechniqueIds = ids;
  } else if (experiencePurchasesEnabled() && experienceSpend(character, bundle, "technique", techniqueSpendLabel)) {
    character.sorceryProfile.experienceAdditionalTechniqueIds = [
      ...(character.sorceryProfile.experienceAdditionalTechniqueIds || []),
      tid,
    ];
  } else {
    return;
  }
  pruneSorceryAdditionalTechniques();
  render();
}

/**
 * @param {"mortal_profile"|"hero_profile"|"mortal_finishing"} mode
 * @param {HTMLElement} host
 */
function appendSorceryTechniqueChipsInto(host, mode) {
  ensureSorceryProfileShape();
  pruneSorceryAdditionalTechniques();
  const tbl = sorcererTechniquesByWorkingTable();
  if (!tbl) {
    const p = document.createElement("p");
    p.className = "warn";
    p.textContent = "Technique tables are missing from saintsMonsters.json — confirm the game bundle includes Saints & Monsters data.";
    host.appendChild(p);
    return;
  }
  const wids = (character.sorceryProfile.workingIds || []).filter((x) => typeof x === "string" && x.trim());
  if (!wids.length) return;

  const sec = document.createElement("section");
  sec.className = "panel sorcerer-techniques-panel";
  const h2 = document.createElement("h2");
  h2.textContent = "Workings & Techniques";
  sec.appendChild(h2);
  const ref = document.createElement("p");
  ref.className = "help";
  const techXp = experiencePurchaseCost(bundle, "technique");
  ref.innerHTML =
    `Techniques are listed in <cite>Saints & Monsters</cite> ch. 3 (pp. 65–78). Each Working grants one <strong>Inherent Technique</strong> automatically. <strong>Mortal</strong> characters spend Step Seven Technique picks on <strong>Finishing</strong> and may use the same chip row on the <strong>Sorcerer</strong> tab once that package is chosen (p. 87). <strong>Heroic+</strong> Sorcerers pick one additional Technique per Working at chargen (p. 86). Extra Techniques beyond budget cost <strong>${techXp ?? 10} XP</strong> on the <strong>Exp Leveling</strong> tab.`;
  sec.appendChild(ref);

  const rows = sorcererWorkingsCatalogRows();
  const rowsById = new Map(rows.map((r) => [r.id, r]));
  const pickedIds = [
    ...(character.sorceryProfile.additionalTechniqueIds || []),
    ...(character.sorceryProfile.experienceAdditionalTechniqueIds || []),
  ];
  const pickedSet = sorceryTechniquePickedSet();
  const chargenIds = character.sorceryProfile.additionalTechniqueIds || [];
  const budgetAll = sorceryAdditionalTechniqueBudgetTotal();

  for (const wid of wids) {
    const def = sorceryWorkingTechniqueDef(wid);
    if (!def) continue;
    const wname = rowsById.get(wid)?.name || wid;
    const wh = document.createElement("h3");
    wh.textContent = wname;
    sec.appendChild(wh);
    const src = typeof def.source === "string" && def.source.trim() ? def.source.trim() : "";
    if (src) {
      const sp = document.createElement("p");
      sp.className = "help mono";
      sp.textContent = src;
      sec.appendChild(sp);
    }

    const inh = def.inherent && typeof def.inherent === "object" ? def.inherent : null;
    const smPdf = "Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf";
    const srcLine = typeof def.source === "string" && def.source.trim() ? def.source.trim() : `${smPdf} — Workings ch. 3`;
    if (inh?.name) {
      const inhWrap = document.createElement("div");
      inhWrap.className = "sorc-technique-block";
      const inhLab = document.createElement("div");
      inhLab.className = "help sorc-technique-subhead";
      inhLab.textContent = "Inherent Technique (automatic)";
      inhWrap.appendChild(inhLab);
      const inhRow = document.createElement("div");
      inhRow.className = "chips sorc-technique-row";
      const chip = document.createElement("span");
      chip.className = "chip sorc-technique-chip sorc-technique-chip--inherent";
      chip.textContent = String(inh.name);
      chip.setAttribute("tabindex", "0");
      applyGameDataHint(chip, {
        name: `${inh.name} (Inherent)`,
        description:
          typeof inh.hintDescription === "string" && inh.hintDescription.trim()
            ? `${inh.hintDescription.trim()}\n\nGranted automatically with the ${wname} Working — not a purchased pick (Saints & Monsters p. 66).`
            : `Granted automatically with the ${wname} Working — not purchased and not chosen from a separate list (Saints & Monsters p. 66).`,
        mechanicalEffects:
          typeof inh.hintMechanics === "string" && inh.hintMechanics.trim()
            ? inh.hintMechanics.trim()
            : `Printed fields (Skill Roll, Cost, Duration, Subject, Range, etc.) appear in the Workings chapter on PDF p. ${inh.pdfPage ?? "?"}.`,
        source: srcLine,
      });
      inhRow.appendChild(chip);
      inhWrap.appendChild(inhRow);
      sec.appendChild(inhWrap);
    }

    const hasAdditional = Array.isArray(def.additional) && def.additional.length > 0;
    if (!hasAdditional) continue;

    let interactiveAdditional = false;
    let maxAddHere = 0;
    if (mode === "hero_profile") {
      interactiveAdditional = true;
      maxAddHere = 1;
    } else if (mode === "mortal_finishing" || mode === "mortal_profile") {
      const cap = sorceryAdditionalTechniqueBudgetTotal();
      interactiveAdditional = cap > 0 && wid === wids[0];
      maxAddHere = cap;
    }

    const addLab = document.createElement("div");
    addLab.className = "help sorc-technique-subhead";
    if (mode === "mortal_profile") {
      addLab.textContent =
        budgetAll > 0
          ? `Additional Techniques (click to pick up to ${budgetAll} — Step Seven package, same Working; also available on Finishing, S&M p. 87)`
          : "Additional Techniques (same Working — choose a Step Seven package that includes Techniques on Finishing to enable picks here, p. 87)";
    } else if (mode === "hero_profile") {
      addLab.textContent = "Additional Technique at chargen (pick one from this Working)";
    } else {
      addLab.textContent = "Additional Techniques for this Step Seven package (same Working)";
    }
    sec.appendChild(addLab);
    const addRow = document.createElement("div");
    addRow.className = "chips sorc-technique-row sorc-technique-row--additional";
    const picksThisW = pickedIds.filter((id) => techniqueWorkingOwner(id) === wid).length;
    const chargenThisW = chargenIds.filter((id) => techniqueWorkingOwner(id) === wid).length;
    for (const t of def.additional) {
      if (!t || typeof t !== "object" || !t.id || !t.name) continue;
      const pagePart = t.pdfPage != null ? String(t.pdfPage) : "?";
      const hasHintDesc = typeof t.hintDescription === "string" && t.hintDescription.trim();
      const hasHintMech = typeof t.hintMechanics === "string" && t.hintMechanics.trim();
      const chargenBlurb =
        mode === "mortal_profile"
          ? budgetAll > 0
            ? `Listed under ${wname}. Mortal Step Seven Technique budget (S&M p. 87).`
            : `Listed under ${wname}. Mortal tier: enable picks by choosing a Finishing package with Technique slots (S&M p. 87).`
          : mode === "hero_profile"
            ? `Additional Technique under ${wname}: one per Working at chargen (S&M p. 86).`
            : `Additional Technique under ${wname} for your current Finishing package.`;
      const hintEntity = {
        name: t.name,
        description: hasHintDesc ? `${t.hintDescription.trim()}\n\n${chargenBlurb}` : chargenBlurb,
        mechanicalEffects: hasHintMech
          ? t.hintMechanics.trim()
          : `Stat block (Skill Roll, Cost, Duration, Subject, Range): Saints & Monsters PDF p. ${pagePart}.`,
        source: srcLine,
      };
      if (interactiveAdditional) {
        const on = pickedSet.has(t.id);
        const atCapAll = budgetAll > 0 && chargenIds.length >= budgetAll;
        const atCapW = maxAddHere > 0 && chargenThisW >= maxAddHere;
        const techniqueXpBuy =
          experiencePurchasesEnabled() &&
          !on &&
          (atCapAll || atCapW) &&
          experienceCanAfford(character, bundle, "technique");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "chip sorc-technique-chip" +
          (on ? " on" : "") +
          (techniqueXpBuy ? " chip-experience-unlock" : "");
        btn.textContent = String(t.name);
        applyGameDataHint(btn, hintEntity);
        btn.disabled = !on && (atCapAll || atCapW) && !techniqueXpBuy;
        if (techniqueXpBuy) {
          btn.title = `Spend ${techXp ?? 10} Experience for this Technique (beyond chargen budget)`;
        } else if (btn.disabled && !on) {
          const why =
            atCapAll && atCapW
              ? "Budget full — buy more on the Exp Leveling tab when you have enough XP."
              : atCapAll
                ? "Overall Technique budget for this step is full."
                : "This Working already has its chargen pick.";
          btn.title = btn.title ? `${btn.title}\n\n${why}` : why;
        }
        btn.addEventListener("click", () => toggleSorceryAdditionalTechnique(t.id));
        addRow.appendChild(btn);
      } else {
        const ref = document.createElement("span");
        ref.className = "chip sorc-technique-chip sorc-technique-chip--reference";
        ref.textContent = String(t.name);
        ref.setAttribute("tabindex", "0");
        applyGameDataHint(ref, hintEntity);
        addRow.appendChild(ref);
      }
    }
    sec.appendChild(addRow);
  }

  host.appendChild(sec);
}

/** @returns {string | null} */
function sorceryLineHeroAdditionalTechniquesBlockedReason() {
  const t = normalizedTierId(character.tier);
  if (t !== "sorcerer_hero" && t !== "sorcerer_demigod" && t !== "sorcerer_god") return null;
  ensureSorceryProfileShape();
  pruneSorceryAdditionalTechniques();
  const budget = sorceryAdditionalTechniqueBudgetTotal();
  const n = (character.sorceryProfile.additionalTechniqueIds || []).length;
  if (budget <= 0) return null;
  if (n < budget) {
    return `Sorcerer (Saints & Monsters pp. 65–66, 86): pick one additional Technique per Working on this tab (${n} / ${budget}).`;
  }
  return null;
}

/** Titanic Calling ids that have `sm_*` Knacks merged from the Saints & Monsters knacks fragment (S&M Ch. 4). */
const TITANIC_CALLING_IDS_SM_KNACKS = new Set(["adversary", "destroyer", "monster", "primeval", "tyrant"]);

function isMythosPantheonSelected() {
  return isMythosPantheonForCharacter(character, bundle);
}

/** MotM fourth Deed on Paths: only when pantheon is The Mythos (`mythos` in pantheons.json), not Dragon / Sorcerer line. */
function pathsStepShowsMythosDeedFields() {
  return (
    isMythosPantheonSelected() &&
    !isSorcererLineTier(character.tier) &&
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
  /** MotM: deity favored standard Callings also list the inverted twin (Sage → Cosmos). Inverted-only patrons (e.g. Cthulhu → Cosmos) stay as written. */
  if (isMythosPantheonSelected()) {
    const seen = new Set();
    const mapped = [];
    for (const cid of out) {
      const inverted = mythosPatronCallingIdForChooser(cid);
      if (inverted && bundle.callings?.[inverted] && !seen.has(inverted)) {
        seen.add(inverted);
        mapped.push(inverted);
      }
      if (bundle.callings?.[cid] && !seen.has(cid)) {
        seen.add(cid);
        mapped.push(cid);
      }
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
  return heroUsesCallingSlotRows(character);
}

/** True after Review → Advance from Mortal to Hero/Titanic: row-0 Calling must stay the Origin pick (dots may still move). */
function visitationLocksPrimaryCallingChoice() {
  const log = character.tierAdvancementLog;
  if (!Array.isArray(log)) return false;
  return log.some((e) => {
    const from = normalizedTierId(e?.fromTier);
    const to = normalizedTierId(e?.toTier);
    return from === "mortal" && (to === "hero" || to === "titanic");
  });
}

function syncCallingAggregatesFromHeroSlots() {
  const slots = character.callingSlots;
  if (!Array.isArray(slots) || slots.length !== HERO_CALLING_ROW_COUNT) return;
  character.callingId = String(slots[0]?.id || "").trim();
  const sum = slots.reduce((a, s) => a + Math.max(1, Math.min(5, Math.round(Number(s?.dots) || 1))), 0);
  const t = normalizedTierId(character.tier);
  const maxAgg = t === "hero" || t === "titanic" ? 5 : 15;
  character.callingDots = Math.max(1, Math.min(maxAgg, sum));
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
  const t = normalizedTierId(character.tier);
  if (t === "hero" || t === "titanic") {
    rebalanceHeroCallingSlotDotsOverFive();
  }
  syncCallingAggregatesFromHeroSlots();
}

/** When a patron is set but pantheon was cleared, infer pantheon from bundle (MotM knack gates, Paths UI). */
function syncPantheonFromParentDeity() {
  if (String(character?.pantheonId ?? "").trim()) return;
  const patron = String(character?.parentDeityId ?? "").trim();
  if (!patron || !bundle?.pantheons) return;
  const kind = String(character?.patronKind ?? "deity").trim() === "titan" ? "titans" : "deities";
  for (const [pid, pant] of Object.entries(bundle.pantheons)) {
    if (!pid || pid.startsWith("_") || !pant || typeof pant !== "object") continue;
    const rows = Array.isArray(pant[kind]) ? pant[kind] : [];
    if (rows.some((d) => d && String(d.id ?? "").trim() === patron)) {
      character.pantheonId = pid;
      return;
    }
  }
}

/** If the parent deity restricts Callings, ensure `character.callingId` is one of them. */
function syncCallingToParentDeity() {
  syncPantheonFromParentDeity();
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
    p.textContent = "Choose a pantheon to see its Virtues.";
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
 *
 * @param {{ pruneOrphanPatronExtras?: boolean }} [options]
 *   When true (divine parent change only), also drop another patron’s Asset Skills that are not required for
 *   the newly selected parent — e.g. Integrity after switching from Baron Samedi to Baron Cimetière. Do not
 *   run that prune on every Skills-step render or valid discretionary picks (Integrity as Cimetière’s third
 *   Skill) are incorrectly rejected.
 */
function ensureSocietyDefaultAssetSkills(options = {}) {
  if (isSorcererLineTier(character.tier)) return;
  const assets = societyPatronAssetSkillIds();
  if (!character.pantheonId || assets.length === 0 || assets.length > 3) return;
  const pantheonAssets = pantheonWideSocietyAssetSkillIds();
  const stalePantheonOnly = pantheonAssets.filter((id) => !assets.includes(id));
  let orphanPatronExtras = [];
  if (options.pruneOrphanPatronExtras === true) {
    orphanPatronExtras = patronAssetSkillsBeyondPantheonDefault(character.pantheonId).filter(
      (id) => !assets.includes(id),
    );
  }
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
  if (isSorcererLineTier(character.tier)) return { ok: true };
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
  if (soc.length === 3 && !isSorcererLineTier(character.tier)) {
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
 */
function appendPurviewInnateDetails(container, purviewId) {
  const mythos = isMythosPantheonSelected();
  const titanic = normalizedTierId(character.tier) === "titanic";
  const pid = String(purviewId ?? "").trim();
  const onParentList = patronPurviewOptionIds().includes(pid);
  const blocks = purviewInnateBlocks(bundle, pid, {
    mythosPantheon: mythos && onParentList,
    titanicTier: titanic,
  });
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

/** Line shown for each divine parent `<option>` (Callings + Purviews). */
function deityOptionLabel(deity) {
  const callingIds = Array.isArray(deity?.callings) ? deity.callings : [];
  const purviewIds = Array.isArray(deity?.purviews) ? deity.purviews : [];
  const callingLabels = callingIds.map((cid) => bundle.callings?.[cid]?.name || cid);
  const purviewLabels = purviewIds.map(purviewLabel);
  const parts = [];
  if (callingLabels.length) parts.push(`Callings: ${callingLabels.join(", ")}`);
  if (purviewLabels.length) parts.push(`Purviews: ${purviewLabels.join(", ")}`);
  if (!parts.length) return deity.name;
  return `${deity.name} — ${parts.join(" | ")}`;
}

/** Rich hover payload for a divine parent option (deities omit `description` in JSON). */
function deityDocEntity(deity) {
  const p = selectedPantheon();
  const callingNames = (deity.callings || []).map((cid) => bundle.callings[cid]?.name || cid).join(", ");
  const purviewNames = (deity.purviews || []).map((pid) => bundle.purviews[pid]?.name || pid).join(", ");
  const desc = [
    callingNames && `Callings: ${callingNames}.`,
    purviewNames && `Purviews: ${purviewNames}.`,
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

/** Tiers that may carry Hero-era Signature / patron Purview ids into Demigod+ saves. */
function tierAllowsSignaturePatronMigration() {
  const t = normalizedTierId(character.tier);
  return (
    t === "hero" ||
    t === "titanic" ||
    t === "demigod" ||
    t === "god" ||
    t === "sorcerer_hero" ||
    t === "sorcerer_demigod" ||
    t === "sorcerer_god"
  );
}

/** Hero Æsir: older saves stored Signature as `fortune`; migrate to `wyrd` when parent does not grant Fortune. */
function migrateAesirLegacyFortuneSignatureToWyrd() {
  if (!bundle?.purviews?.wyrd || !bundle?.pantheons?.aesir) return;
  if (!tierAllowsSignaturePatronMigration() || character.pantheonId !== "aesir") return;
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
  if (!tierAllowsSignaturePatronMigration()) return;
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

/** Purviews already on the sheet (and Relic hooks from Birthright picks), excluding automatic pantheon Signature. */
function characterPurviewsAlreadyAccessible() {
  const out = new Set();
  for (const id of character.purviewIds || []) {
    if (typeof id === "string" && id.trim()) out.add(id.trim());
  }
  for (const s of character.patronPurviewSlots || []) {
    if (typeof s === "string" && s.trim()) out.add(s.trim());
  }
  ensureFinishingShape();
  for (const bid of [
    ...(character.finishing?.birthrightPicks || []),
    ...(character.experienceBirthrightPickIds || []),
  ]) {
    const br = bundle.birthrights?.[bid];
    const pv = br?.relicDetails?.purviewId;
    if (typeof pv === "string" && pv.trim()) out.add(pv.trim());
  }
  const sig = pantheonSignaturePurviewId();
  if (sig) out.delete(sig);
  return out;
}

/** Demigod+ innate slot options: parent list plus Purviews the character already holds. */
function patronPurviewSlotOptionIds() {
  const parent = patronPurviewOptionIds();
  const have = characterPurviewsAlreadyAccessible();
  const merged = new Set([...parent, ...have]);
  return [...merged]
    .filter((id) => bundle.purviews?.[id] && typeof bundle.purviews[id] === "object")
    .sort((a, b) => purviewLabel(a).localeCompare(purviewLabel(b), undefined, { sensitivity: "base" }));
}

/**
 * Universal Purview ids that are also used as a pantheon’s `signaturePurviewId` “skin” (still on the universal list for Demigod+).
 * @see Scion: Demigod (Purviews / Specialty treatment); Mythic Shards cross-references.
 */
const PURVIEW_IDS_UNIVERSAL_EVEN_IF_PANTHEON_SIG = new Set(["order", "passion", "sun", "wild"]);

/** Collect every `signaturePurviewId` from `pantheons.json` ( Specialty Purviews from other pantheons are not free picks at Demigod+ ). */
function allPantheonSignaturePurviewIdSet() {
  const s = new Set();
  const pants = bundle?.pantheons;
  if (!pants || typeof pants !== "object") return s;
  for (const [k, v] of Object.entries(pants)) {
    if (String(k).startsWith("_") || !v || typeof v !== "object") continue;
    const id = typeof v.signaturePurviewId === "string" ? v.signaturePurviewId.trim() : "";
    if (id) s.add(id);
  }
  return s;
}

/**
 * Purview ids that may appear as optional chips on the Purviews step at Demigod / God (and Sorcerer Demigod / God): standard universals,
 * your pantheon’s Signature, and Sorcerer-line Magic — not Denizen-only rows or another pantheon’s dedicated Signature Purview.
 */
function demigodTierPurviewChipSelectable(pid) {
  const row = bundle?.purviews?.[pid];
  if (!row || typeof row !== "object") return false;
  if (row.denizenPurview === true) return false;
  if (isSorcererLineTier(character.tier) && pid === "magic") return true;
  if (row.denizenOrSorcery === true) return false;

  const mySig = pantheonSignaturePurviewId();
  const allSig = allPantheonSignaturePurviewIdSet();
  if (allSig.has(pid)) {
    if (pid === mySig) return true;
    if (PURVIEW_IDS_UNIVERSAL_EVEN_IF_PANTHEON_SIG.has(pid)) return true;
    return false;
  }
  return true;
}

/** Drop Demigod+ `purviewIds` extras that violate Specialty / Denizen access; keeps patron slot picks. */
function restrictDemigodGodPurviewExtrasToLegal() {
  const tn = normalizedTierId(character.tier);
  if (tn !== "demigod" && tn !== "god" && tn !== "sorcerer_demigod" && tn !== "sorcerer_god") return;
  ensurePatronPurviewSlots();
  normalizePatronPurviewSlotsNoDuplicates();
  const picks = character.patronPurviewSlots.filter(Boolean);
  const pickSet = new Set(picks);
  const extras = (character.purviewIds || []).filter((id) => id && !pickSet.has(id));
  const legal = extras.filter((id) => demigodTierPurviewChipSelectable(id));
  const merged = [...new Set([...picks, ...legal])];
  const sig = pantheonSignaturePurviewId();
  if (sig && !merged.includes(sig)) merged.push(sig);
  character.purviewIds = merged;
}

/** Display sort key for Purview chips (pantheon Specialty labels where applicable). */
function purviewChipSortLabel(pid, p) {
  return (
    purviewDisplayNameForPantheon(pid, bundle, character.pantheonId) ||
    (p && typeof p === "object" && typeof p.name === "string" ? p.name : "") ||
    purviewLabel(pid)
  );
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
  const allowed = new Set(patronPurviewSlotOptionIds());
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

/** Drop duplicate patron Purview ids, keeping earliest filled slots (Demigod+ slot order). */
function normalizePatronPurviewSlotsNoDuplicates() {
  ensurePatronPurviewSlots();
  const lim = Math.max(0, Math.min(PATRON_PURVIEW_SLOT_COUNT, patronPurviewSlotLimitForCharacter()));
  const seen = new Set();
  character.patronPurviewSlots = character.patronPurviewSlots.map((s, i) => {
    if (i >= lim) return "";
    if (!s) return "";
    if (seen.has(s)) return "";
    seen.add(s);
    return s;
  });
}

/** Merge patron slots into `purviewIds`. Hero: one parent innate + pantheon Signature; other tiers: picks then extras. */
function syncPurviewIdsFromPatronSlots() {
  ensurePatronPurviewSlots();
  normalizePatronPurviewSlotsNoDuplicates();
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
  const merged = [...picks, ...extras];
  const demigodLikeSync =
    tn === "demigod" || tn === "god" || tn === "sorcerer_demigod" || tn === "sorcerer_god";
  if (demigodLikeSync) {
    const sig = pantheonSignaturePurviewId();
    if (sig && !merged.includes(sig)) merged.push(sig);
  }
  character.purviewIds = merged;
}

/** After pantheon / divine parent change: drop invalid patron picks and re-merge `purviewIds`. */
function onPatronPurviewContextChange() {
  ensurePatronPurviewSlots();
  const allowed = new Set(patronPurviewSlotOptionIds());
  character.patronPurviewSlots = character.patronPurviewSlots.map((s) => (allowed.has(s) ? s : ""));
  hydratePatronPurviewSlotsFromPurviewIds();
  syncPurviewIdsFromPatronSlots();
  restrictDemigodGodPurviewExtrasToLegal();
}

function commitPatronPurviewSlotChange(slotIndex, newVal) {
  ensurePatronPurviewSlots();
  const slots = [...character.patronPurviewSlots];
  const old = slots[slotIndex];
  if (newVal === old) return;
  slots[slotIndex] = newVal;
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
  const parentOpts = patronPurviewOptionIds();
  const opts = patronPurviewSlotOptionIds();
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
  if (parentOpts.length === 0 && opts.length === 0) {
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
      "This tier does not use patron Purview slots from a divine parent’s list — choose Purviews (including Magic for Sorcerers) with the chips on this step.";
    panel.appendChild(p);
    mount.appendChild(panel);
    applyHint(panel, "patron-purviews");
    return;
  }
  const intro = document.createElement("p");
  intro.className = "help";
  if (patronPurviewSingleSlotHeroStyle()) {
    const sig = pantheonSignaturePurviewId();
    const sigLab = sig ? pantheonSignaturePurviewDisplayLabel() : "— (set pantheon in data)";
    const tierPv = normalizedTierId(character.tier);
    const tierLab = tierPv === "titanic" ? "Titanic (Hero-tier)" : tierPv === "hero" ? "Hero" : bundle.tier?.[character.tier]?.name || "this tier";
    intro.innerHTML = `At <strong>${tierLab}</strong>, pick <strong>one patron innate Purview</strong> from this parent’s list below — <strong>two innate Purviews</strong> total with your pantheon’s automatic <strong>Signature</strong> (<strong>${sigLab}</strong>). You do not spend your single pick on Signature.`;
  } else {
    const tierNorm = normalizedTierId(character.tier);
    const isGodBand = tierNorm === "god" || tierNorm === "sorcerer_god";
    const bandNote = isGodBand
      ? "<strong>four innate Purviews</strong> total (Signature + three patron slots) — same as Demigod; at God, further Purviews grow through <strong>Boons and Dominion</strong> in play (track with chips below)"
      : "<strong>four innate Purviews</strong> total (Signature + three patron slots: Hero pick + two more at Demigod advancement)";
    intro.innerHTML = `Assign <strong>${slotLim}</strong> patron innate slot(s) for ${bandNote}. Each may be any Purview your <strong>divine parent</strong> possesses or any Purview you <strong>already hold</strong> (Birthrights, Relics, prior picks).`;
  }
  panel.appendChild(intro);
  const grid = document.createElement("div");
  grid.className = "patron-purviews-slot-grid";
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
    const curSlot = character.patronPurviewSlots[i] || "";
    const takenElsewhere = new Set(
      character.patronPurviewSlots.map((v, j) => (j !== i && v ? v : null)).filter(Boolean),
    );
    for (const pid of opts) {
      if (takenElsewhere.has(pid) && pid !== curSlot) continue;
      const pv = bundle.purviews?.[pid];
      if (pv && !isEntryVisibleForBooks(pv, allowedBooks)) continue;
      const o = document.createElement("option");
      o.value = pid;
      o.textContent = purviewLabel(pid);
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
      appendPurviewInnateDetails(innateBox, slotPid);
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

/** Physical / Mental / Social panels: same order as the three arena priority pulldowns. */
function arenaRankForDisplay() {
  const r = character?.arenaRank;
  if (Array.isArray(r) && r.length === 3 && new Set(r).size === 3 && r.every((a) => a && ARENAS[a])) {
    return r;
  }
  return [...ARENA_ORDER];
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

/** XP Attribute dots in one arena (post-chargen; not counted toward Finishing or 6/4/2 pools). */
function experienceArenaExtraDelta(arena) {
  let d = 0;
  for (const id of ARENAS[arena]) {
    d += experienceAttributeBumpCount(character, id);
  }
  return d;
}

/** Pre–Favored chargen dots above the Attributes-step snapshot in one arena (Finishing only; excludes XP). */
function finishingArenaExtraDelta(attrs, baseline, arena) {
  if (!baseline || typeof baseline !== "object") return 0;
  let d = 0;
  for (const id of ARENAS[arena]) {
    const total = Math.max(0, (attrs[id] ?? 1) - (baseline[id] ?? 1));
    d += Math.max(0, total - experienceAttributeBumpCount(character, id));
  }
  return d;
}

/** Pre–Favored chargen bump on one Attribute above `attrBaseline` (Finishing only; excludes XP). */
function chargenOnlyAttributeBump(attrId, attrs, baseline) {
  if (!baseline || typeof baseline !== "object") return 0;
  const total = Math.max(0, (attrs[attrId] ?? 1) - (baseline[attrId] ?? 1));
  return Math.max(0, total - experienceAttributeBumpCount(character, attrId));
}

function arenaForAttribute(attrId) {
  for (const arena of ARENA_ORDER) {
    if (ARENAS[arena].includes(attrId)) return arena;
  }
  return null;
}

/**
 * Max rating (1–5) for this attribute given siblings in the same arena and current 6/4/2 pool.
 * When a Finishing Attribute dot sits in this arena, the allowed extra-dot total is pool + that bump
 * (Origin p. 98 — same flex as `normalizeCharacterAttributesToPools` / `attributeArenaPoolsSpendOk`).
 */
function maxAttrRatingForArena(attrId, attrs) {
  const arena = arenaForAttribute(attrId);
  if (!arena) return 5;
  const pool = arenaPools()[arena];
  const baseline = character.finishing?.attrBaseline;
  const finD =
    baseline && typeof baseline === "object"
      ? finishingArenaExtraDelta(character.attributes, baseline, arena)
      : 0;
  const xpD = !isOriginPlayTier(character.tier) ? experienceArenaExtraDelta(arena) : 0;
  let others = 0;
  for (const oid of ARENAS[arena]) {
    if (oid === attrId) continue;
    others += Math.max(0, (attrs[oid] ?? 1) - 1);
  }
  return Math.max(1, Math.min(5, 1 + pool + finD + xpD - others));
}

/** Max dots after Favored Approach (+2 to approach Attributes, cap 5) for UI and clicking. */
function maxFinalRatingForAttr(attrId, attrsPre) {
  const preMax = maxAttrRatingForArena(attrId, attrsPre);
  const fav = resolvedFavoredApproach();
  if (APPROACH_ATTRS[fav].includes(attrId)) return Math.min(5, preMax + 2);
  return preMax;
}

/**
 * Dot row: always 5 positions; `value` / fills use final ratings (post–Favored Approach).
 * @param {number | null} [lockedFinalThrough] When set (e.g. Finishing), filled dots with index <= this value use a darker fill so dots above show the new finishing bump only.
 * @param {boolean} [readOnly] When true (Hero+ / post–Hatchling Dragon), dots are display-only unless `experienceUnlock`.
 * @param {boolean} [experienceUnlock] When true with readOnly, allow +1 dot purchases with Experience (Origin p. 113).
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
  readOnly = false,
  experienceUnlock = false,
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
  const attrXpCost = experiencePurchaseCost(bundle, "attribute");
  const canRaiseAttr = experienceUnlock && experienceCanAfford(character, bundle, "attribute");
  for (let i = 1; i <= 5; i += 1) {
    const b = document.createElement("button");
    b.type = "button";
    let allowed = !readOnly && i >= minFinal && i <= maxFinal;
    const xpRaise = readOnly && experienceUnlock && canRaiseAttr && i === shown + 1 && i <= maxFinal;
    if (xpRaise) allowed = true;
    b.disabled = !allowed;
    let cls = "dot" + (i <= shown ? " filled" : "") + (allowed ? (xpRaise ? " dot-experience-unlock" : "") : " dot-capped");
    if (lockedCut != null && i <= shown && i <= lockedCut) cls += " dot-finishing-locked-fill";
    b.className = cls;
    b.setAttribute("aria-label", `${label} ${i} of 5${ariaSuffix ? ` ${ariaSuffix}` : ""}`);
    if (allowed) {
      if (xpRaise) {
        b.title = `Spend ${attrXpCost} Experience to raise ${label}`;
        b.addEventListener("click", () => {
          if (!experienceSpend(character, bundle, "attribute", `${label} +1`)) return;
          if (attrMeta?.id) recordExperienceAttributeBump(character, attrMeta.id);
          onPickFinal(i);
        });
      } else {
        b.addEventListener("click", () => onPickFinal(i));
      }
    }
    dots.appendChild(b);
  }
  row.appendChild(lab);
  row.appendChild(dots);
  return row;
}

/**
 * Mortal / Mortal-band Sorcerer / Dragon Hatchling: Path Skills, Attributes, and related layout stay editable.
 * Higher tiers: editable when building fresh (path skills not yet assigned), locked once configured.
 * This prevents editing skills after tier advancement while allowing fresh higher-tier builds.
 */
function postOriginMortalChargenLocked(character) {
  if (isDragonHeirChargen(character)) return dragonHeirAttributesCoreLayoutLocked(character);
  const t = normalizedTierId(character.tier);
  if (t === "mortal" || t === "sorcerer") return false;
  if (Array.isArray(character.tierAdvancementLog) && character.tierAdvancementLog.length > 0) return true;
  // At higher tiers, lock only if path skills have already been configured
  const ps = character.pathSkills;
  if (!ps || typeof ps !== "object") return false;
  const hasSkills = PATH_KEYS.some((pk) => Array.isArray(ps[pk]) && ps[pk].length > 0);
  return hasSkills;
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
  if (!isOriginPlayTier(character.tier)) return;
  if (postOriginMortalChargenLocked(character) || experienceAttributeBumpsTotal(character) > 0) return;
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
        pool +
        (baseIsObj && baseLine ? finishingArenaExtraDelta(attrs, baseLine, arena) : 0) +
        experienceArenaExtraDelta(arena);
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
        continue;
      }
      attrs[hi] -= 1;
      sum -= 1;
    }
  }
}

function applyFavoredApproach(baseAttrs) {
  const out = { ...baseAttrs };
  const fav = resolvedFavoredApproach();
  for (const id of APPROACH_ATTRS[fav]) {
    out[id] = (out[id] ?? 1) + 2;
  }
  for (const id of Object.keys(out)) {
    if (out[id] > 5) out[id] = 5;
  }
  return out;
}

/** True when each arena’s extra-dot sum is within its Attributes-step pool, plus allowed Finishing bumps (Origin pp. 97–98). */
function attributeArenaPoolsSpendOk(attrs) {
  if (postOriginMortalChargenLocked(character)) return true;
  const pools = arenaPools();
  const sums = attributeArenaSums(attrs);
  const baseline = character.finishing?.attrBaseline;
  const hasB = baseline && typeof baseline === "object";
  for (const arena of ARENA_ORDER) {
    const s = sums[arena];
    const p = pools[arena];
    const finDelta = hasB ? finishingArenaExtraDelta(attrs, baseline, arena) : 0;
    const xpDelta = experienceArenaExtraDelta(arena);
    if (s < p || s > p + finDelta + xpDelta) return false;
  }
  return true;
}

function validateAttributes(attrs) {
  if (postOriginMortalChargenLocked(character)) {
    const msgs = [];
    for (const id of Object.keys(bundle.attributes)) {
      if (String(id).startsWith("_")) continue;
      const v = attrs[id];
      if (v < 1 || v > 5) msgs.push(`${id} must stay between 1 and 5 before applying Favored Approach.`);
    }
    return msgs;
  }
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
      totalFinishingAttrBump += chargenOnlyAttributeBump(aid, attrs, baseline);
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
    const xpDelta = experienceArenaExtraDelta(arena);
    if (s > p + finDelta + xpDelta) {
      msgs.push(
        `${arena} arena: at most ${p} extra dots from the Attributes step, plus up to ${finDelta} from your Finishing Attribute dot(s) in this arena (you have ${s}; Origin pp. 97–98).`,
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
  if (!wizardIncludesFinishingTouchesStep(character.tier)) {
    f.extraSkillDots = 0;
    f.extraAttributeDots = 0;
    f.skillBaseline = null;
    f.attrBaseline = null;
    /** Do not clear `finishingKnackIds`: Hero+ may hold Origin-carried bonus Knacks here until Visitation rows can absorb them into `knackIds` (see `mergeFinishingBonusKnacksIntoMainKnackList`). */
    /** Hero+ etc. use the Birthrights step without a Finishing step; picks still live under `finishing.birthrightPicks`. */
    if (!stepDefsForTier(character.tier).includes("birthrights")) {
      f.birthrightPicks = [];
    }
  } else {
    if (f.extraSkillDots == null) f.extraSkillDots = 5;
    if (f.extraAttributeDots == null) f.extraAttributeDots = 1;
  }
  if (!f.knackOrBirthright) f.knackOrBirthright = "knacks";
  if (!Array.isArray(f.finishingKnackIds)) f.finishingKnackIds = [];
  else
    f.finishingKnackIds = [...new Set(f.finishingKnackIds.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")))];
  if (!Array.isArray(f.birthrightPicks)) f.birthrightPicks = [];
  if (f.fatebindingEditorIndex == null || Number.isNaN(Number(f.fatebindingEditorIndex))) f.fatebindingEditorIndex = 0;
  else f.fatebindingEditorIndex = Math.max(0, Math.round(Number(f.fatebindingEditorIndex)));

  const tFin = normalizedTierId(character.tier);
  if (tFin === "sorcerer") {
    const validPkg = new Set(["two_techniques", "four_paraphernalia", "one_technique_two_paraphernalia"]);
    let pkg = String(f.sorcererMortalFinishingPackage || "").trim();
    if (!validPkg.has(pkg)) {
      if (f.knackOrBirthright === "knacks" && (f.finishingKnackIds || []).length >= 2) {
        pkg = "two_techniques";
        f.sorcererMortalFinishingPackage = pkg;
        const names = (f.finishingKnackIds || []).map((id) => bundle?.knacks?.[id]?.name || id).join("; ");
        const prev = String(f.sorcererMortalExtraTechniquesNotes || "").trim();
        f.sorcererMortalExtraTechniquesNotes = [
          prev,
          names
            ? `Imported save used two extra Finishing Knacks (${names}). Per Saints & Monsters p. 87, Mortal Sorcerers take two additional Techniques here — replace this note with your Technique descriptions.`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n");
      } else {
        f.sorcererMortalFinishingPackage = "four_paraphernalia";
      }
    } else {
      f.sorcererMortalFinishingPackage = pkg;
    }
    if (typeof f.sorcererMortalExtraTechniquesNotes !== "string") f.sorcererMortalExtraTechniquesNotes = "";
    f.finishingKnackIds = [];
    f.knackOrBirthright = "birthrights";
  }
}

/** Snapshot for “finishing” budget: call when leaving Skills (Path + dot totals). */
function captureFinishingSkillBaseline() {
  if (!wizardIncludesFinishingTouchesStep(character.tier)) return;
  ensureFinishingShape();
  ensureSkillDots();
  if (character.finishing.skillBaseline && typeof character.finishing.skillBaseline === "object") {
    return;
  }
  character.finishing.skillBaseline = pathOnlySkillDotsMap();
}

/** Sum of positive per-attribute deltas from `from` → `to` (pre–Favored ratings). */
function sumPositiveAttributeDeltas(from, to) {
  let s = 0;
  for (const id of Object.keys(bundle.attributes)) {
    if (String(id).startsWith("_")) continue;
    s += Math.max(0, (to[id] ?? 1) - (from[id] ?? 1));
  }
  return s;
}

/**
 * Snapshot when leaving Attributes (pre–Favored Approach ratings).
 * @param {{ bakeTierAdvance?: boolean }} [options] Pass `{ bakeTierAdvance: true }` after tier advance: keep
 * `character.attributes` as-is (still includes Finishing bumps) but refresh `attrBaseline` to the Attributes-step
 * map only — Finishing bumps stay outside the snapshot so arena pool checks (Origin p. 97) stay valid.
 */
function captureFinishingAttrBaseline(options = {}) {
  if (!wizardIncludesFinishingTouchesStep(character.tier)) return;
  ensureFinishingShape();
  const cur = {};
  for (const id of Object.keys(bundle.attributes)) {
    if (String(id).startsWith("_")) continue;
    cur[id] = character.attributes[id] ?? 1;
  }
  if (options.bakeTierAdvance === true) {
    /**
     * Tier advance must not fold Finishing Attribute dot(s) into `attrBaseline`: validation and
     * `finishingArenaExtraDelta` expect the snapshot to match Origin p. 97 arena pools only,
     * with pp. 97–98 finishing bumps tracked as current − baseline (Hero→Demigod etc.).
     */
    const prev = character.finishing.attrBaseline;
    if (prev && typeof prev === "object") {
      const finPlaced = finishingAttrDotsPlaced();
      if (finPlaced > 0) {
        const step = { ...cur };
        for (const id of Object.keys(bundle.attributes)) {
          if (String(id).startsWith("_")) continue;
          const bump = Math.max(0, (cur[id] ?? 1) - (prev[id] ?? 1));
          if (bump > 0) step[id] = (cur[id] ?? 1) - bump;
        }
        character.finishing.attrBaseline = step;
        return;
      }
    }
    character.finishing.attrBaseline = cur;
    return;
  }
  const prev = character.finishing.attrBaseline;
  if (!prev || typeof prev !== "object") {
    character.finishing.attrBaseline = cur;
    return;
  }
  const placedGains = sumPositiveAttributeDeltas(prev, cur);
  const budget = Math.max(0, Math.round(Number(character.finishing.extraAttributeDots) || 0));
  const finPlaced = finishingAttrDotsPlaced();
  if (finPlaced === 0) {
    character.finishing.attrBaseline = cur;
    return;
  }
  if (placedGains === budget && finPlaced === budget && budget > 0) {
    let strip = budget;
    const next = { ...cur };
    const ids = Object.keys(bundle.attributes)
      .filter((id) => !String(id).startsWith("_"))
      .sort(
        (a, b) =>
          Math.max(0, (cur[b] ?? 1) - (prev[b] ?? 1)) - Math.max(0, (cur[a] ?? 1) - (prev[a] ?? 1)),
      );
    for (const id of ids) {
      const gain = Math.max(0, (cur[id] ?? 1) - (prev[id] ?? 1));
      if (gain <= 0 || strip <= 0) continue;
      const take = Math.min(gain, strip);
      next[id] = (next[id] ?? 1) - take;
      strip -= take;
    }
    if (strip !== 0) return;
    character.finishing.attrBaseline = next;
    return;
  }
  /* Pool edits while a finishing bump is invested: do not fold the bump into the snapshot (would make normalize strip it). */
}

/**
 * After tier advance on Hero+ (no Finishing step): snapshot pre–Favored ratings for pool math,
 * excluding Experience Attribute bumps (they stay in `character.attributes` only).
 */
function captureAttrBaselineAfterTierAdvanceExcludingXp() {
  if (wizardIncludesFinishingTouchesStep(character.tier)) {
    captureFinishingAttrBaseline({ bakeTierAdvance: true });
    return;
  }
  ensureFinishingShape();
  const o = {};
  for (const id of Object.keys(bundle.attributes)) {
    if (String(id).startsWith("_")) continue;
    const cur = Math.max(1, Math.min(5, Math.round(Number(character.attributes[id] ?? 1))));
    const xp = experienceAttributeBumpCount(character, id);
    o[id] = Math.max(1, Math.min(5, cur - xp));
  }
  character.finishing.attrBaseline = o;
}

/**
 * If tier advance once copied full `attributes` into `attrBaseline`, Finishing dot(s) sit inside the “snapshot” and
 * `finishingAttrDotsPlaced()` is 0 because baseline === attributes. Drop baseline only (highest rating per overfull
 * arena) until each arena matches its 6/4/2 pool so validation and Mental-dot UI match again.
 */
function repairAttrBaselineIfFinishingWasFoldedIntoSnapshot() {
  const baseline = character.finishing?.attrBaseline;
  if (!baseline || typeof baseline !== "object" || !bundle?.attributes) return;
  const attrs = character.attributes;
  if (!attrs || typeof attrs !== "object") return;
  if (finishingAttrDotsPlaced() > 0) return;
  const pools = arenaPools();
  const baseSums = attributeArenaSums(baseline);
  let over = false;
  for (const arena of ARENA_ORDER) {
    if (baseSums[arena] > pools[arena]) over = true;
  }
  if (!over) return;
  for (const id of Object.keys(bundle.attributes)) {
    if (String(id).startsWith("_")) continue;
    if ((attrs[id] ?? 1) !== (baseline[id] ?? 1)) return;
  }
  const b = { ...baseline };
  for (const arena of ARENA_ORDER) {
    let excess = attributeArenaSums(b)[arena] - pools[arena];
    while (excess > 0) {
      let pick = null;
      let pickV = -Infinity;
      for (const id of ARENAS[arena]) {
        const v = b[id] ?? 1;
        if (v <= 1) continue;
        if (v > pickV) {
          pickV = v;
          pick = id;
        }
      }
      if (!pick) break;
      b[pick] = (b[pick] ?? 1) - 1;
      excess -= 1;
    }
  }
  const after = attributeArenaSums(b);
  for (const arena of ARENA_ORDER) {
    if (after[arena] !== pools[arena]) return;
  }
  character.finishing.attrBaseline = b;
}

function ensureFinishingBaselines() {
  ensureFinishingShape();
  if (!wizardIncludesFinishingTouchesStep(character.tier)) return;
  if (!character.finishing.skillBaseline) {
    ensureSkillDots();
    ensurePathSkillArrays();
    const po = pathOnlySkillDotsMap();
    character.finishing.skillBaseline = { ...po };
    for (const sid of skillIds()) {
      character.skillDots[sid] = Math.max(character.skillDots[sid] || 0, po[sid] || 0);
    }
  }
  if (!character.finishing.attrBaseline) {
    const b = {};
    for (const id of Object.keys(bundle.attributes)) {
      b[id] = character.attributes[id] ?? 1;
    }
    character.finishing.attrBaseline = b;
  }
  repairAttrBaselineIfFinishingWasFoldedIntoSnapshot();
}

function finishingSkillDotsPlaced() {
  const b = character.finishing.skillBaseline;
  if (!b) return 0;
  return skillIds().reduce((sum, id) => {
    const total = Math.max(0, (character.skillDots[id] || 0) - (b[id] || 0));
    return sum + Math.max(0, total - experienceSkillBumpCount(character, id));
  }, 0);
}

function finishingSkillDotsRemaining() {
  return Math.max(0, (character.finishing.extraSkillDots || 0) - finishingSkillDotsPlaced());
}

function maxSkillFinishing(sid) {
  const b = character.finishing.skillBaseline;
  if (!b) return Math.min(5, character.skillDots[sid] || 0);
  const placedOthers = skillIds()
    .filter((id) => id !== sid)
    .reduce((sum, id) => {
      const total = Math.max(0, (character.skillDots[id] || 0) - (b[id] || 0));
      return sum + Math.max(0, total - experienceSkillBumpCount(character, id));
    }, 0);
  const cap = (b[sid] || 0) + Math.max(0, (character.finishing.extraSkillDots || 0) - placedOthers);
  return Math.min(5, cap);
}

function finishingAttrDotsPlaced() {
  const b = character.finishing.attrBaseline;
  if (!b) return 0;
  return Object.keys(bundle.attributes).reduce((sum, id) => {
    if (String(id).startsWith("_")) return sum;
    return sum + chargenOnlyAttributeBump(id, character.attributes, b);
  }, 0);
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
    .reduce((s, oid) => s + chargenOnlyAttributeBump(oid, attrs, b), 0);
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

/** Path + redistribution Skill dots for the Skills step only (excludes Finishing Skill dots), for read-only display. */
function skillsStepDotsForSkillsTab(sid) {
  const b = character.finishing?.skillBaseline;
  if (b && typeof b === "object") {
    return Math.max(0, Math.min(5, Math.round(Number(b[sid]) || 0)));
  }
  return character.skillDots[sid] || 0;
}

/** Pre–Favored ratings for the Attributes step only (excludes Finishing Attribute dot), for UI + export staging. */
function attributesStepPreFavoredForAttributesTab() {
  const b = character.finishing?.attrBaseline;
  if (b && typeof b === "object") {
    const o = {};
    for (const id of Object.keys(bundle.attributes)) {
      if (String(id).startsWith("_")) continue;
      const v = Math.round(Number(b[id]));
      o[id] = Number.isFinite(v) ? Math.max(1, Math.min(5, v)) : (character.attributes[id] ?? 1);
    }
    return o;
  }
  const o = {};
  for (const id of Object.keys(bundle.attributes)) {
    if (String(id).startsWith("_")) continue;
    o[id] = character.attributes[id] ?? 1;
  }
  return o;
}

/** Attributes tab display: Hero+ shows full stored ratings (arena + Finishing + Experience), not the Attributes-step snapshot. */
function attributesDisplayPreFavoredForAttributesTab() {
  if (!isOriginPlayTier(character.tier)) {
    const o = {};
    for (const id of Object.keys(bundle.attributes)) {
      if (String(id).startsWith("_")) continue;
      o[id] = character.attributes[id] ?? 1;
    }
    return o;
  }
  return attributesStepPreFavoredForAttributesTab();
}

/** Skill ids at 3+ dots missing a chargen Specialty (Finishing / Review gate). */
function skillIdsMissingChargenSpecialties() {
  ensureSkillDots();
  const out = [];
  for (const sid of skillIds()) {
    if (!skillNeedsFreeChargenSpecialty(sid)) continue;
    out.push(sid);
  }
  return out;
}

/** Skill dots from chargen only (Path + Finishing; excludes Experience purchases). */
function chargenOnlySkillDots(sid) {
  ensureSkillDots();
  const cur = character.skillDots[sid] || 0;
  return Math.max(0, cur - experienceSkillBumpCount(character, sid));
}

/** Free chargen Specialty still owed on this skill (Hero+ tiers without a Finishing step). */
function skillNeedsFreeChargenSpecialty(sid) {
  ensureSkillDots();
  return chargenOnlySkillDots(sid) >= 3 && !String(character.skillSpecialties?.[sid] || "").trim();
}

/** @param {string} wherePhrase e.g. "before leaving Finishing" or "before continuing to Review" */
function skillsNeedSpecialtyChargenBlockReason(wherePhrase) {
  const miss = skillIdsMissingChargenSpecialties();
  if (miss.length === 0) return null;
  const nm = bundle.skills?.[miss[0]]?.name || miss[0];
  const stepsNav = stepDefsForTier(character.tier);
  const where =
    wherePhrase.includes("Review") && !stepsNav.includes("finishing")
      ? "on the Attributes step before continuing to Review"
      : wherePhrase;
  if (miss.length === 1) {
    return `${nm} is at 3 or more dots — add a free chargen Specialty ${where} (Origin pp. 59–60, 97).`;
  }
  return `${miss.length} Skills are at 3 or more dots without a Specialty — add free chargen Specialties ${where} (Origin pp. 59–60, 97).`;
}

/**
 * Wizard steps that still need user action (nav tab highlight + tooltip).
 * @returns {Map<string, string>}
 */
function wizardStepsNeedingAttention() {
  /** @type {Map<string, string>} */
  const out = new Map();
  const steps = stepDefsForTier(character.tier);
  const add = (id, msg) => {
    if (steps.includes(id) && msg) out.set(id, msg);
  };
  if (isDragonHeirChargen(character)) return out;

  const missSpec = skillIdsMissingChargenSpecialties();
  if (missSpec.length > 0) {
    const specMsg =
      missSpec.length === 1
        ? `Add a free chargen Specialty for ${bundle.skills?.[missSpec[0]]?.name || missSpec[0]}`
        : `Add free chargen Specialties for ${missSpec.length} Skills at 3+ dots`;
    if (steps.includes("finishing")) add("finishing", specMsg);
    else add("attributes", specMsg);
  }

  if (pathsStepRequiresPantheonAndParent() && !pathsPantheonAndParentSatisfiedOnCharacter()) {
    add("paths", "Choose a pantheon and divine parent");
  }

  ensurePathSkillArrays();
  applyPathMathToSkillDots();
  const pathGate = validateAllPathSkillsDetailed();
  if (!pathGate.ok) {
    add("skills", pathGate.issues[0]?.message || "Fix Path Skills before continuing");
  } else if (pathSkillOverflowDotsPending() > 0) {
    add("skills", `Redistribute ${pathSkillOverflowDotsPending()} Path overflow dot(s)`);
  }

  const pvBlock = heroPurviewsPatronPickRequiredAndMissing();
  if (pvBlock) add("purviews", pvBlock);

  const sorcBlock = sorceryLineHeroAdditionalTechniquesBlockedReason();
  if (sorcBlock) add("sorcerer", sorcBlock);

  if (steps.includes("finishing")) {
    const finBlock = finishingStepLeaveBlockedReason();
    if (finBlock) {
      const short = finBlock.split("\n")[0];
      if (!out.has("finishing")) add("finishing", short);
    }
  }

  return out;
}

/** @param {HTMLButtonElement} nextBtn @param {string} step */
function applyWizardNextButtonGate(nextBtn, step) {
  nextBtn.disabled = false;
  nextBtn.removeAttribute("title");
  if (step === "purviews") {
    const pvBlock = heroPurviewsPatronPickRequiredAndMissing();
    if (pvBlock) {
      nextBtn.disabled = true;
      nextBtn.title = pvBlock;
      return;
    }
  }
  if (step === "paths" && pathsStepRequiresPantheonAndParent() && !pathsPantheonAndParentSatisfiedOnCharacter()) {
    nextBtn.disabled = true;
    nextBtn.title = "Choose a pantheon and a parent before continuing.";
    return;
  }
  if (step === "finishing") {
    const finBlock = finishingStepLeaveBlockedReason();
    if (finBlock) {
      nextBtn.disabled = true;
      nextBtn.title = finBlock;
      return;
    }
  }
  if (step === "sorcerer") {
    const sorcHeroTech = sorceryLineHeroAdditionalTechniquesBlockedReason();
    if (sorcHeroTech) {
      nextBtn.disabled = true;
      nextBtn.title = sorcHeroTech;
      return;
    }
  }
  const reviewSpec = reviewAdvanceSpecialtyBlockIfApplicable(step);
  if (reviewSpec) {
    nextBtn.disabled = true;
    nextBtn.title = reviewSpec;
  }
}

/** Refresh nav highlights and Next gate after inline edits (specialties, etc.) without a full render. */
function refreshWizardAttentionUiFromDom() {
  const steps = stepDefsForTier(character.tier);
  const step = steps[stepIndex];
  if (step === "attributes" || step === "finishing" || step === "skills") persistSkillSpecialtiesFromForm();
  const attention = wizardStepsNeedingAttention();
  const nav = document.getElementById("wizard-nav");
  if (nav) {
    nav.querySelectorAll("button").forEach((btn, idx) => {
      const id = steps[idx];
      if (!id) return;
      const needs = attention.has(id);
      btn.classList.toggle("needs-attention", needs);
      if (needs) btn.title = attention.get(id) || "Action needed on this step";
      else if (!btn.classList.contains("active")) btn.removeAttribute("title");
    });
  }
  const nextBtn = document.querySelector(".step-actions .btn.primary");
  if (nextBtn && nextBtn.textContent.trim() === "Next") applyWizardNextButtonGate(nextBtn, step);
}

/** When the wizard has no Finishing step, free chargen Specialties (Skill ≥3) are enforced before Review instead. */
function reviewAdvanceSpecialtyBlockIfApplicable(fromStep) {
  const stepsNav = stepDefsForTier(character.tier);
  const revI = stepsNav.indexOf("review");
  const fromI = stepsNav.indexOf(fromStep);
  if (revI < 0 || fromI < 0 || fromI !== revI - 1 || stepsNav.includes("finishing")) return null;
  return skillsNeedSpecialtyChargenBlockReason("before continuing to Review");
}

/** @returns {string | null} */
function mortalSorcererPurchasedTechniquesBlockedReason() {
  if (normalizedTierId(character.tier) !== "sorcerer") return null;
  ensureFinishingShape();
  ensureSorceryProfileShape();
  pruneSorceryAdditionalTechniques();
  const pkg = String(character.finishing.sorcererMortalFinishingPackage || "four_paraphernalia").trim();
  const need = pkg === "two_techniques" ? 2 : pkg === "one_technique_two_paraphernalia" ? 1 : 0;
  const wids = (character.sorceryProfile.workingIds || []).filter(Boolean);
  if (need > 0 && wids.length === 0) {
    return "Choose one Working on the Workings step, then pick your purchased Techniques from that Working’s chip list (Saints & Monsters pp. 65–66, 86–87).";
  }
  const n = (character.sorceryProfile.additionalTechniqueIds || []).length;
  if (need !== n) {
    return `Mortal Sorcerer (Saints & Monsters p. 87): this Step Seven package requires exactly ${need} extra Technique(s) from your Working’s list (${n} selected).`;
  }
  return null;
}

/**
 * @returns {string | null} Blocker text if Finishing cannot advance to Review (skill/attribute finishing spends,
 * specialties, optional Knacks vs Birthrights when that UI is shown — Origin pp. 98–99; Hero+ tiers omit Finishing Knacks/Birthrights here when `heroLikeFinishing`).
 */
function finishingStepLeaveBlockedReason() {
  if (isDragonHeirChargen(character)) return null;
  ensureFinishingShape();
  ensureFinishingBaselines();
  ensureSkillDots();

  const spec = skillsNeedSpecialtyChargenBlockReason("before leaving Finishing");
  if (spec) return spec;

  const tierFin = normalizedTierId(character.tier);
  const heroLikeFinishing = tierFin === "hero" || tierFin === "titanic" || tierFin === "sorcerer_hero";

  const budgetSk = Math.max(0, Math.round(Number(character.finishing.extraSkillDots) || 0));
  const budgetAt = Math.max(0, Math.round(Number(character.finishing.extraAttributeDots) || 0));
  const placedSk = finishingSkillDotsPlaced();
  const placedAt = finishingAttrDotsPlaced();
  const remSk = finishingSkillDotsRemaining();
  const remAt = finishingAttrDotsRemaining();

  if (placedSk > budgetSk) {
    return "Placed Finishing Skill dots exceed your Extra skill dots budget — lower Skills on this step or raise the budget field.";
  }
  if (placedAt > budgetAt) {
    return "Placed Finishing Attribute dot(s) exceed your budget — lower Attributes on this step or raise the budget field.";
  }
  if (budgetSk > 0 && remSk > 0) {
    return `Spend all ${budgetSk} extra Finishing Skill dot(s) on the Skills table below (${remSk} still unspent; Origin p. 99).`;
  }
  if (budgetAt > 0 && remAt > 0) {
    return `Spend all ${budgetAt} Finishing Attribute dot(s) in the Attributes section (${remAt} still unspent; Origin pp. 98–99).`;
  }

  if (!heroLikeFinishing) {
    if (tierFin === "sorcerer") {
      const techBlock = mortalSorcererPurchasedTechniquesBlockedReason();
      if (techBlock) return techBlock;
      if (!mortalSorcererFinishingPackageValid()) {
        const pkg = String(character.finishing.sorcererMortalFinishingPackage || "four_paraphernalia").trim();
        const used = finishingBirthrightPointsUsed();
        if (pkg === "two_techniques") {
          return "Mortal Sorcerer (Saints & Monsters p. 87): pick two additional Techniques from your Working’s chip list above — this package does not use Paraphernalia points.";
        }
        if (pkg === "one_technique_two_paraphernalia") {
          return `Mortal Sorcerer (Saints & Monsters p. 87): spend exactly two Paraphernalia points (${used} / 2) and pick one additional Technique from the chip list above.`;
        }
        return `Mortal Sorcerer (Saints & Monsters p. 87): spend exactly four Paraphernalia points on Finishing picks (${used} / 4), or pick a different Step Seven package.`;
      }
    } else if (character.finishing.knackOrBirthright === "knacks") {
      const fin = [...new Set(character.finishing.finishingKnackIds || [])].filter(Boolean);
      if (fin.length !== 2) {
        return "Pick exactly two extra Finishing Knacks, or switch to Four Birthright points (Origin p. 99).";
      }
      for (const kid of fin) {
        const k = bundle.knacks?.[kid];
        if (!k || !knackFinishingPickIsValidHeld(k, character, bundle)) {
          return `A Finishing Knack pick is no longer valid (${bundle.knacks?.[kid]?.name || kid}) — replace or clear it.`;
        }
      }
    } else {
      const used = finishingBirthrightPointsUsed();
      if (used !== 4) {
        return `Spend exactly four Birthright points on Finishing picks (currently ${used} / 4), or switch to two extra Knacks (Origin p. 99).`;
      }
    }
  }

  const preAttrs = buildCharacterAttrsPre();
  const attrMsgs = validateAttributes(preAttrs);
  if (attrMsgs.length) return attrMsgs.join("\n");

  return null;
}

/**
 * Scion deity/titan line only: validation after `persistFromForm()` when leaving `fromStep` toward a later step.
 * (Wizard nav jumps call this so Finishing / Skills / Paths gates cannot be skipped by clicking ahead.)
 * @returns {string | null}
 */
function forwardLeaveBlockScionAfterPersist(fromStep) {
  if (isDragonHeirChargen(character)) return null;
  if (fromStep === "paths" && pathsStepRequiresPantheonAndParent() && !pathsPantheonAndParentSatisfiedOnCharacter()) {
    return "Choose a pantheon and a parent before leaving the Paths step.";
  }
  if (fromStep === "skills") {
    applyPathMathToSkillDots();
    const gate = validateAllPathSkillsDetailed();
    if (!gate.ok) {
      skillsGateIssues = [...gate.issues];
      return gate.issues.length ? gate.issues.map((i) => i.message).join("\n") : "Fix Path Skills before continuing.";
    }
    if (pathSkillOverflowDotsPending() > 0) {
      const pend = pathSkillOverflowDotsPending();
      skillsGateIssues = [
        {
          pathKey: null,
          message: `Redistribute Path overflow: ${pend} dot(s) still unplaced (Origin p. 97 — max 5 per Skill from Paths; excess only onto other Path Skills).`,
        },
      ];
      return skillsGateIssues[0].message;
    }
    skillsGateIssues = [];
  }
  if (fromStep === "purviews") {
    const pv = heroPurviewsPatronPickRequiredAndMissing();
    if (pv) return pv;
  }
  if (fromStep === "boons") {
    const heroSorcTech = sorceryLineHeroAdditionalTechniquesBlockedReason();
    if (heroSorcTech) return heroSorcTech;
  }
  if (fromStep === "finishing") {
    return finishingStepLeaveBlockedReason();
  }
  return reviewAdvanceSpecialtyBlockIfApplicable(fromStep);
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

/**
 * Mortal Sorcerer Step Seven Paraphernalia allowance (Saints & Monsters p. 87).
 * @returns {number | null} dot cap, or `null` if this tier does not use Mortal Sorcerer finishing packages.
 */
function mortalSorcererFinishingParaphernaliaPointsCap(tierId, fin) {
  if (normalizedTierId(tierId) !== "sorcerer") return null;
  const pkg = String(fin?.sorcererMortalFinishingPackage || "four_paraphernalia").trim();
  if (pkg === "two_techniques") return 0;
  if (pkg === "one_technique_two_paraphernalia") return 2;
  return 4;
}

/** Birthright / Paraphernalia point cap for `finishing.birthrightPicks` (trim, picker, export). */
function finishingParaphernaliaPointsCapForTierAndFinishing(tierId, fin) {
  const mort = mortalSorcererFinishingParaphernaliaPointsCap(tierId, fin);
  if (mort != null) return mort;
  const t = normalizedTierId(tierId);
  if (t === "hero" || t === "titanic" || t === "sorcerer_hero") return 7;
  if (isPostHeroBandCallingTierId(t)) return 11;
  return 4;
}

/** Mortal / Origin (Finishing): 4 pts. Hero: 7 total on the Birthrights step (not 7+4 combined). Demigod/God: 11 (confirm at table). */
function maxBirthrightPointsBudget() {
  return finishingParaphernaliaPointsCapForTierAndFinishing(character.tier, character.finishing);
}

/** Point cap for `finishing.birthrightPicks` on the current character (Mortal Sorcerer uses package-based caps). */
function finishingParaphernaliaPointsCap() {
  return finishingParaphernaliaPointsCapForTierAndFinishing(character.tier, character.finishing);
}

/** Drop picks from the end until total point cost ≤ cap (import, export, render). */
function trimFinishingBirthrightPicksToBudgetInPlace(fin, tierId) {
  if (!fin || !Array.isArray(fin.birthrightPicks)) return;
  const cap = finishingParaphernaliaPointsCapForTierAndFinishing(tierId, fin);
  const arr = fin.birthrightPicks;
  while (arr.length > 0) {
    const used = arr.reduce((s, id) => s + birthrightPointCost(id), 0);
    if (used <= cap) break;
    arr.pop();
  }
}

/** Drop picks from the end until points ≤ tier cap (e.g. after lowering Hero from 11→7). */
function trimBirthrightPicksToBudget() {
  ensureFinishingShape();
  trimFinishingBirthrightPicksToBudgetInPlace(character.finishing, character.tier);
}

/** Mortal Sorcerer Finishing (S&M p. 87): package + spends/notes satisfied. */
function mortalSorcererFinishingPackageValid() {
  if (normalizedTierId(character.tier) !== "sorcerer") return true;
  ensureFinishingShape();
  const pkg = String(character.finishing.sorcererMortalFinishingPackage || "four_paraphernalia").trim();
  const used = finishingBirthrightPointsUsed();
  const addN = (character.sorceryProfile.additionalTechniqueIds || []).length;
  if (pkg === "two_techniques") return addN === 2 && used === 0;
  if (pkg === "four_paraphernalia") return used === 4 && addN === 0;
  if (pkg === "one_technique_two_paraphernalia") return used === 2 && addN === 1;
  return false;
}

/** Invalid highlight on Finishing “Knacks vs Birthrights” / Mortal Sorcerer package panel. */
function finishingKnackOrBirthrightPanelGateInvalid() {
  const tierFin = normalizedTierId(character.tier);
  if (tierFin === "hero" || tierFin === "titanic" || tierFin === "sorcerer_hero") return false;
  if (tierFin === "sorcerer") return !mortalSorcererFinishingPackageValid();
  if (character.finishing.knackOrBirthright === "knacks") {
    const fin = [...new Set(character.finishing.finishingKnackIds || [])].filter(Boolean);
    if (fin.length !== 2) return true;
    for (const kid of fin) {
      const k = bundle.knacks?.[kid];
      if (!k || !knackFinishingPickIsValidHeld(k, character, bundle)) return true;
    }
    return false;
  }
  return finishingBirthrightPointsUsed() !== 4;
}


function ensureDominionShape() {
  if (!Array.isArray(character.dominionBoonPurviewIds)) character.dominionBoonPurviewIds = [];
  if (!character.dominionBoonForgoneByPurview || typeof character.dominionBoonForgoneByPurview !== "object") {
    character.dominionBoonForgoneByPurview = {};
  }
  if (!character.dominionBoonForgoneXpByPurview || typeof character.dominionBoonForgoneXpByPurview !== "object") {
    character.dominionBoonForgoneXpByPurview = {};
  }
  delete character.dominionStuntActiveIds;
}

function pruneDominionState() {
  if (!bundle || !tierSupportsDominionStunts(character.tier)) {
    ensureDominionShape();
    character.dominionBoonPurviewIds = [];
    character.dominionBoonForgoneByPurview = {};
    character.dominionBoonForgoneXpByPurview = {};
    return;
  }
  ensureDominionShape();
  const held = characterPurviewIdSet(character, bundle);
  const validBoons = new Set(Object.keys(bundle.boons || {}).filter((k) => !k.startsWith("_")));
  pruneDominionForgoneMaps(character, held, validBoons);
  character.dominionBoonPurviewIds = (character.dominionBoonPurviewIds || []).filter((id) => held.has(id));
}

/** @type {string | null} */
let dominionSacrificePickerPurviewId = null;

/** @type {Set<string>} */
let dominionSacrificePickIds = new Set();

function closeDominionSacrificePicker() {
  dominionSacrificePickerPurviewId = null;
  dominionSacrificePickIds = new Set();
}

function openDominionSacrificePicker(purviewId) {
  dominionSacrificePickerPurviewId = String(purviewId || "").trim() || null;
  dominionSacrificePickIds = new Set();
}

/**
 * Dominion Boon marking UI (chargen Dominion step + Exp Leveling).
 * @param {HTMLElement} wrap
 * @param {{ compact?: boolean }} [opts]
 */
function appendDominionBoonMarkingUi(wrap, opts = {}) {
  pruneDominionState();
  const compact = Boolean(opts.compact);
  const heldPurviews = [...characterPurviewIdSet(character, bundle)].sort((a, b) =>
    purviewDisplayNameForPantheon(a, bundle, character.pantheonId).localeCompare(
      purviewDisplayNameForPantheon(b, bundle, character.pantheonId),
    ),
  );

  if (compact) {
    const pickHelp = document.createElement("p");
    pickHelp.className = "help";
    pickHelp.textContent =
      "Trade two Boons from the same Purview (including Experience purchases above) for Dominion there, or reserve two Legend Boon purchases when your Legend budget has room.";
    wrap.appendChild(pickHelp);
  } else if (!opts.skipIntro) {
    const pickHelp = document.createElement("p");
    pickHelp.className = "help";
    pickHelp.textContent =
      "Mark each Purview where you hold Dominion. Pay with two Boons from that Purview (including Experience-bought) or reserve two Legend Boon purchases when slots remain.";
    wrap.appendChild(pickHelp);
  }

  if (heldPurviews.length === 0) {
    const empty = document.createElement("p");
    empty.className = "help";
    empty.innerHTML = compact
      ? "No Purviews in scope — set Purviews on the Purviews step first."
      : "No Purviews in scope yet — set patron innate slots and Purview chips on the <strong>Purviews</strong> step, then return here.";
    wrap.appendChild(empty);
    return;
  }

  const domChips = document.createElement("div");
  domChips.className = "chips dominion-boon-chips";
  for (const pid of heldPurviews) {
    const on = (character.dominionBoonPurviewIds || []).includes(pid);
    const label = purviewDisplayNameForPantheon(pid, bundle, character.pantheonId);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (on ? " on" : "");
    chip.textContent = on ? `Dominion: ${label}` : label;
    const forgone = dominionForgoneBoonIds(character, pid);
    if (on && forgone.length === DOMINION_BOON_FORGONE_COST) {
      const names = forgone
        .map((id) => boonDisplayLabel(bundle.boons?.[id], bundle, character.pantheonId) || id)
        .join(", ");
      chip.title = `Dominion in ${label} — paid by forgoing: ${names}. Click to remove and restore those Boons.`;
    } else if (on) {
      chip.title = `Dominion in ${label} — paid with two reserved Legend Boon purchases. Click to remove mark.`;
    } else {
      chip.title = `Mark Dominion in ${label} — costs two Purview Boons (forgo picks or reserve Legend purchases).`;
    }
    chip.addEventListener("click", () => {
      ensureDominionShape();
      if ((character.dominionBoonPurviewIds || []).includes(pid)) {
        clearDominionMarkPayment(character, pid);
        if (dominionSacrificePickerPurviewId === pid) closeDominionSacrificePicker();
        pruneDominionState();
        render();
        return;
      }
      const payOpts = dominionMarkPaymentOptions(character, pid, null, bundle);
      if (!payOpts.canMark) {
        const rem = legendBoonSlotsRemaining(character) ?? 0;
        window.alert(
          `Dominion in ${label} costs two Purview Boons from ${label}. At Legend ${character.legendRating ?? 0}, only ${rem} Legend purchase${rem === 1 ? "" : "s"} remain and you have fewer than two ${label} Boons to forgo — pick more Boons in that Purview, raise Legend, or buy with Experience first.`,
        );
        return;
      }
      if (payOpts.canReserveLegend && payOpts.sacrificableCount < DOMINION_BOON_FORGONE_COST) {
        if (applyDominionMarkPayment(character, pid, { reserveLegend: true }, bundle)) {
          pruneDominionState();
          render();
        }
        return;
      }
      openDominionSacrificePicker(pid);
      render();
    });
    const pvHead = bundle.purviews?.[pid];
    if (pvHead && typeof pvHead === "object") {
      applyGameDataHint(chip, { ...pvHead, name: label });
    }
    domChips.appendChild(chip);
  }
  wrap.appendChild(domChips);

  if (dominionSacrificePickerPurviewId && heldPurviews.includes(dominionSacrificePickerPurviewId)) {
    const pid = dominionSacrificePickerPurviewId;
    const label = purviewDisplayNameForPantheon(pid, bundle, character.pantheonId);
    const panel = document.createElement("div");
    panel.className = "panel dominion-sacrifice-picker";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", `Forgo Boons for Dominion in ${label}`);
    const h = document.createElement("h4");
    h.textContent = `Forgo 2 Boons for Dominion: ${label}`;
    panel.appendChild(h);
    const help = document.createElement("p");
    help.className = "help";
    help.textContent =
      `Select exactly two Boons from ${label} on your sheet to remove in exchange for this Dominion Boon. Both must belong to this Purview. Experience-bought Boons can be chosen; XP is not refunded.`;
    panel.appendChild(help);
    const candidates = sacrificableBoonIds(character, pid, bundle);
    for (const id of [...dominionSacrificePickIds]) {
      if (!candidates.includes(id)) dominionSacrificePickIds.delete(id);
    }
    if (candidates.length < DOMINION_BOON_FORGONE_COST) {
      const empty = document.createElement("p");
      empty.className = "help";
      empty.textContent = `Not enough Boons from ${label} on your sheet to forgo — pick or buy more Boons in that Purview first.`;
      panel.appendChild(empty);
    } else {
      const chips = document.createElement("div");
      chips.className = "chips";
      for (const bid of candidates) {
        const b = bundle.boons?.[bid];
        const selected = dominionSacrificePickIds.has(bid);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (selected ? " on" : "") + (experienceBoonIdSet(character).has(bid) ? " chip-knack-experience" : "");
        const boonChipLabel = boonDisplayLabel(b, bundle, character.pantheonId);
        chip.textContent = boonChipLabel;
        chip.addEventListener("click", () => {
          if (dominionSacrificePickIds.has(bid)) dominionSacrificePickIds.delete(bid);
          else if (dominionSacrificePickIds.size < DOMINION_BOON_FORGONE_COST) dominionSacrificePickIds.add(bid);
          render();
        });
        applyGameDataHint(chip, { ...b, name: boonChipLabel });
        chips.appendChild(chip);
      }
      panel.appendChild(chips);
    }
    const actions = document.createElement("div");
    actions.className = "dominion-sacrifice-picker-actions";
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "btn";
    confirmBtn.textContent = "Confirm Dominion (forgo 2 Boons)";
    const picked = [...dominionSacrificePickIds];
    const sacrificeOk = dominionMarkPaymentOptions(character, pid, picked, bundle).canSacrifice;
    confirmBtn.disabled = picked.length !== DOMINION_BOON_FORGONE_COST || !sacrificeOk;
    confirmBtn.addEventListener("click", () => {
      if (!applyDominionMarkPayment(character, pid, { forgoneBoonIds: picked }, bundle)) {
        window.alert(`Those Boons cannot pay for Dominion in ${label} — pick two Boons from ${label}, or raise Legend.`);
        return;
      }
      closeDominionSacrificePicker();
      pruneDominionState();
      render();
    });
    actions.appendChild(confirmBtn);
    const payOpts = dominionMarkPaymentOptions(character, pid, null, bundle);
    if (payOpts.canReserveLegend) {
      const reserveBtn = document.createElement("button");
      reserveBtn.type = "button";
      reserveBtn.className = "btn secondary";
      reserveBtn.textContent = "Reserve 2 Legend purchases instead";
      reserveBtn.title = "Keep your Boons on the sheet; Dominion counts against your Legend Boon budget.";
      reserveBtn.addEventListener("click", () => {
        if (applyDominionMarkPayment(character, pid, { reserveLegend: true }, bundle)) {
          closeDominionSacrificePicker();
          pruneDominionState();
          render();
        }
      });
      actions.appendChild(reserveBtn);
    }
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      closeDominionSacrificePicker();
      render();
    });
    actions.appendChild(cancelBtn);
    panel.appendChild(actions);
    wrap.appendChild(panel);
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
  character.experienceBoonIds = (character.experienceBoonIds || []).filter((id) => ids.includes(id));
  const budget = boonBudgetSnapshot(character, bundle);
  if (budget.usesLegendBudget) {
    const xp = experienceBoonIdSet(character);
    while (ids.some((id) => !xp.has(id)) && legendBoonSlotsUsed({ ...character, boonIds: ids }) > (budget.legendTotal ?? 0)) {
      let removed = false;
      for (let i = ids.length - 1; i >= 0; i -= 1) {
        if (!xp.has(ids[i])) {
          ids.splice(i, 1);
          removed = true;
          break;
        }
      }
      if (!removed) break;
    }
  } else if (Number.isFinite(budget.heroCap) && ids.length > budget.heroCap) {
    ids = ids.slice(0, budget.heroCap);
  }
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
  if (finishingBirthrightPointsUsed() + cost <= finishingParaphernaliaPointsCap()) {
    character.finishing.birthrightPicks = [...character.finishing.birthrightPicks, bid];
  }
}

function removeFinishingBirthright(index) {
  ensureFinishingShape();
  const next = [...character.finishing.birthrightPicks];
  next.splice(index, 1);
  character.finishing.birthrightPicks = next;
}

function stepDefsForTier(tierId) {
  /** Dragon Heir: same Welcome/Concept + tab ids as Origin Mortal (`tier.json`), then inserts Magic and Birthrights before Finishing (Scion: Dragon). */
  const dragonLine = isDragonHeirChargen(character);
  const id = dragonLine ? "mortal" : normalizedTierId(tierId);
  const tier = bundle?.tier?.[id];
  let raw = tier?.wizardSteps;
  if (!Array.isArray(raw) || raw.length < 3) {
    raw = ["welcome", "concept", "paths", "skills", "attributes", "calling", "finishing", "review"];
  }
  let steps = [...raw];
  if (dragonLine) {
    steps = ["welcome", "concept", ...dragonHeirPostConceptStepList(character)];
  } else if (!wizardIncludesFinishingTouchesStep(tierId)) {
    steps = steps.filter((s) => s !== "finishing");
  }
  if (!steps.includes("expLeveling")) {
    const ri = steps.indexOf("review");
    if (ri >= 0) steps.splice(ri + 1, 0, "expLeveling");
    else steps.push("expLeveling");
  }
  return steps;
}

/** Move the unified wizard to a Dragon Heir tab id (`paths`, `calling`, `magic`, …). */
function navigateDragonHeirToMainWizardStep(stepId) {
  const id = String(stepId || "").trim();
  if (!id) return;
  const steps = stepDefsForTier(character.tier);
  const i = steps.indexOf(id);
  if (i >= 0) stepIndex = i;
}

/** Move the main Scion wizard to a tab id present in `stepDefsForTier` (e.g. `purviews`, `birthrights`). */
function navigateWizardToStepId(stepId) {
  const id = String(stepId || "").trim();
  if (!id) return;
  const steps = stepDefsForTier(character.tier);
  const i = steps.indexOf(id);
  if (i >= 0) stepIndex = i;
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
  return "Choose one innate Purview from your divine parent’s patron list (use a chip in Patron innate Purview below) before continuing.";
}

/** Patron Purview slot count from `tier.json` patronPurviewSlotCount (capped at four) when this tier has a Purviews step. */
function patronPurviewSlotLimitForCharacter() {
  if (!tierHasPurviewStep(character.tier)) return 0;
  const raw = bundle.tier[character.tier]?.patronPurviewSlotCount;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return Math.min(Math.floor(n), PATRON_PURVIEW_SLOT_COUNT);
  return PATRON_PURVIEW_SLOT_COUNT;
}

/** Hero / Titanic: one patron innate slot (chips); Demigod+ uses up to four dropdown slots on the Purviews step (tier.json). */
function patronPurviewSingleSlotHeroStyle() {
  return patronPurviewSlotLimitForCharacter() === 1;
}

/** Mortal / Sorcerer (no Purviews step): drop Purview and Boon picks so export and gates match the books. */
function clearPurviewsAndBoonsIfInapplicableTier() {
  if (tierHasPurviewStep(character.tier)) return;
  character.purviewIds = [];
  character.patronPurviewSlots = Array(PATRON_PURVIEW_SLOT_COUNT).fill("");
  character.boonIds = [];
}

/**
 * First wizard step the player should open after advancing from `oldTierId` to `newTierId`.
 * Prefers a step present in the new tier but not the old; when both tiers share the same
 * `wizardSteps` (e.g. Hero→Demigod), falls back to Callings then other progression tabs — not Review.
 */
function firstNewWizardStepIndex(oldTierId, newTierId) {
  const oldN = normalizedTierId(oldTierId);
  const newN = normalizedTierId(newTierId);
  /** Visitation: pick Callings & dots before new Hero-only steps (Purviews, …). */
  if (oldN === "mortal" && (newN === "hero" || newN === "titanic")) {
    const steps = stepDefsForTier(newTierId);
    const ci = steps.indexOf("calling");
    if (ci >= 0) return ci;
  }
  /** Hero / Titanic → Demigod: confirm pantheon/parent on Paths before Purviews patron slots. */
  if (newN === "demigod" && (oldN === "hero" || oldN === "titanic")) {
    const pi = stepDefsForTier(newTierId).indexOf("paths");
    if (pi >= 0) return pi;
  }
  const oldSet = new Set(stepDefsForTier(oldTierId));
  const steps = stepDefsForTier(newTierId);
  const idx = steps.findIndex((s) => !oldSet.has(s) && s !== "expLeveling");
  if (idx >= 0) return idx;
  /**
   * Several tier pairs (e.g. Hero→Demigod, Demigod→God, Sorcerer Hero→Divine band) use the same
   * `wizardSteps` list in `tier.json`, so nothing is strictly “new” vs the old tier. Review would
   * be a dead-end for “what do I update next?” — prefer the first substantive chargen tab instead.
   */
  const priority = [
    "calling",
    "workings",
    "sorcerer",
    "purviews",
    "birthrights",
    "boons",
    "titanicExtras",
    "paths",
    "skills",
    "attributes",
    "concept",
  ];
  for (const id of priority) {
    const i = steps.indexOf(id);
    if (i >= 0) return i;
  }
  const ri = steps.indexOf("review");
  return ri >= 0 ? ri : 0;
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
  const nextN = normalizedTierId(next);
  const bonusBeforeMerge = [...new Set((character.finishing?.finishingKnackIds || []).filter(
    (id) => typeof id === "string" && id.trim() && !id.startsWith("_"),
  ))];
  for (const id of character.experienceKnackIds || []) {
    if (typeof id !== "string" || !id.trim() || id.startsWith("_")) continue;
    if (!(character.knackIds || []).includes(id)) {
      character.knackIds = [...(character.knackIds || []), id];
    }
  }
  const carriedKnackIds = [
    ...new Set([
      ...(character.knackIds || []).filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")),
      ...(character.experienceKnackIds || []).filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")),
      ...bonusBeforeMerge,
    ]),
  ];
  snapshotKnackRowBudgetCostsBeforeTierAdvance(character, bundle, cur);
  character.tierAdvancementLog = [
    ...(Array.isArray(character.tierAdvancementLog) ? character.tierAdvancementLog : []),
    {
      fromTier: cur,
      toTier: next,
      appliedAt: new Date().toISOString(),
      source: adv.source || "",
      checklist: Array.isArray(adv.checklist) ? [...adv.checklist] : [],
      carriedKnackIds: carriedKnackIds.length ? [...carriedKnackIds] : [],
      carriedFinishingBonusKnackIds: bonusBeforeMerge.length ? [...bonusBeforeMerge] : [],
    },
  ];
  character.tier = next;
  if (normalizedTierId(cur) === "mortal" && (nextN === "hero" || nextN === "titanic")) {
    initHeroCallingSlotsAfterVisitation();
  }
  if (nextN === "hero" || nextN === "titanic") restrictHeroPurviewsToPatronList();
  syncLegendToTier();
  if (carriedKnackIds.length) {
    character.lockedKnackIds = [...new Set([...(character.lockedKnackIds || []), ...carriedKnackIds])];
  }
  if (bonusBeforeMerge.length) {
    character.finishingBonusKnackIds = [
      ...new Set([...(character.finishingBonusKnackIds || []), ...bonusBeforeMerge]),
    ];
  }
  mergeFinishingBonusKnacksIntoMainKnackList();
  if (normalizedTierId(cur) === "mortal") healExperienceKnackIdsFromMortalOverflow();
  reconcileLockedKnackIds(character, bundle);
  lockKnacksAtTierAdvance(character);
  settleExperienceKnacksAfterTierAdvance(character, carriedKnackIds);
  ensureHeroKnackSlotAssignments(character, bundle);
  settleUnassignedHeldKnackSlots(character, bundle);
  repairUnmappedHeroKnackSlots(character, bundle);
  ensureFinishingShape();
  captureFinishingSkillBaseline();
  captureAttrBaselineAfterTierAdvanceExcludingXp();
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

function reconcileExperienceAttributeBumpsFromChargenOverflow() {
  if (experienceAttributeBumpsTotal(character) > 0) return;
  const baseline = character.finishing?.attrBaseline;
  if (!baseline || typeof baseline !== "object" || !bundle?.attributes) return;
  const finBudget = Math.max(0, Math.round(Number(character.finishing?.extraAttributeDots) || 0));
  /** @type {Record<string, number>} */
  const deltas = {};
  let totalDelta = 0;
  for (const id of Object.keys(bundle.attributes)) {
    if (String(id).startsWith("_")) continue;
    const d = Math.max(0, (character.attributes[id] ?? 1) - (baseline[id] ?? 1));
    if (d > 0) {
      deltas[id] = d;
      totalDelta += d;
    }
  }
  if (totalDelta <= finBudget) return;
  ensureExperienceAdvancementBumps(character);
  let finLeft = finBudget;
  const ids = Object.keys(deltas).sort((a, b) => deltas[b] - deltas[a]);
  for (const id of ids) {
    const d = deltas[id];
    const chargenFin = Math.min(d, finLeft);
    finLeft -= chargenFin;
    const xp = d - chargenFin;
    if (xp > 0) character.experienceAttributeBumps[id] = xp;
  }
}

function reconcileExperienceSkillBumpsFromChargenOverflow() {
  if (experienceSkillBumpsTotal(character) > 0) return;
  const baseline = character.finishing?.skillBaseline;
  if (!baseline || typeof baseline !== "object") return;
  const finBudget = Math.max(0, Math.round(Number(character.finishing?.extraSkillDots) || 0));
  /** @type {Record<string, number>} */
  const deltas = {};
  let totalDelta = 0;
  for (const sid of skillIds()) {
    const d = Math.max(0, (character.skillDots[sid] || 0) - (baseline[sid] || 0));
    if (d > 0) {
      deltas[sid] = d;
      totalDelta += d;
    }
  }
  if (totalDelta <= finBudget) return;
  ensureExperienceAdvancementBumps(character);
  let finLeft = finBudget;
  const ids = Object.keys(deltas).sort((a, b) => deltas[b] - deltas[a]);
  for (const sid of ids) {
    const d = deltas[sid];
    const chargenFin = Math.min(d, finLeft);
    finLeft -= chargenFin;
    const xp = d - chargenFin;
    if (xp > 0) character.experienceSkillBumps[sid] = xp;
  }
}

function ensureExperienceShape() {
  const n = Math.round(Number(character.experiencePoints) || 0);
  character.experiencePoints = Number.isFinite(n) && n >= 0 ? n : 0;
  const sp = Math.round(Number(character.experiencePointsSpent) || 0);
  character.experiencePointsSpent = Number.isFinite(sp) && sp >= 0 ? sp : 0;
  if (!Array.isArray(character.experienceBirthrightPickIds)) character.experienceBirthrightPickIds = [];
  if (!Array.isArray(character.experienceKnackIds)) character.experienceKnackIds = [];
  if (!Array.isArray(character.experienceBoonIds)) character.experienceBoonIds = [];
  if (!Array.isArray(character.experiencePurchaseLog)) character.experiencePurchaseLog = [];
  else {
    character.experiencePurchaseLog = character.experiencePurchaseLog.filter((x) => typeof x === "string" && x.trim());
  }
  settleLockedExperienceKnacks(character);
  ensureExperienceAdvancementBumps(character);
  reconcileExperienceAttributeBumpsFromChargenOverflow();
  reconcileExperienceSkillBumpsFromChargenOverflow();
  healSpuriousExperienceKnackIds();
}

/** Knack already on the sheet from chargen or a prior tier — not an Experience purchase target. */
function knackOwnedFromPriorChargen(kid) {
  return knackOwnedFromPriorChargenPick(character, kid);
}

/**
 * Undo mistaken Exp purchases of knacks already on the sheet from chargen (refund XP, restore Finishing lists).
 */
function healSpuriousExperienceKnackIds() {
  if (!Array.isArray(character.experienceKnackIds) || !character.experienceKnackIds.length) return;
  if (!bundle?.knacks) return;
  const finishing = new Set(character.finishing?.finishingKnackIds || []);
  const bonus = finishingBonusKnackIdSet(character);
  /** @type {string[]} */
  const spurious = [];
  for (const id of character.experienceKnackIds) {
    if (finishing.has(id) || bonus.has(id)) spurious.push(id);
  }
  if (!spurious.length) return;
  for (const id of spurious) {
    const wasInFinishing = finishing.has(id);
    removeExperienceKnackPickIfPresent(id);
    experienceRefund(character, bundle, "knack", bundle.knacks?.[id]?.name || id);
    if (wasInFinishing && (character.knackIds || []).includes(id)) {
      character.knackIds = (character.knackIds || []).filter((x) => x !== id);
    }
  }
  if (heroUsesCallingSlotRows(character)) syncHeroKnackSlotAssignments(character, bundle);
}

/** @param {string} kid */
function addExperienceKnackPick(kid) {
  const id = String(kid || "").trim();
  if (!id || knackOwnedFromPriorChargen(id)) return false;
  if (experienceKnackIdSet(character).has(id)) return true;
  if (!experienceSpend(character, bundle, "knack", `Knack: ${bundle.knacks?.[id]?.name || id}`)) return false;
  if (!(character.knackIds || []).includes(id)) {
    character.knackIds = [...(character.knackIds || []), id];
  }
  character.experienceKnackIds = [...new Set([...(character.experienceKnackIds || []), id])];
  if (heroUsesCallingSlotRows(character)) syncHeroKnackSlotAssignments(character, bundle);
  return true;
}

/** @param {string} kid */
function removeExperienceKnackPickIfPresent(kid) {
  const id = String(kid || "").trim();
  if (!id) return;
  character.experienceKnackIds = (character.experienceKnackIds || []).filter((x) => x !== id);
}

/** @param {string} kid @returns {boolean} */
function removeExperienceKnackPick(kid) {
  const id = String(kid || "").trim();
  if (!id || !experienceKnackIdSet(character).has(id)) return false;
  if (isKnackLocked(character, id)) return false;
  character.knackIds = (character.knackIds || []).filter((x) => x !== id);
  removeExperienceKnackPickIfPresent(id);
  experienceRefund(character, bundle, "knack", `Knack: ${bundle.knacks?.[id]?.name || id}`);
  if (heroUsesCallingSlotRows(character)) syncHeroKnackSlotAssignments(character, bundle);
  return true;
}

/** @param {string} bid */
function addExperienceBoonPick(bid) {
  const id = String(bid || "").trim();
  if (!id) return false;
  if (experienceBoonIdSet(character).has(id)) return true;
  const label = boonDisplayLabel(bundle.boons?.[id], bundle, character.pantheonId) || id;
  if (!experienceSpend(character, bundle, "boon", `Boon: ${label}`)) return false;
  if (!(character.boonIds || []).includes(id)) {
    character.boonIds = [...(character.boonIds || []), id];
  }
  character.experienceBoonIds = [...new Set([...(character.experienceBoonIds || []), id])];
  return true;
}

/** @param {string} bid */
function removeExperienceBoonPickIfPresent(bid) {
  const id = String(bid || "").trim();
  if (!id) return;
  character.experienceBoonIds = (character.experienceBoonIds || []).filter((x) => x !== id);
}

/** @param {string} bid @returns {boolean} */
function removeExperienceBoonPick(bid) {
  const id = String(bid || "").trim();
  if (!id || !experienceBoonIdSet(character).has(id)) return false;
  const label = boonDisplayLabel(bundle.boons?.[id], bundle, character.pantheonId) || id;
  character.boonIds = (character.boonIds || []).filter((x) => x !== id);
  removeExperienceBoonPickIfPresent(id);
  experienceRefund(character, bundle, "boon", `Boon: ${label}`);
  return true;
}

function isExpLevelingWizardStep() {
  const steps = stepDefsForTier(character.tier);
  return (steps[stepIndex] || "") === "expLeveling";
}

/** Post-Review Experience purchases only on the Exp Leveling tab. */
function experiencePurchasesEnabled() {
  return isExpLevelingWizardStep();
}

/** @param {string} bid */
function tryAddBirthrightPick(bid) {
  ensureFinishingShape();
  ensureExperienceShape();
  const used = finishingBirthrightPointsUsed();
  const cap = maxBirthrightPointsBudget();
  const cost = birthrightPointCost(bid);
  if (used + cost <= cap) {
    addFinishingBirthright(bid);
    return true;
  }
  if (
    experiencePurchasesEnabled() &&
    experienceSpend(character, bundle, "birthright", `Birthright: ${bundle.birthrights?.[bid]?.name || bid}`)
  ) {
    character.experienceBirthrightPickIds = [...character.experienceBirthrightPickIds, bid];
    return true;
  }
  return false;
}

/** @param {number} index */
function removeExperienceBirthrightPick(index) {
  ensureExperienceShape();
  const next = [...character.experienceBirthrightPickIds];
  next.splice(index, 1);
  character.experienceBirthrightPickIds = next;
}

/**
 * @param {HTMLElement} container
 * @param {{ emptyText?: string }} [opts]
 */
function appendBirthrightPicksList(container, opts = {}) {
  const finPicks = character.finishing?.birthrightPicks || [];
  const xpPicks = character.experienceBirthrightPickIds || [];
  if (finPicks.length === 0 && xpPicks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "help";
    empty.textContent = opts.emptyText || "No picks yet — use Add in the table above.";
    container.appendChild(empty);
    return;
  }
  const plist = document.createElement("ul");
  plist.className = "finishing-birthright-picks";
  finPicks.forEach((bid, idx) => {
    const li = document.createElement("li");
    li.className = "birthrights-pick-row";
    const br = bundle.birthrights[bid];
    const lab = document.createElement("span");
    lab.className = "birthrights-pick-label";
    lab.textContent = `${br?.name || bid} (${birthrightPointCost(bid)} pt)`;
    li.appendChild(lab);
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
  xpPicks.forEach((bid, idx) => {
    const li = document.createElement("li");
    li.className = "birthrights-pick-row birthrights-pick-row--experience";
    const br = bundle.birthrights[bid];
    const lab = document.createElement("span");
    lab.className = "birthrights-pick-label";
    const xpCost = experiencePurchaseCost(bundle, "birthright");
    lab.textContent = `${br?.name || bid} (${xpCost ?? 5} XP)`;
    li.appendChild(lab);
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn secondary";
    rm.textContent = "Remove";
    rm.addEventListener("click", () => {
      removeExperienceBirthrightPick(idx);
      render();
    });
    li.appendChild(rm);
    plist.appendChild(li);
  });
  container.appendChild(plist);
}

/** @param {string} bid @param {number} used @param {number} cap */
function birthrightAddButtonMeta(bid, used, cap) {
  const cost = birthrightPointCost(bid);
  const underBudget = used + cost <= cap;
  const xpBuy = experiencePurchasesEnabled() && !underBudget && experienceCanAfford(character, bundle, "birthright");
  const xpCost = experiencePurchaseCost(bundle, "birthright");
  return { cost, underBudget, xpBuy, xpCost, enabled: underBudget || xpBuy };
}

function updateHeaderTierDisplay() {
  const el = document.getElementById("header-tier-display");
  if (!el || !bundle?.tier) return;
  el.innerHTML = "";
  if (isDragonHeirChargen(character) && bundle?.dragonTier && bundle?.dragonFlights) {
    ensureDragonShape(character, bundle);
    const d = character.dragon;
    const inhN = Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(d.inheritance) || 1)));
    const m = bundle.dragonTier?.inheritanceTrack?.[String(inhN)];
    el.title =
      "Dragon Heirs have no Legend rating at any Inheritance—Knacks, Spells, Twists of Fate, and other powers draw from the Inheritance trait and pool, not Legend (Scion: Dragon p. 114; mechanics pp. 112–113, 117–121, 150–151). The row below tracks your Inheritance pool at the table. Chargen follows the Origin spine with Dragon steps after Concept (pp. 110–119).";
    if (isMythosPantheonSelected()) {
      el.title +=
        " Mythos Scions also set Awareness below: click a dot to set rating, or the rightmost filled dot again to lower by one (minimum 1).";
    }
    const tierLine = document.createElement("div");
    tierLine.className = "header-tier-line";
    const fl = bundle.dragonFlights[d.flightId];
    const stageLab = m?.name ? `Dragon-${m.name}` : `Dragon-Inheritance ${inhN}`;
    tierLine.textContent = fl?.name ? `${stageLab} — ${fl.name}` : `${stageLab} (pick Flight on Flights tab)`;
    el.appendChild(tierLine);

    const inhRow = document.createElement("div");
    inhRow.className = "header-legend-row";
    const inhLab = document.createElement("span");
    inhLab.className = "header-legend-label";
    inhLab.textContent = "Inheritance";
    inhRow.appendChild(inhLab);
    inhRow.appendChild(buildInheritancePoolDotTrack(character.dragon?.inheritancePoolRating ?? 0, true));
    const inhHint = document.createElement("span");
    inhHint.className = "header-legend-req";
    inhHint.textContent = `Pool 0–10 (milestone ${inhN}; can be 0)`;
    inhHint.title =
      "Heirs do not gain, spend, or recover Legend, and Heir fatebinding is not tied to Legend (Dragon p. 114). Inheritance fuels Dragon Magic, Knacks, Birthrights, and related play (pp. 112–113, 117–121, 150–151). Spells often imbue Inheritance until reclaimed or the effect ends. Play aid only—confirm with your Storyguide.";
    inhRow.appendChild(inhHint);
    el.appendChild(inhRow);

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
    return;
  }
  el.title =
    "New characters start at Origin (Mortal). Use Review → Advance to next tier after Visitation. Use the Legend row here to match your table; typical book floors are Mortal 0+, Hero 1+, Demigod 4+, God 8+ (not enforced in this tool).";
  if (isMythosPantheonSelected()) {
    el.title +=
      " Mythos Scions also set Awareness below: click a dot to set rating, or the rightmost filled dot again to lower by one (minimum 1).";
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

  const legRow = document.createElement("div");
  legRow.className = "header-legend-row";
  const legLab = document.createElement("span");
  legLab.className = "header-legend-label";
  legLab.textContent = "Legend";
  legRow.appendChild(legLab);
  legRow.appendChild(buildLegendDotTrack(character.legendRating ?? 0, character.tier, true));
  const legReq = document.createElement("span");
  legReq.className = "header-legend-req";
  const legMin = legendBookMinForTier(character.tier);
  const legMax = legendDotMaxForTier(character.tier);
  legReq.textContent = legMin === 0 ? `0+ · max ${legMax}` : `${legMin}+ · max ${legMax}`;
  legReq.title =
    "Typical Legend band for this tier (Demigod p. 132): one Purview Boon purchase per Legend dot; one Calling dot on each even Legend dot. Max is advisory — your Storyguide may vary.";
  legRow.appendChild(legReq);
  el.appendChild(legRow);

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
  if (!nav) return;
  nav.innerHTML = "";
  const steps = stepDefsForTier(character.tier);
  const attention = wizardStepsNeedingAttention();
  steps.forEach((id, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent =
      id === "expLeveling"
        ? "Exp Leveling"
        : id === "paths" && isDragonHeirChargen(character)
          ? "Flights"
          : id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    if (idx === stepIndex) btn.classList.add("active");
    if (idx < stepIndex) btn.classList.add("done");
    if (attention.has(id)) {
      btn.classList.add("needs-attention");
      btn.title = attention.get(id) || "Action needed on this step";
    }
    btn.addEventListener("click", () => {
      const stepsHere = stepDefsForTier(character.tier);
      const curIdx = stepIndex;
      const fromStep = stepsHere[curIdx] || "welcome";
      persistFromForm();
      if (fromStep === "expLeveling" && idx !== curIdx) {
        const leave = resolveLeaveExpLevelingStep(character);
        if (!leave.proceed) {
          render();
          return;
        }
        character = leave.character;
      }
      if (idx > curIdx) {
        if (isDragonHeirChargen(character)) {
          const dragBlock = dragonHeirStepLeaveBlockedReason(character, bundle, fromStep);
          if (dragBlock) {
            window.alert(dragBlock);
            render();
            return;
          }
          if (fromStep === "attributes") {
            captureDragonFinishingAttrBaseline(character.dragon, bundle);
          }
        } else {
          const block = forwardLeaveBlockScionAfterPersist(fromStep);
          if (block) {
            window.alert(block);
            render();
            return;
          }
        }
      }
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
    "Pick a line, then tier (Mortal/Origin through God on Deity, Titanic on Titan, Mortal- through God-band on Sorcerer). Dragon Heir picks Inheritance 1–10 (True Dragon at 10). Sorcerer uses Saints & Monsters ch. 3 tiers in data/tier.json. Dragon uses the shared Origin spine and the same wizard tabs after Concept (Paths through Review), with Dragon-specific Callings, Magic, and Birthrights steps.";
  tierPick.appendChild(trHelp);
  body.appendChild(tierPick);
  const intro = document.createElement("div");
  const srcWelcome = formatGameDataSourceForDisplay(String(t?.source || ""));
  intro.innerHTML = `<p class="help">${t?.description || ""}</p>
    <p class="help"><strong>Typical Legend:</strong> ${t?.typicalLegendRange || "—"}</p>
    <p class="help mono">${t?.mechanicalEffects || ""}</p>
    <p class="help"><em>${srcWelcome.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</em></p>`;
  body.appendChild(intro);
  root.appendChild(panel("Welcome", body));
}

function renderConcept(root) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <p class="help" id="f-chargen-lineage-blurb" style="display:none"></p>
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
        blurb.style.display = "";
        blurb.innerHTML =
          "Heir Deeds: one Draconic, one short-term worldly, one Brood (shared) per <em>Scion: Dragon</em> p. 110 (see Origin pp. 94–95 for Deed procedure).";
      }
    } else {
      if (ls) ls.textContent = "Short-term Deed";
      if (ll) ll.textContent = "Long-term Deed";
      if (lb) lb.textContent = isSorcererLineTier(character.tier) ? "Coven Deed (shared)" : "Band Deed";
      if (blurb) {
        if (isSorcererLineTier(character.tier)) {
          blurb.style.display = "";
          blurb.textContent =
            "Sorcerer: same Deed structure as Origin (Saints & Monsters ch. 3) — short-term sorcerous deed, long-term goal, and a Coven shared deed. Paths are Origin + how you learned Sorcery + Society (S&M Step Two), not Visitation pantheon picks.";
        } else {
          blurb.textContent = "";
          blurb.style.display = "none";
        }
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

/** Dragon Heir Paths: Flight + three phrases (delegates to Dragon wizard module; main flow uses `renderDragonHeirStepInRoot` for `paths`). */
function renderDragonHeirPathsOnly(root) {
  appendDragonHeirFlightsPathStep(root, character, bundle, render);
}

function renderPaths(root) {
  if (isDragonHeirChargen(character)) {
    renderDragonHeirPathsOnly(root);
    return;
  }
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
        <div class="field paths-deity-field"><label id="p-deity-label" for="p-deity">Parent</label><select id="p-deity"></select></div>
      </div>
      <div class="field paths-mythos-deed-field" id="p-mythos-deed-wrap" hidden style="display: none">
        <label for="p-mythos-deed">Mythos Deed</label>
        <textarea id="p-mythos-deed" rows="2" spellcheck="false" placeholder="Fourth Deed slot (Masks of the Mythos)"></textarea>
        <p class="help paths-mythos-deed-hint">MotM adds a <strong>Mythos</strong> Deed alongside Short-term, Long-term, and Band (see your MotM / table guidance).</p>
      </div>
      <p class="help paths-patron-lineage-hint" style="display:none"></p>
    </div>
    <aside id="p-pantheon-virtues" class="pantheon-virtues-panel" aria-live="polite"></aside>
    <div id="p-virtue-spectrum-mount" class="p-virtue-spectrum-mount"></div>
    <p class="help" id="paths-pantheon-skills-help" style="display:none"></p>`;
  if (isMythosPantheonSelected()) {
    const motm = masksMotMBundle()?.pathsCallout;
    if (typeof motm === "string" && motm.trim()) {
      const motmP = document.createElement("p");
      motmP.className = "help masks-motm-callout";
      motmP.textContent = motm.trim();
      wrap.appendChild(motmP);
    }
  }
  const pathsPantheonStack = wrap.querySelector("#paths-pantheon-deity-stack");
  if (pathsPantheonStack && pathsStepRequiresPantheonAndParent() && !pathsPantheonAndParentSatisfiedOnCharacter()) {
    pathsPantheonStack.classList.add("wizard-gate-invalid");
  }
  root.appendChild(panel("Paths", wrap));
  if (!tierHasPurviewStep(character.tier)) {
    const patronMount = document.createElement("div");
    patronMount.id = "patron-purview-mount";
    wrap.appendChild(patronMount);
    const raw = bundle.tier[character.tier]?.purviewsOriginNote;
    const html =
      typeof raw === "string" && raw.trim()
        ? raw
        : isSorcererLineTier(character.tier)
          ? "<strong>Sorcerer Paths</strong> (Saints & Monsters ch. 3) use Origin’s three-Path structure (Origin p. 95) without Visitation pantheon or divine parent; Purviews come from the <strong>Magic</strong> Purview and other Sorcery rules in that chapter, not patron lists."
          : "";
    if (html) {
      const note = document.createElement("p");
      note.className = "help patron-purviews-origin-note";
      note.innerHTML = html;
      patronMount.appendChild(note);
    }
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
    if (isSorcererLineTier(character.tier)) return;
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
    if (isSorcererLineTier(character.tier)) return;
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
  document.getElementById("p-mythos-deity-empty")?.remove();
  document.getElementById("p-titan-patron-empty")?.remove();
  const pantheonChosen = Boolean(String(character.pantheonId || "").trim());
  if (isMythosPantheonSelected() && pantheonChosen && deityList().length === 0) {
    const deitySel = document.getElementById("p-deity");
    const w = document.createElement("p");
    w.id = "p-mythos-deity-empty";
    w.className = "help";
    w.textContent =
      "No divine parents are listed for the Mythos pantheon in pantheons.json yet. Add deity entries (id, name, callings, purviews) from Masks of the Mythos, or extract text with scripts/ingest_masks_of_the_mythos_pdf.py and merge manually.";
    deitySel?.parentElement?.appendChild(w);
  } else if (patronKindIsTitan() && pantheonChosen && deityList().length === 0) {
    const deitySel = document.getElementById("p-deity");
    const w = document.createElement("p");
    w.id = "p-titan-patron-empty";
    w.className = "help paths-titan-patron-empty";
    w.textContent =
      "No Titan parents are in bundle data for this pantheon yet (`titans.json` → titansByPantheon). Choose another pantheon, start a Deity-line character for god parents, or add Titan rows for this pantheon id.";
    deitySel?.parentElement?.appendChild(w);
  }
  const stackEl = document.getElementById("paths-pantheon-deity-stack");
  const lineageHint = wrap.querySelector(".paths-patron-lineage-hint");
  const deityField = document.getElementById("p-deity")?.closest(".field");
  const pantheonField = document.getElementById("p-pantheon")?.closest(".field");
  const socTa0 = document.getElementById("p-soc");
  const socLab0 = socTa0?.parentElement?.querySelector("label");
  if (isSorcererLineTier(character.tier)) {
    document.getElementById("p-dragon-flight-mount")?.remove();
    if (stackEl) {
      stackEl.hidden = true;
      stackEl.style.display = "none";
    }
    if (deityField) deityField.hidden = true;
    if (pantheonField) pantheonField.hidden = true;
    if (lineageHint) {
      lineageHint.style.display = "";
      lineageHint.textContent =
        "Sorcerer: Origin, Role (how you learned Sorcery), and Society Paths per Saints & Monsters ch. 3 — pick three Skills per Path on the Skills step (no Visitation pantheon or divine parent).";
    }
    if (socLab0) socLab0.textContent = "Society Path phrase";
    ps.disabled = true;
    const deSelS = document.getElementById("p-deity");
    if (deSelS) deSelS.disabled = true;
    const foot = document.getElementById("paths-pantheon-skills-help");
    if (foot) {
      foot.style.display = "";
      foot.textContent =
        "Sorcerer Society Path Skills: any three Skills you can justify (S&M ch. 3, Step Two; Origin p. 95 for Path structure — not the Visitation-era pantheon Asset Skill rule).";
    }
  } else {
    document.getElementById("p-dragon-flight-mount")?.remove();
    if (stackEl) {
      stackEl.hidden = false;
      stackEl.style.removeProperty("display");
    }
    if (deityField) deityField.hidden = false;
    if (pantheonField) pantheonField.hidden = false;
    if (lineageHint) {
      lineageHint.textContent = "";
      lineageHint.style.display = "none";
    }
    if (socLab0) socLab0.textContent = "Society / Pantheon Path phrase";
    ps.disabled = false;
    const deSel2 = document.getElementById("p-deity");
    if (deSel2) deSel2.disabled = false;
    const footDeity = document.getElementById("paths-pantheon-skills-help");
    if (footDeity) {
      footDeity.textContent = "";
      footDeity.style.display = "none";
    }
  }
  document.getElementById("p-deity").addEventListener("change", (e) => {
    if (isSorcererLineTier(character.tier)) return;
    persistPathsPhrasesFromDom();
    character.parentDeityId = e.target.value;
    ensureSocietyDefaultAssetSkills({ pruneOrphanPatronExtras: true });
    onPatronPurviewContextChange();
    render();
  });
  document.getElementById("p-origin").value = character.paths.origin;
  document.getElementById("p-role").value = character.paths.role;
  document.getElementById("p-soc").value = character.paths.society;
  const mythDeedWrap = document.getElementById("p-mythos-deed-wrap");
  const mythDeedTa = document.getElementById("p-mythos-deed");
  if (mythDeedWrap && mythDeedTa) {
    const showMyth = pathsStepShowsMythosDeedFields();
    mythDeedWrap.toggleAttribute("hidden", !showMyth);
    mythDeedWrap.style.display = showMyth ? "" : "none";
    if (typeof character.deeds?.mythos !== "string") character.deeds.mythos = "";
    mythDeedTa.value = character.deeds.mythos || "";
    mythDeedTa.oninput = () => {
      character.deeds.mythos = mythDeedTa.value;
    };
  }
  const hidePathsVirtuesUi = isSorcererLineTier(character.tier);
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
  applyHint(document.getElementById("p-soc"), "p-soc");
  if (!isSorcererLineTier(character.tier)) {
    ["p-pantheon", "p-deity"].forEach((id) => applyHint(document.getElementById(id), id));
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
  if (isDragonHeirChargen(character)) {
    ensureDragonShape(character, bundle);
    renderDragonHeirStepInRoot({
      root,
      character,
      bundle,
      render,
      step: "skills",
      scrollStepIntoView: scrollWizardStepIntoView,
      navigateToDragonHeirStep: navigateDragonHeirToMainWizardStep,
    });
    return;
  }
  ensureSkillDots();
  ensurePathSkillArrays();
  ensureSocietyDefaultAssetSkills();
  applyPathMathToSkillDots();
  const skLocked = postOriginMortalChargenLocked(character);
  const pathGate = validateAllPathSkillsDetailed();
  skillsGateIssues = pathGate.ok ? [] : [...pathGate.issues];
  if (pathGate.ok) {
    const pend = pathSkillOverflowDotsPending();
    if (pend > 0) {
      skillsGateIssues.push({
        pathKey: null,
        message: `Path overlap would put a Skill above 5 dots (Origin p. 97). Move exactly ${pend} excess Path dot(s) onto other Path Skills using the redistribution controls on this step — not into non-Path Skills. Finishing Touches (p. 98) are separate.`,
      });
    }
  }
  const wrap = document.createElement("div");
  if (skLocked) wrap.classList.add("skills-step-readonly");
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
    "Pick three Skills for each Path (panels below), then set primary / secondary / tertiary priority. If overlap would exceed 5 in a Skill, use the overflow controls when they appear; dot rows stay read-only.";
  wrap.appendChild(intro);
  if (skLocked) {
    const lock = document.createElement("p");
    lock.className = "help attributes-core-locked-note";
    const missSpec = skillIdsMissingChargenSpecialties();
    lock.textContent =
      missSpec.length > 0
        ? "Path Skills, priority, and overflow are locked after configuration. Skills at 3+ dots still need a free chargen Specialty below before you can reach Review. After chargen, use Exp Leveling for XP Skill and Specialty purchases."
        : "Path Skills, priority, and overflow are locked after configuration. Use the Exp Leveling tab after Review for post-chargen Skill and Specialty purchases. Clear Path Skill selections to re-edit chargen.";
    wrap.appendChild(lock);
  }

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
      pk === "society" && !isSorcererLineTier(character.tier) ? societyPatronAssetSkillIds() : [];
    if (pk === "society") {
      const rule = document.createElement("p");
      rule.className = "help society-asset-rule";
      if (isSorcererLineTier(character.tier)) {
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
      if (!skLocked) {
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
      } else {
        chip.disabled = true;
      }
      cdiv.appendChild(chip);
    }
    chips.appendChild(cdiv);
    wrap.appendChild(chips);
  });

  const rankGrid = document.createElement("div");
  rankGrid.className = "wizard-triple-field-row";
  rankGrid.setAttribute("role", "group");
  rankGrid.setAttribute("aria-label", "Path priority");
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
    sel.disabled = skLocked;
    if (!skLocked) {
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
    }
    field.appendChild(lab);
    field.appendChild(sel);
    rankGrid.appendChild(field);
  });
  wrap.appendChild(rankGrid);
  ["primary", "secondary", "tertiary"].forEach((rk) => applyHint(document.getElementById(`path-rank-${rk}`), `path-rank-${rk}`));

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
      minus.disabled = skLocked || g <= 0;
      if (!skLocked) {
        minus.addEventListener("click", () => {
          bumpPathSkillRedistribution(sid, -1);
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
          bumpPathSkillRedistribution(sid, 1);
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

  const list = document.createElement("div");
  list.className = "panel skill-ratings-panel";
  const head = document.createElement("h2");
  head.textContent = "Skill ratings (0–5)";
  list.appendChild(head);
  const help = document.createElement("p");
  help.className = "help";
  help.textContent =
    "Ratings follow Path priority (3 / 2 / 1) when Path Skills or priority change. If overlap would exceed 5 in a Skill, place overflow dots using the panel above when it appears (Origin p. 97). At 3+ dots, add free Specialties (Origin pp. 59–60, 97).";
  list.appendChild(help);

  const { left: skillColLeft, right: skillColRight } = skillIdsSplitForSkillsTables(bundle);
  const skillsTwoCol = document.createElement("div");
  skillsTwoCol.className = "skill-ratings-two-cols";

  function appendSkillsReadonlyTable(skillIdList) {
    const table = document.createElement("table");
    table.className = "skill-ratings-table skill-ratings-table--path-readonly";
    appendSkillRatingsTableThead(table);
    const tbody = document.createElement("tbody");
    for (const sid of skillIdList) {
      const s = bundle.skills[sid];
      const chargenVal = skillsStepDotsForSkillsTab(sid);
      const displayVal = skLocked ? character.skillDots[sid] || 0 : chargenVal;
      const specGate = Math.max(chargenVal, character.skillDots[sid] || 0);
      const tr = document.createElement("tr");
      tr.className = "skill-rating-row";
      appendSkillRatingNameCell(tr, sid, s, specGate, {
        skillsTableSpecialty: true,
        specialtyReadOnly: skLocked && !skillNeedsFreeChargenSpecialty(sid),
      });
      appendSkillRatingDotsCell(tr, sid, s, displayVal, "skills");
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    skillsTwoCol.appendChild(table);
  }
  appendSkillsReadonlyTable(skillColLeft);
  appendSkillsReadonlyTable(skillColRight);
  list.appendChild(skillsTwoCol);
  wrap.appendChild(list);
  root.appendChild(panel("Skills", wrap));
}

function renderAttributes(root) {
  const attrLocked = postOriginMortalChargenLocked(character);
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
      "Arena priority and core chargen Attribute dots are locked after your first-tier Finishing. Use the Exp Leveling tab after Review for post-chargen Attribute and Favored Approach purchases.";
    wrap.appendChild(lock);
  }

  appendMissingChargenSpecialtiesPanel(wrap);

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
    sel.id = `arena-rank-${idx}`;
    ARENAS_SORTED.forEach((a) => {
      const o = document.createElement("option");
      o.value = a;
      o.textContent = a;
      sel.appendChild(o);
    });
    sel.value = character.arenaRank[idx];
    sel.disabled = attrLocked;
    if (!attrLocked) {
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
    }
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
  sel.disabled = attrLocked;
  if (!attrLocked) {
    sel.addEventListener("change", () => {
      character.favoredApproach = sel.value;
      render();
    });
  }
  favField.appendChild(lab);
  favField.appendChild(sel);
  wrap.appendChild(favField);
  applyHint(document.getElementById("fav-approach"), "fav-approach");

  if (!attrLocked && isOriginPlayTier(character.tier)) normalizeCharacterAttributesToPools();
  const base = attributesDisplayPreFavoredForAttributesTab();
  const msgs = validateAttributes(base);
  const poolsOk = attributeArenaPoolsSpendOk(base);
  const msgBox = document.createElement("div");
  msgBox.className = msgs.length || !poolsOk ? "warn" : "ok";
  msgBox.textContent = msgs.length ? msgs.join(" ") : poolsOk ? "Arena totals match the 6/4/2 distribution." : "";
  wrap.appendChild(msgBox);

  const finalDisplay = applyFavoredApproach(base);

  const arenasGrid = document.createElement("div");
  arenasGrid.className = "attributes-arenas-grid";
  for (const arena of arenaRankForDisplay()) {
    const sub = document.createElement("div");
    sub.className = "panel attributes-arena-panel";
    sub.innerHTML = `<h2>${arena} (${arenaPools()[arena]} dots beyond base 1 each)</h2>`;
    for (const id of ARENAS[arena]) {
      const meta = bundle.attributes[id];
      let maxFinal = maxFinalRatingForAttr(id, base);
      const finalVal = finalDisplay[id] ?? 1;
      if (attrLocked) maxFinal = Math.max(maxFinal, finalVal);
      const baseFloor = { ...base, [id]: 1 };
      const minFinalDisplay = Math.min(applyFavoredApproach(baseFloor)[id] ?? 1, maxFinal);
      sub.appendChild(
        renderFinalAttrDotRow(
          meta.name,
          finalVal,
          maxFinal,
          (picked) => {
            const fav = resolvedFavoredApproach();
            let pre = APPROACH_ATTRS[fav].includes(id) ? picked - 2 : picked;
            const cap = maxAttrRatingForArena(id, base);
            const newPre = Math.max(1, Math.min(pre, cap));
            const bl = character.finishing?.attrBaseline;
            if (bl && typeof bl === "object") {
              const bump = Math.max(0, (character.attributes[id] ?? 1) - (bl[id] ?? 1));
              bl[id] = newPre;
              character.attributes[id] = Math.max(1, Math.min(5, newPre + bump));
            } else {
              character.attributes[id] = newPre;
            }
            render();
          },
          meta,
          1,
          "(after Favored Approach)",
          minFinalDisplay,
          attrLocked,
          false,
        ),
      );
    }
    arenasGrid.appendChild(sub);
  }
  wrap.appendChild(arenasGrid);

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

/** Hero+ tiers without Finishing: editable free chargen Specialties on the Attributes step. */
function appendMissingChargenSpecialtiesPanel(wrap) {
  if (stepDefsForTier(character.tier).includes("finishing")) return;
  const missing = skillIdsMissingChargenSpecialties();
  if (!missing.length) return;

  const sec = document.createElement("section");
  sec.className = "panel attributes-specialties-panel panel-gate-invalid";
  sec.setAttribute("role", "alert");
  const h = document.createElement("h2");
  h.textContent = "Free chargen Specialties required";
  sec.appendChild(h);
  const help = document.createElement("p");
  help.className = "help";
  help.textContent = `${missing.length} Skill(s) at 3 or more dots still need a free chargen Specialty before you can reach Review (Origin pp. 59–60, 97). Enter them below — the Attributes tab stays highlighted until these are filled.`;
  sec.appendChild(help);

  const list = document.createElement("ul");
  list.className = "attributes-specialties-list";
  const sorted = [...missing].sort((a, b) =>
    String(bundle.skills?.[a]?.name || a).localeCompare(String(bundle.skills?.[b]?.name || b), undefined, {
      sensitivity: "base",
    }),
  );
  for (const sid of sorted) {
    const s = bundle.skills?.[sid];
    const li = document.createElement("li");
    li.className = "attributes-specialty-row";
    const lab = document.createElement("label");
    lab.htmlFor = `specialty-${sid}`;
    lab.textContent = `${s?.name || sid} (${character.skillDots[sid] || 0} dots)`;
    applyGameDataHint(lab, s);
    const inp = document.createElement("input");
    inp.type = "text";
    inp.id = `specialty-${sid}`;
    inp.autocomplete = "off";
    inp.placeholder = "e.g. Greek Mythology, Parkour…";
    inp.value = character.skillSpecialties[sid] || "";
    const syncSpec = () => {
      const t = inp.value.trim();
      if (t) character.skillSpecialties[sid] = inp.value;
      else delete character.skillSpecialties[sid];
      li.classList.toggle("attributes-specialty-row--invalid", skillNeedsFreeChargenSpecialty(sid));
      refreshWizardAttentionUiFromDom();
    };
    inp.addEventListener("input", syncSpec);
    inp.addEventListener("change", syncSpec);
    inp.addEventListener("blur", syncSpec);
    applySkillSpecialtyHints(lab, inp, sid);
    li.appendChild(lab);
    li.appendChild(inp);
    list.appendChild(li);
  }
  sec.appendChild(list);
  wrap.appendChild(sec);
}

/**
 * @param {HTMLButtonElement} chip
 * @param {Record<string, unknown>} k
 */
function setKnackChipContents(chip, k) {
  const kt = knackRuleTier(k);
  const name = typeof k?.name === "string" ? k.name : "";
  chip.textContent = "";
  const inner = document.createElement("span");
  inner.className = "chip-knack-inner";
  const nm = document.createElement("span");
  nm.className = "chip-knack-name";
  nm.textContent = name;
  inner.appendChild(nm);
  const bd = document.createElement("span");
  bd.className = knackTierBadgeClass(kt);
  bd.textContent = knackTierBadgeLabel(kt);
  inner.appendChild(bd);
  chip.appendChild(inner);
}

/** @param {HTMLElement} section @param {string} rid @param {ReturnType<typeof motmCallingPairForRow>} pair */
function appendMotmCallingRowHint(section, rid, pair) {
  if (!pair || !isMythosPantheonSelected()) return;
  const hint = document.createElement("p");
  hint.className = "help calling-knack-motm-row-hint";
  const cname = bundle.callings[rid]?.name || rid;
  hint.textContent = `${cname} shares a MotM pair with ${pair.stdName} (standard) and ${pair.invName} (inverted). Knacks are grouped below by Calling pool — ${pair.stdName} vs ${pair.invName}.`;
  section.appendChild(hint);
}

/** Hero / Titanic / Demigod / God (deity or Titan line): three Calling rows with per-row MotM knack pools. */
function useCallingKnackThreeRowBuckets() {
  if (isOriginPlayTier(character.tier) || !heroUsesCallingSlotRows(character)) return false;
  ensureCallingSlotsForHero();
  return (
    Array.isArray(character.callingSlots) && character.callingSlots.length === HERO_CALLING_ROW_COUNT
  );
}

/** Knack already on the sheet (main list, Finishing hold, or locked from a prior tier). */
function knackHeldOnCallingKnackPanel(kid) {
  const id = String(kid || "").trim();
  if (!id) return false;
  if ((character.knackIds || []).includes(id)) return true;
  if ((character.finishing?.finishingKnackIds || []).includes(id)) return true;
  if (isKnackLocked(character, id)) return true;
  return false;
}

/** Catalog rows plus any picks already on the character (so locked Origin knacks still render at Hero+). */
function callingKnackPanelEntryList() {
  const entries = Object.entries(bundle.knacks || {}).filter(
    ([kid, k]) => !kid.startsWith("_") && isEntryVisibleForBooks(k, allowedBooks),
  );
  const seen = new Set(entries.map(([kid]) => kid));
  const addHeld = (kid) => {
    const id = String(kid || "").trim();
    if (!id || id.startsWith("_") || seen.has(id)) return;
    const k = bundle.knacks?.[id];
    if (!k || typeof k !== "object") return;
    entries.push([id, k]);
    seen.add(id);
  };
  for (const kid of character.knackIds || []) addHeld(kid);
  for (const kid of character.finishing?.finishingKnackIds || []) addHeld(kid);
  for (const kid of knackLockedIdSet(character)) addHeld(kid);
  entries.sort((a, b) => {
    const na = String(a[1]?.name || a[0]);
    const nb = String(b[1]?.name || b[0]);
    const c = na.localeCompare(nb, undefined, { sensitivity: "base" });
    if (c !== 0) return c;
    return String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: "base" });
  });
  return entries;
}

/**
 * Ensure knacks assigned to (or owned on) this Hero Calling row appear even when tier gates hide them from the catalog pass.
 * @param {[string, Record<string, unknown>][]} list
 * @param {number | "any"} rowIdx
 */
function ensureHeldKnacksInCallingRowList(list, rowIdx) {
  if (rowIdx === "any") return list;
  const seen = new Set(list.map(([kid]) => kid));
  const out = [...list];
  for (const kid of new Set([...(character.knackIds || []), ...knackLockedIdSet(character)])) {
    if (seen.has(kid) || !(character.knackIds || []).includes(kid)) continue;
    const k = bundle.knacks?.[kid];
    if (!k || typeof k !== "object") continue;
    if (isGeneralCallingKnack(k)) continue;
    let payRow = character.knackSlotById?.[kid];
    if (payRow == null || !Number.isFinite(Number(payRow))) {
      const bucket = heroKnackChipBucketKey(k, character, bundle);
      payRow = bucket === "any" ? rowIdx : bucket;
    }
    if (payRow !== rowIdx) continue;
    out.push([kid, k]);
    seen.add(kid);
  }
  return out;
}

/**
 * MotM rows: peer Cosmos / Sage sections (Origin-style); otherwise nested subpools or a flat chip list.
 * @param {HTMLElement} parent
 * @param {[string, Record<string, unknown>][]} list
 * @param {string} rowCallingId
 * @param {(container: HTMLElement, kid: string, k: Record<string, unknown>) => void} appendChipFn
 */
function appendCallingRowKnackPoolChips(parent, list, rowCallingId, appendChipFn) {
  const cid = String(rowCallingId ?? "").trim();
  const pair = isMythosPantheonSelected() && cid ? motmCallingPairForRow(cid, bundle) : null;
  if (pair) {
    const split = splitMotmKnackEntriesBySubpool(list, character, cid, bundle);
    if (split && (split.inverted.length || split.standard.length || split.other.length)) {
      appendMotmTwinKnackPoolSections(parent, split, cid, { appendChip: appendChipFn });
      return;
    }
  }
  appendKnackChipsWithMotmSubpools(parent, list, rowCallingId, { appendChip: appendChipFn });
}

/**
 * MotM paired Calling: two peer knack sections (e.g. Sage and Cosmos), each with its own heading.
 * @param {HTMLElement} parent
 * @param {NonNullable<ReturnType<typeof splitMotmKnackEntriesBySubpool>>} split
 * @param {string} anchorCallingId
 * @param {{ appendChip: (container: HTMLElement, kid: string, k: Record<string, unknown>) => void; budgetSuffix?: string }} opts
 */
function appendMotmTwinKnackPoolSections(parent, split, anchorCallingId, opts) {
  const appendChip = opts.appendChip;
  const poolItems = /** @type {Record<"standard-twin" | "inverted", [string, Record<string, unknown>][]>} */ ({
    "standard-twin": split.standard,
    inverted: split.inverted,
  });
  for (const subKey of motmTwinKnackPoolOrder(anchorCallingId, split.pair)) {
    const items = poolItems[subKey];
    if (!items.length) continue;
    const section = document.createElement("div");
    section.className = "calling-knack-chip-group calling-knack-motm-twin-pool";
    const head = document.createElement("h3");
    head.className = "calling-knack-chip-group-title";
    let title = motmTwinKnackPoolSectionTitle(subKey, split.pair, anchorCallingId);
    if (opts.budgetSuffix) title = `${title} — ${opts.budgetSuffix}`;
    head.textContent = title;
    section.appendChild(head);
    const help = document.createElement("p");
    help.className = "help";
    help.textContent = motmTwinKnackPoolSectionHelp(subKey);
    section.appendChild(help);
    const chipWrap = document.createElement("div");
    chipWrap.className = "calling-knack-chip-group-body";
    const chips = document.createElement("div");
    chips.className = "chips chips--calling-knack-subgroup";
    for (const [kid, k] of items) appendChip(chips, kid, k);
    chipWrap.appendChild(chips);
    section.appendChild(chipWrap);
    parent.appendChild(section);
  }
  const rowOther = split.other.filter(([, k]) => !isGeneralCallingKnack(k));
  if (rowOther.length) {
    const chips = document.createElement("div");
    chips.className = "chips chips--calling-knack-subgroup";
    for (const [kid, k] of rowOther) appendChip(chips, kid, k);
    parent.appendChild(chips);
  }
}

/**
 * @param {HTMLElement} parent
 * @param {[string, Record<string, unknown>][]} list
 * @param {string} [rowCallingId]
 * @param {{ appendChip: (container: HTMLElement, kid: string, k: Record<string, unknown>) => void }} opts
 */
function appendKnackChipsWithMotmSubpools(parent, list, rowCallingId, opts) {
  const appendChip = opts.appendChip;
  const cid =
    rowCallingId === undefined
      ? String(character.callingId ?? "").trim()
      : String(rowCallingId).trim();
  const pair = isMythosPantheonSelected() && cid ? motmCallingPairForRow(cid, bundle) : null;
  if (!cid || !pair) {
    for (const [kid, k] of list) appendChip(parent, kid, k);
    return;
  }
  /** @type {[string, Record<string, unknown>][]} */
  const inverted = [];
  /** @type {[string, Record<string, unknown>][]} */
  const standard = [];
  /** @type {[string, Record<string, unknown>][]} */
  const other = [];
  for (const entry of list) {
    const sub = motmInvertedKnackSubpoolKey(entry[1], character, cid, entry[0], bundle);
    if (sub === "inverted") inverted.push(entry);
    else if (sub === "standard-twin") standard.push(entry);
    else other.push(entry);
  }
  const deduped = dedupeMotmTwinKnackSubpoolLists(inverted, standard, cid);
  inverted.length = 0;
  inverted.push(...deduped.inverted);
  standard.length = 0;
  standard.push(...deduped.standard);
  const addSubpool = (subKey, items) => {
    if (!items.length) return;
    const sub = document.createElement("div");
    sub.className = "calling-knack-motm-subpool";
    const h4 = document.createElement("h4");
    h4.className = "calling-knack-motm-subpool-title calling-knack-motm-subpool-title--named";
    h4.textContent = motmTwinKnackPoolSectionTitle(subKey, pair, cid);
    sub.appendChild(h4);
    const subHelp = document.createElement("p");
    subHelp.className = "help calling-knack-motm-subpool-help";
    subHelp.textContent = motmTwinKnackPoolSectionHelp(subKey);
    sub.appendChild(subHelp);
    const chips = document.createElement("div");
    chips.className = "chips chips--calling-knack-subgroup";
    for (const [kid, k] of items) appendChip(chips, kid, k);
    sub.appendChild(chips);
    parent.appendChild(sub);
  };
  for (const subKey of motmTwinKnackPoolOrder(cid, pair)) {
    addSubpool(subKey, subKey === "inverted" ? inverted : standard);
  }
  const rowOther = other.filter(([, k]) => !isGeneralCallingKnack(k));
  if (rowOther.length) {
    const chips = document.createElement("div");
    chips.className = "chips chips--calling-knack-subgroup";
    for (const [kid, k] of rowOther) appendChip(chips, kid, k);
    parent.appendChild(chips);
  }
  if (!inverted.length && !standard.length && !rowOther.length && list.length) {
    const chips = document.createElement("div");
    chips.className = "chips chips--calling-knack-subgroup";
    for (const [kid, k] of list) appendChip(chips, kid, k);
    parent.appendChild(chips);
  }
}

/**
 * Exp Leveling knack panel: same Calling section layout as the Callings tab.
 * @param {HTMLElement} knackSec
 * @param {[string, Record<string, unknown>][]} knackEntries
 * @returns {number} chips rendered
 */
function appendExpLevelingKnackSections(knackSec, knackEntries) {
  const originCallingId = String(character.callingId || "").trim();
  const finishingKnackSet = new Set(character.finishing?.finishingKnackIds || []);
  let knackXpCount = 0;

  /** @param {Record<string, unknown>} k */
  function expKnackOffered(kid, k) {
    if (knackOwnedFromPriorChargen(kid)) return false;
    const experienceExtra = experienceKnackIdSet(character).has(kid);
    const on = character.knackIds.includes(kid) || finishingKnackSet.has(kid);
    const baseOk = knackEligibleOrLockedHeld(k, character, bundle);
    const eligible = knackEligibleForCallingStep(k, character, bundle);
    const knackXpBuy = baseOk && !eligible && !on && experienceCanAfford(character, bundle, "knack");
    return experienceExtra || knackXpBuy;
  }

  /** @param {HTMLElement} container */
  function appendExpKnackChip(container, kid, k) {
    const on = character.knackIds.includes(kid) || finishingKnackSet.has(kid);
    const experienceExtra = experienceKnackIdSet(character).has(kid);
    const baseOk = knackEligibleOrLockedHeld(k, character, bundle);
    const eligible = knackEligibleForCallingStep(k, character, bundle);
    const knackXpBuy =
      !experienceExtra && !on && !knackOwnedFromPriorChargen(kid) && baseOk && !eligible && experienceCanAfford(character, bundle, "knack");
    const slotBlocked = !on && baseOk && !eligible && !knackXpBuy;
    const knackCost = experiencePurchaseCost(bundle, "knack") ?? 10;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className =
      "chip" +
      (on || experienceExtra ? " on" : "") +
      (experienceExtra ? " chip-knack-experience" : "") +
      (slotBlocked ? " chip-knack-slot-blocked" : "");
    chip.disabled = slotBlocked;
    if (experienceExtra) {
      chip.title = `Experience purchase (${knackCost} XP) — click to deselect and refund`;
    } else if (knackXpBuy) {
      chip.title = `Spend ${knackCost} Experience to purchase this Knack`;
    } else if (slotBlocked) {
      chip.title = `Not enough Experience (${knackCost} XP required)`;
    }
    setKnackChipContents(chip, k);
    chip.addEventListener("click", () => {
      if (chip.disabled) return;
      if (experienceKnackIdSet(character).has(kid)) {
        if (!removeExperienceKnackPick(kid)) return;
      } else if (!addExperienceKnackPick(kid)) return;
      render();
    });
    const appliesLine = knackAppliesToCallingsLine(k, bundle, character);
    const payLine =
      useThreeRowKnackBuckets && on ? knackPayingCallingRowLabel(character, bundle, kid) : "";
    const hintParts = [appliesLine, payLine].filter(Boolean);
    applyGameDataHint(chip, k, hintParts.length ? { prefix: hintParts.join(" ") } : undefined);
    if (slotBlocked) {
      const gateHint = useThreeRowKnackBuckets
        ? `You qualify for this Knack, but no Calling row has enough knack points left — clear a pick or buy with Experience when you can afford ${knackCost} XP.`
        : `You qualify for this Knack, but your Calling knack budget is full — clear a pick first, or buy with Experience when you can afford ${knackCost} XP.`;
      chip.title = chip.title ? `${chip.title}\n\n${gateHint}` : gateHint;
    }
    container.appendChild(chip);
    knackXpCount += 1;
  }

  const useThreeRowKnackBuckets = useCallingKnackThreeRowBuckets();

  if (useThreeRowKnackBuckets) {
    /** @type {Map<number | "any", [string, Record<string, unknown>][]>} */
    const buckets = new Map();
    const pushBucket = (key, pair) => {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(pair);
    };
    for (const [kid, k] of knackEntries) {
      if (!expKnackOffered(kid, k)) continue;
      for (const bucketKey of heroKnackChipPanelBucketKeys(k, character, bundle)) {
        pushBucket(bucketKey, [kid, k]);
      }
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
        head.textContent = GENERAL_CALLING_LABEL;
      } else {
        const rid = String(character.callingSlots?.[key]?.id || "").trim();
        const isYourCalling = Boolean(rid && rid === originCallingId);
        head.textContent = rid
          ? motmCallingKnackGroupTitle(rid, bundle, { yourCalling: isYourCalling })
          : `Calling ${key + 1} — pick a Calling on the Callings tab`;
      }
      section.appendChild(head);
      if (key !== "any") {
        const rid = String(character.callingSlots?.[key]?.id || "").trim();
        appendMotmCallingRowHint(section, rid, motmCallingPairForRow(rid, bundle));
      }
      if (key === "any") {
        const genHelp = document.createElement("p");
        genHelp.className = "help";
        genHelp.textContent = "General Calling knacks apply to any Calling row with enough knack points.";
        section.appendChild(genHelp);
      }
      const chipWrap = document.createElement("div");
      chipWrap.className = "calling-knack-chip-group-body";
      const rowCallingId = key === "any" ? "" : String(character.callingSlots?.[key]?.id || "").trim();
      appendKnackChipsWithMotmSubpools(chipWrap, list, rowCallingId, {
        appendChip: (container, kid, k) => appendExpKnackChip(container, kid, k),
      });
      section.appendChild(chipWrap);
      knackSec.appendChild(section);
    }
    return knackXpCount;
  }

  const tierN = normalizedTierId(character.tier);
  if (isOriginPlayTier(character.tier) || isPostHeroBandCallingTierId(tierN)) {
    /** @type {Map<"selected" | "any", [string, Record<string, unknown>][]>} */
    const buckets = new Map([
      ["selected", []],
      ["any", []],
    ]);
    const pushBucket = (key, pair) => {
      buckets.get(key).push(pair);
    };
    for (const [kid, k] of knackEntries) {
      if (!expKnackOffered(kid, k)) continue;
      const key = originCallingKnackChipGroupKey(k, character, bundle);
      pushBucket(key, [kid, k]);
    }
    const order = /** @type {("selected" | "any")[]} */ (["selected", "any"]);
    for (const key of order) {
      const list = buckets.get(key) || [];
      if (!list.length) continue;
      if (key === "selected") {
        const split = splitMotmKnackEntriesBySubpool(list, character, originCallingId, bundle);
        if (split && (split.standard.length || split.inverted.length)) {
          appendMotmTwinKnackPoolSections(knackSec, split, originCallingId, {
            appendChip: (container, kid, k) => appendExpKnackChip(container, kid, k),
          });
          continue;
        }
      }
      const section = document.createElement("div");
      section.className = "calling-knack-chip-group";
      const head = document.createElement("h3");
      head.className = "calling-knack-chip-group-title";
      if (key === "any") {
        head.textContent = GENERAL_CALLING_LABEL;
      } else {
        head.textContent = motmCallingKnackGroupTitle(originCallingId, bundle, { yourCalling: true });
      }
      section.appendChild(head);
      if (key === "selected") {
        appendMotmCallingRowHint(section, originCallingId, motmCallingPairForRow(originCallingId, bundle));
      }
      const chipWrap = document.createElement("div");
      chipWrap.className = "calling-knack-chip-group-body";
      if (key === "selected") {
        appendKnackChipsWithMotmSubpools(chipWrap, list, originCallingId || undefined, {
          appendChip: (container, kid, k) => appendExpKnackChip(container, kid, k),
        });
      } else {
        const chips = document.createElement("div");
        chips.className = "chips chips--calling-knack-subgroup";
        for (const [kid, k] of list) appendExpKnackChip(chips, kid, k);
        chipWrap.appendChild(chips);
      }
      section.appendChild(chipWrap);
      knackSec.appendChild(section);
    }
    return knackXpCount;
  }

  const chips = document.createElement("div");
  chips.className = "chips";
  for (const [kid, k] of knackEntries) {
    if (!expKnackOffered(kid, k)) continue;
    appendExpKnackChip(chips, kid, k);
  }
  if (knackXpCount > 0) knackSec.appendChild(chips);
  return knackXpCount;
}

function renderCalling(root) {
  syncPantheonFromParentDeity();
  syncCallingToParentDeity();
  if (heroUsesCallingSlotRows(character)) {
    healLockedKnackIdsFromTierAdvancement();
    healExperienceKnackIdsFromMortalOverflow();
    healCarriedExperienceKnackIds();
    healFinishingBonusKnackIds();
    ensureFinishingBonusKnackIds(character);
    snapshotMissingLockedKnackRowBudgetCosts(character, bundle);
    reconcileLockedKnackIds(character, bundle);
    if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
    const heldKnackSet = new Set(
      (character.knackIds || []).filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")),
    );
    for (const key of Object.keys(character.knackSlotById)) {
      if (!heldKnackSet.has(key)) delete character.knackSlotById[key];
    }
    stripRowPaidKnacksFromExperiencePools(character);
    pinLockedOriginBudgetKnackToPrimaryRow(character, bundle);
    pruneOrphanUnmappedKnackPurchases(character, bundle);
    seedHeroKnackRowAssignments(character, bundle);
    pinLockedOriginBudgetKnackToPrimaryRow(character, bundle);
    settleUnassignedHeldKnackSlots(character, bundle);
    repairUnmappedHeroKnackSlots(character, bundle);
  }
  const wrap = document.createElement("div");
  const allowedCallingIds = callingIdsAllowedForCharacter();
  const deity = selectedDeityRecord();
  if (allowedCallingIds) {
    if (isMythosPantheonSelected()) {
      const hint = document.createElement("p");
      hint.className = "help";
      hint.textContent = `Masks of the Mythos: Calling rows may use standard or inverted twins from each MotM pair (Creator or Destroyer, Sage or Cosmos, etc.). Patron favored Callings include both sides where a pair exists. Hunter, Judge, Liminal, and Trickster have no inversion.`;
      wrap.appendChild(hint);
    }
  } else if (!character.parentDeityId) {
    const hint = document.createElement("p");
    hint.className = "help";
    hint.textContent = isMythosPantheonSelected()
      ? "Choose a divine parent on the Paths step to limit Calling 1 to that deity’s favored Callings (each MotM pair lists both standard and inverted options). Until then, the full Calling library is available for rows 2–3."
      : "Choose a divine parent on the Paths step to limit Calling to that deity’s listed Callings. Until then, every standard Calling in the library is shown (MotM inverted Callings are hidden for non-Mythos characters).";
    wrap.appendChild(hint);
  }

  const mythosPan = isMythosPantheonSelected();
  const sortCallingEntries = (entries) =>
    [...entries].sort((a, b) =>
      String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0]), undefined, { sensitivity: "base" }),
    );
  const allCallingEntries = sortCallingEntries(
    Object.entries(bundle.callings || {}).filter(([cid, c]) =>
      callingIdInWizardLibraryChooser(cid, bundle, mythosPan) && isEntryVisibleForBooks(c, allowedBooks),
    ),
  );
  /** Hero Calling 1: must be one of the divine parent’s listed Callings (when a parent is set). */
  const patronCallingEntries = allowedCallingIds
    ? sortCallingEntries(
        allowedCallingIds
          .filter((cid) => callingIdInWizardLibraryChooser(cid, bundle, mythosPan))
          .map((cid) => [cid, bundle.callings[cid]])
          .filter(([, c]) => c && isEntryVisibleForBooks(c, allowedBooks)),
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
          : visTier === "hero"
            ? "Visitation (Origin → Hero)"
            : "Callings";
    visPanel.appendChild(visH);
    if (isPostHeroBandCallingTierId(visTier)) {
      const dg = document.createElement("p");
      dg.className = "help";
      dg.textContent =
        "The three Calling rows from Hero or Titanic Visitation (Deity- or Titan-line welcome) carry forward here at Demigod and God, and the same layout applies on Sorcerer divine-band tiers—sheet, export, and per-row Knack budgets. Update dots when your chronicle grants new Calling ratings.";
      visPanel.appendChild(dg);
    }
    if (visTier === "hero" || visTier === "titanic") {
      const visP = document.createElement("div");
      visP.className = "help";
      const intro = document.createElement("p");
      intro.className = "calling-visitation-hero-intro";
      const advanceLabel =
        visTier === "titanic" ? "Advance to Titanic Scion" : "Advance to Hero";
      const patronNoun = patronKindIsTitan() ? "Titan parent" : "divine parent";
      intro.innerHTML =
        `If you are advancing from Mortal, use <strong>Review → ${advanceLabel}</strong> (not Finishing) to reach this step. <strong>Calling 1</strong> stays your <strong>Origin Calling</strong> (only its dots can move here); pick two new Callings in rows 2–3. New rows default to <strong>1 dot</strong> each until you assign all <strong>five</strong> dots across the three rows (each Calling keeps at least one). Your knack budget equals the sum of these dots. <strong>Calling 1</strong>’s menu is your ${patronNoun}’s Calling list; <strong>Callings 2 and 3</strong> list the full Calling library.`;
      visP.appendChild(intro);
      const rules = document.createElement("p");
      rules.className = "calling-visitation-hero-rules";
      rules.textContent =
        "Your character receives five dots among all their Callings, but each must have at least one dot.";
      visP.appendChild(rules);
      const ul = document.createElement("ul");
      ul.className = "calling-visitation-hero-list";
      const items = [
        `One of your Callings must be one of your ${patronNoun}’s three, but the other two are free choice.`,
        "Each Calling is associated with three Fatebinding roles (Hero p. 197).",
        "At Legend 2, 4, 6, 8, and 10 you gain an extra dot of Calling, which can be applied to any of your three chosen Callings as long as it does not take that Calling above five dots.",
      ];
      for (const t of items) {
        const li = document.createElement("li");
        li.textContent = t;
        ul.appendChild(li);
      }
      visP.appendChild(ul);
      visPanel.appendChild(visP);
    }
    wrap.appendChild(visPanel);
    const lockPrimaryCallingSelect = visitationLocksPrimaryCallingChoice();
    const maxCallingDotPool = isHeroBandCallingTierId(visTier) ? 5 : 15;
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
          if (isHeroBandCallingTierId(visTier)) {
            rebalanceHeroCallingSlotDotsOverFive();
          }
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
      const maxForRow = Math.min(5, Math.max(1, maxCallingDotPool - othersSum));
      const cdh = Math.max(1, Math.min(maxForRow, slot.dots));
      character.callingSlots[rowIdx].dots = cdh;
      dotsWrapH.setAttribute(
        "aria-label",
        maxCallingDotPool === 5
          ? `Calling ${rowIdx + 1} rating ${cdh} of 5 (five dots shared across three Callings)`
          : `Calling ${rowIdx + 1} rating ${cdh} of 5 (up to ${maxCallingDotPool} dots across three rows)`,
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
            ensureCallingSlotsForHero();
            character.callingSlots[rowIdx].dots = dotN;
            if (isHeroBandCallingTierId(visTier)) {
              rebalanceHeroCallingSlotDotsOverFive();
            }
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
    const heroBandVis = isHeroBandCallingTierId(visTier);
    const visitationBandLabel =
      visTier === "titanic"
        ? "Titanic Visitation"
        : visTier === "sorcerer_hero"
          ? "Heroic Sorcerer band"
          : "Hero Visitation";
    if (heroBandVis && (dotSumHero < 5 || missingCallingPick)) {
      const wHero = document.createElement("p");
      wHero.className = "warn";
      wHero.textContent =
        (missingCallingPick ? "Pick a Calling in every row (three total). " : "") +
        (dotSumHero < 5
          ? `Distribute all five Calling dots for ${visitationBandLabel} (currently ${dotSumHero} / 5 on the three rows).`
          : "");
      wrap.appendChild(wHero);
    }
    if (!heroBandVis && missingCallingPick) {
      const wDg = document.createElement("p");
      wDg.className = "warn";
      wDg.textContent = "Pick a Calling in every row (three total).";
      wrap.appendChild(wDg);
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
    if (callingEntries.length === 0) {
      sel.disabled = true;
      const placeholder = document.createElement("option");
      placeholder.textContent = "No entries available for current book selection";
      sel.appendChild(placeholder);
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
      const callingFloorLocked = originTier && i <= shown && i <= 1;
      b.className =
        "dot" +
        (i <= shown ? " filled" : "") +
        (b.disabled ? " dot-capped" : "") +
        (callingFloorLocked ? " dot-finishing-locked-fill" : "");
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
  knackPanel.innerHTML = `<h2>Knacks</h2>`;
  const originCallingId = String(character.callingId || "").trim();
  const originTwinId = originCallingId ? mythosCallingTwinId(originCallingId) : null;
  if (
    isMythosPantheonSelected() &&
    originCallingId &&
    originTwinId &&
    (isMythosInvertedTwinCallingId(originCallingId) || isMythosStandardTwinCallingId(originCallingId))
  ) {
    const invertedId = isMythosInvertedTwinCallingId(originCallingId) ? originCallingId : originTwinId;
    const standardId = isMythosStandardTwinCallingId(originCallingId) ? originCallingId : originTwinId;
    const invName = bundle.callings[invertedId]?.name || invertedId;
    const stdName = bundle.callings[standardId]?.name || standardId;
    const motmKnackHelp = document.createElement("p");
    motmKnackHelp.className = "help";
    motmKnackHelp.textContent = `Masks of the Mythos (p. 46): ${stdName} and ${invName} are a paired Calling. Choose Knacks from both pools — standard ${stdName} knacks (Origin / Pandora's Box) and inverted Mythos knacks (${invName}). Works whether your Calling is ${stdName} or ${invName}. Same rule applies to every MotM pair (Creator/Destroyer, Guardian/Corruptor, Healer/Defiler, Leader/Tyrant, Lover/Adversary, Sage/Cosmos, Warrior/Torturer). Hunter, Judge, Liminal, and Trickster have no paired inversion.`;
    knackPanel.appendChild(motmKnackHelp);
  }
  const heroImmKnackSlots = immortalKnackCostsTwoCallingSlots(character.tier);
  const finishingKnackSet = new Set(character.finishing?.finishingKnackIds || []);
  const knackEntries = callingKnackPanelEntryList();

  /** Three Calling rows (Hero / Titanic / Demigod / God): per-row knack pools including locked Origin picks. */
  const useThreeRowKnackBuckets = useCallingKnackThreeRowBuckets();

  /** @param {HTMLElement} container */
  function appendKnackChip(container, kid, k, preferredRowIdx = null) {
    const rowIdx =
      preferredRowIdx != null && Number.isFinite(Number(preferredRowIdx)) ? Number(preferredRowIdx) : null;
    const useRowPayment = heroUsesCallingSlotRows(character) && rowIdx != null;
    const on = useRowPayment
      ? knackSelectedOnCallingRow(character, kid, rowIdx)
      : knackHeldOnCallingKnackPanel(kid);
    const heldOnSheet = knackHeldOnCallingKnackPanel(kid);
    const locked = heldOnSheet && isKnackLocked(character, kid);
    const baseOk = knackEligibleOrLockedHeld(k, character, bundle);
    const eligible = knackEligibleForCallingStep(k, character, bundle);
    const finishingExtra = character.knackIds.includes(kid) && finishingBonusKnackIdSet(character).has(kid);
    const experienceExtra =
      character.knackIds.includes(kid) &&
      (experienceKnackIdSet(character).has(kid) || carriedExperienceKnackIdSet(character).has(kid));
    const knackXpBuy =
      experiencePurchasesEnabled() && baseOk && !eligible && !on && experienceCanAfford(character, bundle, "knack");
    let slotMap = knackSlotMapForRowBudgetUi(character, bundle);
    const inMain = (character.knackIds || []).includes(kid);
    const assignedPay = character.knackSlotById?.[kid];
    const payCheckExclude =
      inMain &&
      (assignedPay == null || !Number.isFinite(Number(assignedPay)) || Number(assignedPay) === rowIdx)
        ? kid
        : undefined;
    const payCheckIds = inMain ? character.knackIds || [] : [...(character.knackIds || []), kid];
    if (useRowPayment && rowIdx != null && !inMain) slotMap = { ...slotMap, [kid]: rowIdx };
    const payRows =
      baseOk && heroUsesCallingSlotRows(character)
        ? callingRowsThatCanPayForKnack(k, character, bundle, payCheckIds, slotMap, payCheckExclude)
        : [];
    const canPayFromRow = useRowPayment && payRows.includes(rowIdx);
    const canPayAnyRow = payRows.length > 0;
    let slotBlocked = knackXpBuy ? false : !baseOk;
    if (!on && !slotBlocked && !knackXpBuy) {
      if (heroUsesCallingSlotRows(character)) slotBlocked = useRowPayment ? !canPayFromRow : !canPayAnyRow;
      else slotBlocked = !eligible;
    }
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className =
      "chip" +
      (on ? " on" : "") +
      (locked ? " chip-knack-locked" : "") +
      (finishingExtra && on ? " chip-knack-finishing-extra" : "") +
      (experienceExtra && on ? " chip-knack-experience" : "") +
      (!eligible && on ? " chip-unqualified" : "") +
      (knackXpBuy ? " chip-experience-unlock" : "") +
      (slotBlocked ? " chip-knack-slot-blocked" : "");
    chip.disabled = slotBlocked;
    if (knackXpBuy) {
      chip.title = `Spend ${experiencePurchaseCost(bundle, "knack")} Experience to purchase this Knack (Origin p. 113)`;
    }
    if (!eligible && on) {
      chip.title = baseOk
        ? locked
          ? "This Knack no longer fits the current Calling row budgets, but it is locked from a prior tier—adjust Callings or dots instead of swapping it."
          : useThreeRowKnackBuckets
            ? "This Knack no longer fits a Calling row budget (Heroic = 1 knack point, Immortal = 2; each Calling’s dots are that row’s point pool). Adjust dots, payor row, or clear Knacks."
            : knackPointCost(k) === 2
              ? "This Knack no longer fits your Calling dot budget (Immortal = 2 knack points; needs a Calling rated 2+). Lower Calling dots or clear Knacks."
              : "This Knack no longer fits your Calling knack budget. Lower Calling dots or clear Knacks."
        : locked
          ? "This Knack no longer matches your Calling, tier, or optional gates, but it is locked from a prior tier."
          : "This Knack no longer matches your Calling, tier, or optional gates—remove it or adjust your character.";
    }
    setKnackChipContents(chip, k);
    chip.addEventListener("click", async () => {
      if (chip.disabled) return;
      character.finishing ||= {};
      if (!Array.isArray(character.finishing.finishingKnackIds)) character.finishing.finishingKnackIds = [];
      const finSet = new Set(character.finishing.finishingKnackIds);
      const inMain = character.knackIds.includes(kid);
      const inFin = finSet.has(kid);
      if (inMain && isKnackLocked(character, kid)) return;
      if (inFin) {
        finSet.delete(kid);
        character.finishing.finishingKnackIds = [...finSet];
        render();
        return;
      }
      if (heroUsesCallingSlotRows(character)) {
        const rowIdx =
          preferredRowIdx != null && Number.isFinite(Number(preferredRowIdx)) ? Number(preferredRowIdx) : null;
        const changed =
          rowIdx != null
            ? commitKnackToCallingRow(character, bundle, kid, k, rowIdx)
            : await toggleHeroKnackWithRowPayment(character, bundle, kid, k, {});
        if (changed) render();
        return;
      }
      const set = new Set(character.knackIds);
      if (inMain) {
        set.delete(kid);
        removeExperienceKnackPickIfPresent(kid);
      } else if (eligible) set.add(kid);
      else if (baseOk && experiencePurchasesEnabled() && addExperienceKnackPick(kid)) {
        render();
        return;
      }
      character.knackIds = [...set];
      render();
    });
    const appliesLine = knackAppliesToCallingsLine(k, bundle, character);
    const payLine =
      useThreeRowKnackBuckets && character.knackIds.includes(kid)
        ? knackPayingCallingRowLabel(character, bundle, kid)
        : "";
    const hintParts = [appliesLine, payLine].filter(Boolean);
    applyGameDataHint(chip, k, hintParts.length ? { prefix: hintParts.join(" ") } : undefined);
    if (slotBlocked) {
      const gateHint = useThreeRowKnackBuckets
        ? `You qualify for this Knack, but no Calling row has enough knack points left (Heroic ${knackPointCostLabel(k)}). Each row’s Calling dots are its point pool.`
        : "You qualify for this Knack, but your Calling knack budget is full—clear a pick first (Origin: one Heroic knack from Calling dots).";
      chip.title = chip.title ? `${chip.title}\n\n${gateHint}` : gateHint;
    }
    if (useThreeRowKnackBuckets && on && character.knackIds.includes(kid)) {
      const payNote = knackPayingCallingRowLabel(character, bundle, kid);
      if (payNote) chip.title = chip.title ? `${chip.title}\n\n${payNote}` : payNote;
    }
    if (locked) {
      const lockNote = finishingExtra
        ? "Locked Finishing extra — does not spend Calling knack points on this row."
        : "Locked from a prior tier — you can pick additional Knacks, but not change this one.";
      chip.title = chip.title ? `${chip.title}\n\n${lockNote}` : lockNote;
    }
    container.appendChild(chip);
  }

  if (useThreeRowKnackBuckets) {
    /** @type {Map<number | "any", [string, Record<string, unknown>][]>} */
    const buckets = new Map();
    const pushBucket = (key, pair) => {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(pair);
    };
    for (const [kid, k] of knackEntries) {
      const held = knackHeldOnCallingKnackPanel(kid);
      if (!knackEligibleOrLockedHeld(k, character, bundle) && !held) continue;
      for (const bucketKey of heroKnackChipPanelBucketKeys(k, character, bundle)) {
        pushBucket(bucketKey, [kid, k]);
      }
    }
    const knackBudgetMap = knackSlotMapForRowBudgetUi(character, bundle);
    const order = /** @type {(number | "any")[]} */ ([0, 1, 2, "any"]);
    for (const key of order) {
      const list = buckets.get(key);
      if (!list?.length) continue;
      const section = document.createElement("div");
      section.className = "calling-knack-chip-group";
      const head = document.createElement("h3");
      head.className = "calling-knack-chip-group-title";
      if (key === "any") {
        head.textContent = GENERAL_CALLING_LABEL;
      } else {
        const rid = String(character.callingSlots?.[key]?.id || "").trim();
        const cap = callingRowDotCap(character, key);
        const used = rowKnackPointsUsed(
          key,
          character.knackIds || [],
          knackBudgetMap,
          bundle,
          character,
        );
        const budgetSuffix = `${used}/${cap} knack points`;
        const isYourCalling = Boolean(rid && rid === originCallingId);
        head.textContent = rid
          ? motmCallingKnackGroupTitle(rid, bundle, {
              yourCalling: isYourCalling,
              budgetSuffix: `Calling ${key + 1} — ${budgetSuffix}`,
            })
          : `Calling ${key + 1} — pick a Calling above`;
      }
      section.appendChild(head);
      if (key !== "any") {
        const rid = String(character.callingSlots?.[key]?.id || "").trim();
        appendMotmCallingRowHint(section, rid, motmCallingPairForRow(rid, bundle));
      }
      if (key === "any") {
        const genHelp = document.createElement("p");
        genHelp.className = "help";
        genHelp.textContent =
          "General Calling knacks can be paid from any Calling row with enough knack points left—you’ll choose which pool when you pick one.";
        section.appendChild(genHelp);
      }
      const chipWrap = document.createElement("div");
      chipWrap.className = "calling-knack-chip-group-body";
      const rowCallingId = key === "any" ? "" : String(character.callingSlots?.[key]?.id || "").trim();
      const prefRow = key === "any" ? null : key;
      const rowList = key === "any" ? list : ensureHeldKnacksInCallingRowList(list, key);
      appendCallingRowKnackPoolChips(chipWrap, rowList, rowCallingId, (container, kid, k) =>
        appendKnackChip(container, kid, k, prefRow),
      );
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
      const held = knackHeldOnCallingKnackPanel(kid);
      if (!knackEligibleOrLockedHeld(k, character, bundle) && !held) continue;
      /* Origin Calling step lists only the one Knack paid by Calling dots; Finishing extras stay on Finishing. */
      if (!character.knackIds.includes(kid) && finishingKnackSet.has(kid)) continue;
      const key = originCallingKnackChipGroupKey(k, character, bundle);
      pushBucket(key, [kid, k]);
    }
    const order = /** @type {("selected" | "any")[]} */ (["selected", "any"]);
    for (const key of order) {
      const list = buckets.get(key) || [];
      const cap = callingKnackSlotCap(character);
      let used = 0;
      for (const id of character.knackIds || []) {
        used += knackRowBudgetCost(character, id, bundle);
      }
      if (key === "selected" && list.length > 0) {
        const split = splitMotmKnackEntriesBySubpool(list, character, originCallingId, bundle);
        if (split && (split.standard.length || split.inverted.length)) {
          const budgetLine = document.createElement("p");
          budgetLine.className = "help calling-knack-motm-budget";
          budgetLine.textContent = `Calling knack budget: ${used}/${cap} knack points — pick one Knack from either pool below.`;
          knackPanel.appendChild(budgetLine);
          appendMotmTwinKnackPoolSections(knackPanel, split, originCallingId, {
            appendChip: (container, kid, k) => appendKnackChip(container, kid, k),
          });
          continue;
        }
      }
      const section = document.createElement("div");
      section.className = "calling-knack-chip-group";
      const head = document.createElement("h3");
      head.className = "calling-knack-chip-group-title";
      if (key === "any") {
        head.textContent = GENERAL_CALLING_LABEL;
      } else {
        head.textContent = motmCallingKnackGroupTitle(originCallingId, bundle, {
          yourCalling: true,
          budgetSuffix: `${used}/${cap} knack points`,
        });
      }
      section.appendChild(head);
      if (key === "any") {
        const genHelp = document.createElement("p");
        genHelp.className = "help";
        genHelp.textContent =
          "Pandora's Box Heroic General knacks (any Calling) — same pool at Origin and Hero; Immortal General knacks wait until Hero with a 2+ dot Calling row.";
        section.appendChild(genHelp);
      }
      if (key === "selected") {
        appendMotmCallingRowHint(section, originCallingId, motmCallingPairForRow(originCallingId, bundle));
      }
      const chipWrap = document.createElement("div");
      chipWrap.className = "calling-knack-chip-group-body";
      if (list.length === 0) {
        const empty = document.createElement("p");
        empty.className = "help";
        if (key === "selected" && originCallingId === "monster") {
          empty.textContent =
            "Scion: Origin has no Mortal Monster Knack list — pick a different Calling for your one Origin Knack, or wait until Hero for Monster Knacks from Pandora's Box.";
        } else if (key === "selected" && originCallingId) {
          const eligibleN = countOriginSelectedCallingKnacks(character, bundle);
          const mythos = isMythosPantheonSelected();
          const patron = String(character.parentDeityId || "").trim();
          empty.textContent =
            eligibleN > 0
              ? "Knacks match your Calling in data but were filtered from this panel — try a hard refresh after deploy, or clear Finishing extra Knacks that shadow these picks."
              : mythos || patron
                ? `No Origin Knacks match ${bundle.callings[originCallingId]?.name || originCallingId} with your current Paths (Mythos/Cthulhu uses the Sage↔Cosmos paired pool). Confirm tier is Mortal/Origin and patron is set on Paths.`
                : "Set Mythos pantheon and your divine parent on Paths first — Cosmos Knacks need the MotM Sage/Cosmos pair (Masks of the Mythos p. 46).";
        } else {
          empty.textContent =
            "No Knacks in this group pass your current gates, or every match is already taken as an extra Finishing Knack — adjust Calling, clear picks on Finishing, or check tier / pantheon data.";
        }
        chipWrap.appendChild(empty);
      } else if (key === "selected") {
        appendKnackChipsWithMotmSubpools(chipWrap, list, originCallingId || undefined, {
          appendChip: (container, kid, k) => appendKnackChip(container, kid, k),
        });
      } else {
        const chips = document.createElement("div");
        chips.className = "chips chips--calling-knack-subgroup";
        for (const [kid, k] of list) appendKnackChip(chips, kid, k);
        chipWrap.appendChild(chips);
      }
      section.appendChild(chipWrap);
      knackPanel.appendChild(section);
    }
  } else {
    const tierN = normalizedTierId(character.tier);
    if (isPostHeroBandCallingTierId(tierN)) {
      /** Legacy single-column layout when three-row slots could not be initialized (should be rare). */
      /** @type {Map<"selected" | "any", [string, Record<string, unknown>][]>} */
      const buckets = new Map([
        ["selected", []],
        ["any", []],
      ]);
      const pushBucket = (key, pair) => {
        buckets.get(key).push(pair);
      };
      for (const [kid, k] of knackEntries) {
        const held = knackHeldOnCallingKnackPanel(kid);
        if (!knackEligibleOrLockedHeld(k, character, bundle) && !held) continue;
        if (!character.knackIds.includes(kid) && finishingKnackSet.has(kid)) continue;
        const key = originCallingKnackChipGroupKey(k, character, bundle);
        pushBucket(key, [kid, k]);
      }
      const order = /** @type {("selected" | "any")[]} */ (["selected", "any"]);
      for (const key of order) {
        const list = buckets.get(key) || [];
        if (key === "selected" && list.length > 0) {
          const split = splitMotmKnackEntriesBySubpool(list, character, originCallingId, bundle);
          if (split && (split.standard.length || split.inverted.length)) {
            appendMotmTwinKnackPoolSections(knackPanel, split, originCallingId, {
              appendChip: (container, kid, k) => appendKnackChip(container, kid, k),
            });
            continue;
          }
        }
        const section = document.createElement("div");
        section.className = "calling-knack-chip-group";
        const head = document.createElement("h3");
        head.className = "calling-knack-chip-group-title";
        if (key === "any") {
          head.textContent = GENERAL_CALLING_LABEL;
        } else {
          head.textContent = motmCallingKnackGroupTitle(originCallingId, bundle, { yourCalling: true });
        }
        section.appendChild(head);
        if (key === "selected") {
          appendMotmCallingRowHint(section, originCallingId, motmCallingPairForRow(originCallingId, bundle));
        }
        const chipWrap = document.createElement("div");
        chipWrap.className = "calling-knack-chip-group-body";
        if (list.length === 0) {
          const empty = document.createElement("p");
          empty.className = "help";
          empty.textContent =
            key === "selected" && originCallingId === "monster"
              ? "Scion: Origin has no Mortal Monster Knack list — pick a different Calling for your one Origin Knack, or wait until Hero for Monster Knacks from Pandora's Box."
              : "No Knacks in this group pass your current gates, or every match is already taken as an extra Finishing Knack — adjust Calling, clear picks on Finishing, or check tier / pantheon data.";
          chipWrap.appendChild(empty);
        } else if (key === "selected") {
          appendCallingRowKnackPoolChips(chipWrap, list, originCallingId, (container, kid, k) =>
            appendKnackChip(container, kid, k),
          );
        } else {
          const chips = document.createElement("div");
          chips.className = "chips chips--calling-knack-subgroup";
          for (const [kid, k] of list) appendKnackChip(chips, kid, k);
          chipWrap.appendChild(chips);
        }
        section.appendChild(chipWrap);
        knackPanel.appendChild(section);
      }
    } else {
      const chips = document.createElement("div");
      chips.className = "chips";
      for (const [kid, k] of knackEntries) {
        const held = knackHeldOnCallingKnackPanel(kid);
        if (!knackEligibleOrLockedHeld(k, character, bundle) && !held) continue;
        appendKnackChip(chips, kid, k);
      }
      knackPanel.appendChild(chips);
    }
  }
  if (knackEntries.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "help book-filter-empty";
    emptyMsg.textContent = "No entries available for the current book selection. Adjust the Source Books filter to see more options.";
    knackPanel.appendChild(emptyMsg);
  }
  applyHint(knackPanel, "knack-select");
  wrap.appendChild(knackPanel);

  root.appendChild(panel("Calling & Knacks", wrap));
}

function renderPurviews(root) {
  ensurePatronPurviewSlots();
  restrictHeroPurviewsToPatronList();
  restrictDemigodGodPurviewExtrasToLegal();
  const tierNorm = normalizedTierId(character.tier);
  const singlePatronPurviewTier = tierNorm === "hero" || tierNorm === "titanic";
  const patronChipPid = String(character.patronPurviewSlots?.[0] || "").trim();
  const detailSelectionSet = singlePatronPurviewTier
    ? new Set(patronChipPid ? [patronChipPid] : [])
    : new Set(character.purviewIds || []);
  if (purviewInnateDetailFocusId && !detailSelectionSet.has(purviewInnateDetailFocusId)) {
    purviewInnateDetailFocusId = "";
  }
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
  if (isSorcererLineTier(character.tier)) {
    const smP = document.createElement("p");
    smP.className = "help sorcerer-purviews-magic-note";
    smP.innerHTML =
      "Saints & Monsters ch. 3: Sorcerers do not use Visitation or a divine parent’s patron Purview list. Marvels come from <strong>Workings</strong>; at Heroic band and up, add the <strong>Magic</strong> Purview and its Boons for the same kind of structured powers Scions buy as Purview effects (see that chapter’s <strong>Purview: Magic</strong>). Sources of Power gate how you fuel spells; <strong>Paraphernalia</strong> uses the <strong>Birthrights</strong> tab on Heroic Sorcerer—not pantheon Society Skills.";
    wrap.appendChild(smP);
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
        source: formatGameDataSourceForDisplay(String(pv?.source || "").trim()),
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

  if (!singlePatronPurviewTier && lim > 0) {
    const patronSlotsMount = document.createElement("div");
    patronSlotsMount.className = "purviews-patron-slots-mount";
    renderPatronPurviewPanel(patronSlotsMount);
    wrap.appendChild(patronSlotsMount);
  }

  if (singlePatronPurviewTier) {
    if (patronOpts.length > 0) {
      help.innerHTML = isMythosPantheonSelected()
        ? `Use <strong>Patron innate Purview</strong> (chips) for your <strong>standard</strong> innate Purview. The <strong>Mythos: Awareness Innate</strong> section below is <em>only</em> if you commit MotM’s optional Awareness Innate—same page, different choice. Your pantheon Signature stays automatic (see above).`
        : `Pick <strong>one patron innate</strong> from your parent’s list (<strong>two innate Purviews</strong> total with automatic pantheon Signature). Use the chips in <strong>Patron innate Purview</strong> below.`;
    } else {
      const motmPaths = isMythosPantheonSelected() ? masksMotMBundle()?.pathsCallout : "";
      if (typeof motmPaths === "string" && motmPaths.trim()) {
        help.textContent = motmPaths.trim();
      } else {
        help.innerHTML =
          "At <strong>Hero</strong> or <strong>Titanic</strong>, choose a <strong>divine parent</strong> on Paths to see that parent’s innate Purview options. Your pantheon Signature Purview still applies when your pantheon is set.";
      }
    }
  } else if (
    tierNorm === "demigod" ||
    tierNorm === "god" ||
    tierNorm === "sorcerer_demigod" ||
    tierNorm === "sorcerer_god"
  ) {
    const pathLine =
      patronOpts.length > 0 && lim > 0
        ? tierNorm === "god" || tierNorm === "sorcerer_god"
          ? `God (Legend 9+): <strong>four innate Purviews</strong> (Signature + <strong>${lim}</strong> patron slots) — no new innate slots at Apotheosis. Further Purviews via <strong>Boons and Dominion</strong> in play; track extras with chips below. `
          : `Demigod: <strong>four innate Purviews</strong> (Signature + <strong>${lim}</strong> patron slots: Hero pick + two more). Parent list or Purviews you already hold. `
        : "";
    help.innerHTML =
      `${pathLine}<strong>Standard universal Purviews</strong> appear as chips below. Your pantheon’s <strong>Signature Purview</strong> stays automatic (not a chip); see innate summaries below. No other pantheon’s Specialty Purviews; no <strong>Denizen</strong> Purviews unless your table adds them via Birthright or another grant. Sorcerers: <strong>Magic</strong> stays available. See <em>Scion: Demigod</em> and <em>Scion: God</em>.`;
  } else if (tierNorm === "sorcerer_hero") {
    help.innerHTML =
      "<strong>Heroic Sorcerer:</strong> only the <strong>Magic</strong> Purview appears as a chip here (Saints & Monsters ch. 3, p. 86). Turn it on, then choose Magic Boons on the <strong>Boons</strong> tab. If your chronicle grants other Purviews, track them outside this wizard or when your tier changes. <strong>Paraphernalia</strong> is the seven-dot Birthrights pool on this same step.";
  } else if (patronOpts.length > 0 && lim > 0) {
    help.innerHTML = `Use the <strong>Patron Purviews (parent)</strong> panel above for up to <strong>${lim}</strong> picks from your parent’s list only. Below, add <em>other</em> Purviews you track (e.g. from Relics or other Birthrights). Full Boon and Purview write-ups: <em>Pandora’s Box (Revised)</em> first; tier books where PB references them.`;
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
      .filter(([pid, p]) => !String(pid).startsWith("_") && p && typeof p === "object" && isEntryVisibleForBooks(p, allowedBooks))
      .sort((a, b) =>
        purviewChipSortLabel(a[0], a[1]).localeCompare(purviewChipSortLabel(b[0], b[1]), undefined, { sensitivity: "base" }),
      );
  } else {
    const demigodLike =
      tierNorm === "demigod" ||
      tierNorm === "god" ||
      tierNorm === "sorcerer_demigod" ||
      tierNorm === "sorcerer_god";
    const pantheonSigId = demigodLike ? pantheonSignaturePurviewId() : "";
    const sorcererHeroMagicOnly = tierNorm === "sorcerer_hero";
    purviewEntries = Object.entries(bundle.purviews || {}).filter(([pid, p]) => {
      if (pid.startsWith("_") || !p || typeof p !== "object") return false;
      if (!isEntryVisibleForBooks(p, allowedBooks)) return false;
      if (sorcererHeroMagicOnly && pid !== "magic") return false;
      if (patronOpts.length > 0 && patronSet.has(pid)) return false;
      if (demigodLike && pantheonSigId && pid === pantheonSigId) return false;
      if (demigodLike && !demigodTierPurviewChipSelectable(pid)) return false;
      return true;
    });
    purviewEntries.sort((a, b) =>
      purviewChipSortLabel(a[0], a[1]).localeCompare(purviewChipSortLabel(b[0], b[1]), undefined, { sensitivity: "base" }),
    );
  }
  for (const [pid, p] of purviewEntries) {
    const chip = document.createElement("button");
    chip.type = "button";
    const chipOn = singlePatronPurviewTier
      ? (character.patronPurviewSlots[0] || "") === pid
      : character.purviewIds.includes(pid);
    chip.className = "chip purview-chip" + (chipOn ? " on" : "");
    chip.textContent = purviewDisplayNameForPantheon(pid, bundle, character.pantheonId) || p.name;
    chip.addEventListener("click", () => {
      ensurePatronPurviewSlots();
      if (singlePatronPurviewTier) {
        const cur = character.patronPurviewSlots[0] || "";
        const next = cur === pid ? "" : pid;
        character.patronPurviewSlots[0] = next;
        for (let j = 1; j < PATRON_PURVIEW_SLOT_COUNT; j += 1) character.patronPurviewSlots[j] = "";
        syncPurviewIdsFromPatronSlots();
        purviewInnateDetailFocusId = next ? pid : "";
        render();
        return;
      }
      const set = new Set(character.purviewIds);
      const wasOn = set.has(pid);
      if (wasOn) set.delete(pid);
      else set.add(pid);
      character.purviewIds = [...set];
      syncPurviewIdsFromPatronSlots();
      if (!wasOn) purviewInnateDetailFocusId = pid;
      else if (purviewInnateDetailFocusId === pid) purviewInnateDetailFocusId = "";
      render();
    });
    applyGameDataHint(chip, p);
    chips.appendChild(chip);
  }
  if (purviewEntries.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "help book-filter-empty";
    emptyMsg.textContent = "No entries available for the current book selection. Adjust the Source Books filter to see more options.";
    chips.appendChild(emptyMsg);
  }
  const innateBelowChips = document.createElement("div");
  innateBelowChips.className = "purview-innate-below-chips";
  /** Demigod / God (deity and Sorcerer bands): list innate write-ups for every selected Purview, not only the last chip toggled. */
  const accumulateInnatePreviews =
    tierNorm === "demigod" ||
    tierNorm === "god" ||
    tierNorm === "sorcerer_demigod" ||
    tierNorm === "sorcerer_god";
  if (accumulateInnatePreviews) {
    const ordered = [...detailSelectionSet].filter(Boolean).sort();
    for (const pid of ordered) {
      const sec = document.createElement("section");
      sec.className = "purview-innate-accum-section";
      const h = document.createElement("h3");
      h.className = "purview-innate-accum-heading";
      h.textContent = purviewDisplayNameForPantheon(pid, bundle, character.pantheonId) || purviewLabel(pid);
      sec.appendChild(h);
      appendPurviewInnateDetails(sec, pid);
      innateBelowChips.appendChild(sec);
    }
  } else if (purviewInnateDetailFocusId && detailSelectionSet.has(purviewInnateDetailFocusId)) {
    appendPurviewInnateDetails(innateBelowChips, purviewInnateDetailFocusId);
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
        "Turn <strong>one</strong> chip on for the innate Purview from your divine parent’s list. Innate write-ups preview below the chip row when a chip is on.";
    }
    patronInnatePanel.appendChild(pIntro);
    patronInnatePanel.appendChild(chips);
    patronInnatePanel.appendChild(innateBelowChips);
    if (heroPurviewsPatronPickRequiredAndMissing()) {
      patronInnatePanel.classList.add("panel-gate-invalid");
    }
    wrap.appendChild(patronInnatePanel);
    renderMythosInnatePowerPanel(wrap);
  } else {
    renderMythosInnatePowerPanel(wrap);
    wrap.appendChild(chips);
    wrap.appendChild(innateBelowChips);
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
    { id: "divining", name: "Divination", summary: "Omens, investigation, and hidden knowledge (S&M from p. 68)." },
    { id: "summoning", name: "Summoning", summary: "Spirits and entities — calls, bargains, and banishments (S&M from p. 63 onward)." },
    { id: "wonderment", name: "Wonderment", summary: "Illusions and unreal creations (S&M from p. 64 onward)." },
    { id: "shapechanging", name: "Shapechanging", summary: "Forms and transformations (S&M from p. 66 onward)." },
  ];
}

function toggleSorcererWorkingSelection(workingId) {
  const id = String(workingId || "").trim();
  if (!id) return;
  ensureSorceryProfileShape();
  const cap = sorcererWorkingPickCap(character.tier);
  const cur = (character.sorceryProfile.workingIds || []).filter((x) => typeof x === "string" && x.trim());
  const wasOn = cur.includes(id);
  let next = cur.filter((x) => x !== id);
  if (!wasOn) {
    next.push(id);
    while (next.length > cap) next = next.slice(1);
  }
  character.sorceryProfile.workingIds = next;
  pruneSorceryAdditionalTechniques();
  render();
}

function renderWorkings(root) {
  ensureSorceryProfileShape();
  const cap = sorcererWorkingPickCap(character.tier);
  const rows = sorcererWorkingsCatalogRows();
  const wrap = document.createElement("div");
  const intro = document.createElement("p");
  intro.className = "help";
  intro.innerHTML =
    cap <= 1
      ? "<strong>Mortal-band Sorcerer (Legend 0):</strong> choose <strong>one</strong> Working; you know its <strong>Inherent Technique</strong> (Saints & Monsters pp. 65–66, 86 — <strong>Divination</strong> is the most common first Working, but any Working is allowed). The five categories are <strong>Divination</strong>, <strong>Binding</strong>, <strong>Shapechanging</strong>, <strong>Summoning</strong>, and <strong>Wonderment</strong> (p. 66)."
      : `<strong>Heroic+ band:</strong> select up to <strong>${cap}</strong> Workings on the chips (two at Heroic tier once you are at Legend 1; each Working has an inherent Technique plus one more Technique you know at creation; pp. 65–66, 86). If you turn on more than the cap allows, the oldest pick drops.`;
  wrap.appendChild(intro);
  const chips = document.createElement("div");
  chips.className = "chips workings-chips";
  const sel = new Set(character.sorceryProfile.workingIds || []);
  for (const row of rows) {
    const id = row.id;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip workings-chip" + (sel.has(id) ? " on" : "");
    chip.textContent = row.name;
    const sum = (row.summary || "").trim();
    chip.title = sum ? `${row.name} — ${sum}` : row.name;
    chip.addEventListener("click", () => toggleSorcererWorkingSelection(id));
    applyGameDataHint(chip, {
      name: row.name,
      description: sum,
      mechanicalEffects: "",
      source: "Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf — Workings",
    });
    chips.appendChild(chip);
  }
  wrap.appendChild(chips);
  const rowsById = new Map(rows.map((r) => [r.id, r]));
  const picked = (character.sorceryProfile.workingIds || []).map((w) => rowsById.get(w)?.name || w);
  const foot = document.createElement("p");
  foot.className = "help";
  foot.innerHTML = `<strong>Selected:</strong> ${picked.length ? picked.join(", ") : "—"} <span class="mono">(${picked.length} / ${cap})</span>`;
  wrap.appendChild(foot);
  if (normalizedTierId(character.tier) === "sorcerer") {
    const post = document.createElement("p");
    post.className = "help";
    post.innerHTML =
      "Next, on the <strong>Sorcerer</strong> tab, your Working’s <strong>Inherent Technique</strong> appears as a fixed chip (from <em>Saints & Monsters</em> pp. 65–78). After you choose a Step Seven package that includes Techniques on <strong>Finishing</strong>, use the same chip picks on <strong>Finishing</strong> or the <strong>Sorcerer</strong> tab (p. 87).";
    wrap.appendChild(post);
  }
  root.appendChild(panel("Workings", wrap));
}

function renderSorcerer(root) {
  ensureSorceryProfileShape();
  ensureFinishingShape();
  const sp = character.sorceryProfile;
  const tSorc = normalizedTierId(character.tier);
  const mortalBand = tSorc === "sorcerer";

  const detail = document.createElement("div");
  if (mortalBand) {
    detail.innerHTML = `
    <p class="help">Mortal-tier Sorcerers have <strong>no Legend 1</strong> yet and do <strong>not</strong> use the four Sources of Power (Invocation, Patronage, Prohibition, Talisman) from pp. 64–65 at creation — the book ties that choice to <strong>Heroic</strong> Sorcerer chargen (p. 85). Record one <strong>Motif</strong> below (p. 87).</p>
    <div class="field"><label for="f-sorc-motif">Motif</label><input type="text" id="f-sorc-motif" autocomplete="off" spellcheck="true" /></div>
    <div class="field"><label for="f-sorc-techniques">Charms and other notes</label><textarea id="f-sorc-techniques" rows="3" placeholder="Charms and freeform notes (Saints & Monsters pp. 65–66). When Step Seven includes Techniques, pick them on this tab or Finishing (p. 87)."></textarea></div>
    <div class="field"><label for="f-sorc-notes">Chronicle / Marvel / SG notes</label><textarea id="f-sorc-notes" rows="3"></textarea></div>`;
  } else {
    const primOpts = [
      ["", "— (undecided)"],
      ["invocation", "Invocation"],
      ["patronage", "Patronage"],
      ["prohibition", "Prohibition"],
      ["talisman", "Talisman"],
    ];
    const primHtml = primOpts.map(([v, lab]) => `<option value="${v}">${lab}</option>`).join("");
    detail.innerHTML = `
    <div class="field"><label for="f-sorc-motif">Motif</label><input type="text" id="f-sorc-motif" autocomplete="off" spellcheck="true" /></div>
    <div class="field"><label for="f-sorc-primary">Primary source of power (Legend 1+)</label><select id="f-sorc-primary">${primHtml}</select></div>
    <div class="field"><label for="f-sorc-source">Sources of Power (freeform notes)</label><textarea id="f-sorc-source" rows="3"></textarea></div>
    <div class="field"><label for="f-sorc-invocation">Invocation (costs, hubris, disguise)</label><textarea id="f-sorc-invocation" rows="2"></textarea></div>
    <div class="field"><label for="f-sorc-patronage">Patronage (Fatebinding, compels)</label><textarea id="f-sorc-patronage" rows="2"></textarea></div>
    <div class="field"><label for="f-sorc-prohibition">Prohibition (Sorcerous Prohibition condition)</label><textarea id="f-sorc-prohibition" rows="2"></textarea></div>
    <div class="field"><label for="f-sorc-talisman">Talisman (Relic bond, Legend pool)</label><textarea id="f-sorc-talisman" rows="2"></textarea></div>
    <div class="field"><label for="f-sorc-techniques">Charms and other notes</label><textarea id="f-sorc-techniques" rows="3" placeholder="Charms and misc. notes (pp. 65–66). One additional Technique per Working at chargen uses the chips below."></textarea></div>
    <div class="field"><label for="f-sorc-notes">Chronicle / Marvel / SG notes</label><textarea id="f-sorc-notes" rows="3"></textarea></div>`;
  }
  if (mortalBand) appendSorceryTechniqueChipsInto(detail, "mortal_profile");
  else if (isSorcererLineTier(character.tier)) appendSorceryTechniqueChipsInto(detail, "hero_profile");
  root.appendChild(panel(mortalBand ? "Sorcerer profile (Mortal tier)" : "Sorcerer profile (Motif & Sources of Power)", detail));

  document.getElementById("f-sorc-motif").value = sp.motif || "";
  if (!mortalBand) {
    document.getElementById("f-sorc-primary").value = sp.primaryPowerSource || "";
    document.getElementById("f-sorc-source").value = sp.powerSource || "";
    document.getElementById("f-sorc-invocation").value = sp.invocation || "";
    document.getElementById("f-sorc-patronage").value = sp.patronage || "";
    document.getElementById("f-sorc-prohibition").value = sp.prohibition || "";
    document.getElementById("f-sorc-talisman").value = sp.talisman || "";
  }
  document.getElementById("f-sorc-techniques").value = sp.techniquesNotes || "";
  document.getElementById("f-sorc-notes").value = sp.notes || "";

  const mp = document.createElement("section");
  mp.className = "panel sorcerer-magic-paraphernalia-panel";
  const mph = document.createElement("h2");
  mph.textContent = "Magic Purview and Paraphernalia";
  mp.appendChild(mph);

  const magH = document.createElement("h3");
  magH.textContent = "Magic Purview";
  mp.appendChild(magH);
  const magicPv = bundle.purviews?.magic;
  if (mortalBand) {
    const magM = document.createElement("p");
    magM.className = "help";
    magM.innerHTML =
      "The structured <strong>Magic</strong> Purview Boon ladder is for <strong>Heroic</strong> Sorcerers and up (Saints & Monsters ch. 3). At Mortal tier you play <strong>Workings</strong>, Marvels, and the Techniques from the Workings chapter until your chronicle reaches Legend 1.";
    mp.appendChild(magM);
  } else if (magicPv && typeof magicPv === "object") {
    const magP = document.createElement("p");
    magP.className = "help";
    const desc = typeof magicPv.description === "string" ? magicPv.description.trim() : "";
    magP.textContent = desc || "Structured Sorcerer powers use the Magic Purview and its Boons (Saints & Monsters ch. 3).";
    mp.appendChild(magP);
    const innateBox = document.createElement("div");
    innateBox.className = "sorcerer-magic-innate-preview";
    appendPurviewInnateDetails(innateBox, "magic");
    mp.appendChild(innateBox);
  } else {
    const miss = document.createElement("p");
    miss.className = "warn";
    miss.textContent = "Magic Purview data is missing from the bundle — confirm purviews tables are merged in data/meta.json.";
    mp.appendChild(miss);
  }
  const hasPvStep = tierHasPurviewStep(character.tier);
  const magicOn = (character.purviewIds || []).includes("magic");
  const magSt = document.createElement("p");
  magSt.className = "help";
  if (mortalBand) {
    magSt.textContent =
      "This tier has no Purviews tab — when you advance to Heroic Sorcerer, add the Magic Purview and Boons there.";
  } else {
    magSt.innerHTML = hasPvStep
      ? magicOn
        ? "<strong>Magic</strong> is toggled <strong>on</strong> on your Purviews list. Use the <strong>Purviews</strong> tab to adjust Purviews and Boons."
        : "<strong>Magic</strong> is not selected yet — open the <strong>Purviews</strong> tab and turn the <strong>Magic</strong> chip on (Heroic band and up; S&amp;M ch. 3)."
      : "This tier has no Purviews step in the wizard — the full <strong>Magic</strong> Purview track applies when you advance to a tier that includes Purviews (e.g. Heroic Sorcerer).";
  }
  mp.appendChild(magSt);
  if (hasPvStep && !mortalBand) {
    const toPv = document.createElement("button");
    toPv.type = "button";
    toPv.className = "btn secondary";
    toPv.textContent = "Open Purviews tab";
    toPv.addEventListener("click", () => {
      persistFromForm();
      navigateWizardToStepId("purviews");
      render();
      scrollWizardStepIntoView();
    });
    mp.appendChild(toPv);
  }

  const parH = document.createElement("h3");
  parH.textContent = "Paraphernalia";
  mp.appendChild(parH);
  const parP = document.createElement("p");
  parP.className = "help";
  if (tSorc === "sorcerer_hero") {
    const used = finishingBirthrightPointsUsed();
    const capBr = maxBirthrightPointsBudget();
    parP.innerHTML = `Heroic-tier Sorcerers receive <strong>seven dots</strong> of Paraphernalia at creation (Saints & Monsters p. 86). Spend them on the <strong>Birthrights</strong> tab like other Hero-band characters — Relics, Creatures, Followers, Guides, and custom designs your table approves (examples in <em>Scion: Hero</em>). Extra dots later use the experience table on p. 87. <strong>Points used:</strong> ${used} / ${capBr}.`;
  } else if (tSorc === "sorcerer_demigod" || tSorc === "sorcerer_god") {
    parP.textContent =
      "Divine-band Sorcerers use the Birthrights tab with this tier’s dot budget (confirm Paraphernalia vs general Birthrights grants with Saints & Monsters and your Storyguide).";
  } else if (tSorc === "sorcerer") {
    parP.innerHTML =
      "Mortal Sorcerers do not get the Heroic <strong>seven</strong>-dot Paraphernalia pool (p. 86). On <strong>Finishing Touches</strong> (p. 87) you may take <strong>four</strong> Paraphernalia points, <strong>one Technique plus two</strong> Paraphernalia points, or <strong>two Techniques</strong> — use the <strong>Finishing</strong> tab.";
  } else {
    parP.textContent = "Paraphernalia rules apply on Sorcerer tiers that include a Birthrights step in the wizard.";
  }
  mp.appendChild(parP);
  const stepList = stepDefsForTier(character.tier);
  if (stepList.includes("birthrights")) {
    const toBr = document.createElement("button");
    toBr.type = "button";
    toBr.className = "btn secondary";
    toBr.textContent = "Open Birthrights tab";
    toBr.addEventListener("click", () => {
      persistFromForm();
      navigateWizardToStepId("birthrights");
      render();
      scrollWizardStepIntoView();
    });
    mp.appendChild(toBr);
  }
  if (mortalBand && stepList.includes("finishing")) {
    const toFin = document.createElement("button");
    toFin.type = "button";
    toFin.className = "btn secondary";
    toFin.textContent = "Open Finishing tab (Step Seven)";
    toFin.addEventListener("click", () => {
      persistFromForm();
      navigateWizardToStepId("finishing");
      render();
      scrollWizardStepIntoView();
    });
    mp.appendChild(toFin);
  }

  root.appendChild(mp);
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
  if (normalizedTierId(character.tier) === "sorcerer_hero") {
    const parap = document.createElement("section");
    parap.className = "panel sorcerer-paraphernalia-callout";
    const ph = document.createElement("h2");
    ph.textContent = "Paraphernalia (Heroic Sorcerer)";
    parap.appendChild(ph);
    const pp = document.createElement("p");
    pp.className = "help";
    pp.innerHTML =
      "Heroic-tier Sorcerers gain <strong>seven dots</strong> to distribute among Paraphernalia at creation (Saints & Monsters p. 86). Use the catalog below like other Hero-band characters — pick Relics, Creatures, Followers, Guides, or designs your table approves (examples in <em>Scion: Hero</em>). Buying more with experience uses the table on p. 87.";
    parap.appendChild(pp);
    wrap.appendChild(parap);
  }
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
  const brXp = experiencePurchaseCost(bundle, "birthright");
  sum.textContent = `Points used: ${used} / ${cap}. “Add” spends that row’s point cost; remove picks below to free points. Extra Birthrights beyond the cap are purchased on the Exp Leveling tab (${brXp ?? 5} XP each).`;
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
    .filter(([id, br]) => !id.startsWith("_") && !isChargenWizardHiddenBirthrightRow(br, id) && isEntryVisibleForBooks(br, allowedBooks))
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
    const addMeta = birthrightAddButtonMeta(bid, used, cap);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn secondary" + (addMeta.xpBuy ? " btn-experience-unlock" : "");
    btn.textContent = addMeta.underBudget ? "Add" : addMeta.xpBuy ? `Add (${addMeta.xpCost} XP)` : "Add";
    btn.disabled = !addMeta.enabled;
    btn.addEventListener("click", () => {
      if (tryAddBirthrightPick(bid)) render();
    });
    applyGameDataHint(btn, br);
    const addHint = addMeta.underBudget
      ? "Adds another pick of this template if you want several of the same Birthright (each costs its points)."
      : addMeta.xpBuy
        ? `Spend ${addMeta.xpCost ?? 5} Experience for this Birthright (beyond chargen budget).`
        : `Not enough points left for this cost (${cost}). Remove picks below to free budget.`;
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
  if (entries.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "help book-filter-empty";
    emptyMsg.textContent = "No entries available for the current book selection. Adjust the Source Books filter to see more options.";
    catalog.appendChild(emptyMsg);
  }
  wrap.appendChild(catalog);

  const picks = document.createElement("section");
  picks.className = "panel birthrights-picks-panel";
  const hp = document.createElement("h2");
  hp.textContent = "Your Birthright picks";
  picks.appendChild(hp);
  appendBirthrightPicksList(picks);
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
  const boonBudget = boonBudgetSnapshot(character, bundle);
  if (boonBudget.usesLegendBudget) {
    const domForgone = (boonBudget.legendUsed ?? 0) - boonBudget.nonXpBoonCount;
    const domNote =
      domForgone > 0 ? ` (${domForgone} reserved for Dominion Boons)` : "";
    capHelp.innerHTML = `Demigod+ <strong>Legend Boon budget</strong> (p. 132): <strong>${boonBudget.legendUsed ?? 0} / ${boonBudget.legendTotal ?? 0}</strong> Purview Boon purchases used${domNote} — one per Legend dot; Dominion marks cost two each. Set <strong>Legend</strong> in the header to raise your budget. When Legend slots are full, use <strong>Exp Leveling</strong> or buy with Experience here if enabled. Purview Innates are not Boons.`;
  } else if (boonBudget.heroCap != null) {
    capHelp.textContent = `You may select up to ${boonBudget.heroCap} Boons from the lists below. Purview Innate powers are granted with each Purview you hold — they are not Boons and do not use a slot here. After ${boonBudget.heroCap} Boons are chosen, other options are hidden until you remove a pick or buy with Experience.`;
  } else {
    capHelp.textContent =
      "Select Boons from the lists below for each Purview you track. Purview Innate powers are granted with each Purview you hold — they are not Boons.";
  }
  wrap.appendChild(capHelp);

  const boonLeaveBlock =
    sorceryLineHeroAdditionalTechniquesBlockedReason() || reviewAdvanceSpecialtyBlockIfApplicable("boons");
  if (boonLeaveBlock) {
    const gate = document.createElement("div");
    gate.className = "skills-gate-errors";
    gate.setAttribute("role", "alert");
    const gateP = document.createElement("p");
    gateP.className = "skills-gate-errors-title";
    gateP.textContent = "Before you can continue to Review:";
    gate.appendChild(gateP);
    const gateUl = document.createElement("ul");
    const gateLi = document.createElement("li");
    gateLi.textContent = boonLeaveBlock;
    gateUl.appendChild(gateLi);
    gate.appendChild(gateUl);
    wrap.appendChild(gate);
  }

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
  const atFreeCap = boonBudget.atFreeCap;

  for (const [bid, b] of entries) {
    if (boonIsPurviewInnateAutomaticGrant(b, bundle)) continue;
    if (!isEntryVisibleForBooks(b, allowedBooks)) continue;
    const eligible = boonEligible(b, character, bundle);
    const on = character.boonIds.includes(bid);
    const isXpBoon = experienceBoonIdSet(character).has(bid);
    const boonXpBuy =
      experiencePurchasesEnabled() && !on && eligible && atFreeCap && experienceCanAfford(character, bundle, "boon");
    const canFreeAdd =
      eligible &&
      !atFreeCap &&
      (boonBudget.usesLegendBudget
        ? (legendBoonSlotsRemaining(character) ?? 0) > 0
        : boonBudget.heroCap == null || (character.boonIds || []).length < boonBudget.heroCap);
    const slotBlocked = !on && !boonXpBuy && !canFreeAdd && eligible;
    if (!on && (!eligible || (atFreeCap && !boonXpBuy))) continue;
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
    chip.className =
      "chip" +
      (on ? " on" : "") +
      (isXpBoon && on ? " chip-knack-experience" : "") +
      (boonXpBuy ? " chip-experience-unlock" : "") +
      (slotBlocked ? " chip-knack-slot-blocked" : "") +
      (!eligible && on ? " chip-unqualified" : "");
    chip.disabled = slotBlocked;
    if (boonXpBuy) {
      chip.title = `Spend ${experiencePurchaseCost(bundle, "boon")} Experience for an extra Boon (Saints & Monsters p. 87)`;
    } else if (slotBlocked) {
      chip.title = boonBudget.usesLegendBudget
        ? "No Legend Boon purchases left — raise Legend in the header, free a pick, or buy with Experience."
        : "Boon cap reached — remove a pick or buy with Experience.";
    } else if (!eligible && on) {
      chip.title =
        "This Boon no longer matches your Purviews, tier, or prerequisite chain—remove it or adjust your character.";
    }
    const boonChipLabel = boonDisplayLabel(b, bundle, character.pantheonId);
    chip.textContent = boonChipLabel;
    chip.addEventListener("click", () => {
      if (character.boonIds.includes(bid)) {
        if (experienceBoonIdSet(character).has(bid)) removeExperienceBoonPick(bid);
        else character.boonIds = (character.boonIds || []).filter((x) => x !== bid);
        render();
        return;
      }
      if (boonXpBuy) {
        if (addExperienceBoonPick(bid)) render();
        return;
      }
      const budgetNow = boonBudgetSnapshot(character, bundle);
      const canAdd = budgetNow.usesLegendBudget
        ? (legendBoonSlotsRemaining(character) ?? 0) > 0
        : budgetNow.heroCap == null || (character.boonIds || []).length < budgetNow.heroCap;
      if (eligible && canAdd) {
        character.boonIds = [...(character.boonIds || []), bid];
        render();
      }
    });
    applyGameDataHint(chip, { ...b, name: boonChipLabel });
    chips.appendChild(chip);
  }

  if (!anyShown) {
    const empty = document.createElement("p");
    empty.className = "help";
    // Check if book filter is the cause (entries exist but are hidden by allowedBooks)
    const hasEntriesBeforeBookFilter = entries.some(([, b]) => !boonIsPurviewInnateAutomaticGrant(b, bundle) && boonEligible(b, character, bundle));
    if (hasEntriesBeforeBookFilter) {
      empty.textContent = "No entries available for the current book selection. Adjust the Source Books filter to see more options.";
    } else {
    const tracked = [...characterPurviewIdSet(character, bundle)].sort();
    const trackedNote =
      tracked.length > 0
        ? ` Purviews currently in scope for this wizard: <strong>${tracked.map((id) => purviewDisplayNameForPantheon(id, bundle, character.pantheonId)).join(", ")}</strong>.`
        : " <strong>No Purviews in scope yet</strong> — at Hero/Titanic set your patron innate on the <strong>Purviews</strong> step (and confirm your pantheon Signature); at Demigod+ use patron slots and chips on <strong>Purviews</strong>.";
    empty.innerHTML =
      "No qualifying Boons yet — confirm <strong>tier</strong> (e.g. some Boons need Demigod or God tier) and Purviews in scope. (Legend and printed Boon prerequisites from the books are not enforced in this wizard; both change in play — confirm at the table.)" +
      trackedNote +
      " If this list omits a Purview you expect, open <strong>Purviews</strong> (and <strong>Paths</strong> for pantheon/parent) so patron slots and sheet picks sync, then return here.";
    }
    wrap.appendChild(empty);
  }

  const boonPanel = panel("Boons", wrap);
  applyHint(boonPanel, "boon-select");
  root.appendChild(boonPanel);

  if (tierSupportsDominionStunts(character.tier)) {
    renderDominionBoons(root);
    renderDominionStunts(root);
  }
}

function renderDominionBoons(root) {
  pruneDominionState();
  const wrap = document.createElement("div");

  const intro = document.createElement("p");
  intro.className = "help";
  intro.innerHTML =
    "<strong>Scion: Demigod pp. 154–155 — Dominion:</strong> “Dominion comes at the price of <strong>two Purview Boons</strong>; instead of two Boons, the Scion gains a single <strong>Dominion Boon</strong> over that Purview.” Available at Demigod tier (Legend 5+). Each Dominion Boon is a major investment in one Purview you already hold — you may take multiple over time (one per Purview), but each costs two regular Boons forgone in play.";
  wrap.appendChild(intro);

  const benefits = document.createElement("p");
  benefits.className = "help";
  benefits.innerHTML =
    "A Dominion Boon grants <strong>deep mastery</strong> of that Purview: full access to all <strong>Dominion Stunts</strong> (see below), <strong>Font of Miracles</strong> (casual minor miracles in that Purview without rolls or Legend in most cases), easier <strong>Marvels</strong> (imbue Legend instead of spending it in that Purview), and divinity-dice themes tied to the Purview. Normal Boons are discrete powers; a Dominion Boon unlocks the whole toolkit for the domain.";
  wrap.appendChild(benefits);

  const pickHelp = document.createElement("p");
  pickHelp.className = "help";
  pickHelp.textContent =
    "Mark each Purview where you have purchased a Dominion Boon. Pay with two Boons from that Purview or reserve two Legend Boon purchases.";
  wrap.appendChild(pickHelp);

  const legFx = legendTraitEffectsSummary(character.legendRating ?? 0, character.tier);
  if (legFx) {
    const legP = document.createElement("p");
    legP.className = "help";
    legP.innerHTML = `<strong>Legend ${legFx.legendRating} (max ${legFx.maxLegend} this tier):</strong> ${legFx.boonPurchasesFromLegend} Purview Boon purchase${legFx.boonPurchasesFromLegend === 1 ? "" : "s"} from Legend dots; ${legFx.callingDotsFromEvenLegend} Calling dot${legFx.callingDotsFromEvenLegend === 1 ? "" : "s"} from even Legend dots (Demigod p. 132).`;
    wrap.appendChild(legP);
  }
  const domLedger = dominionBoonLedgerSummary(character.dominionBoonPurviewIds, character.tier);
  if (domLedger && domLedger.dominionPurviewCount > 0) {
    const domP = document.createElement("p");
    domP.className = "help";
    domP.textContent = domLedger.summary;
    wrap.appendChild(domP);
  }

  appendDominionBoonMarkingUi(wrap, { skipIntro: true });

  const panelEl = panel("Dominion Boons", wrap);
  applyHint(panelEl, "dominion-boons-step");
  root.appendChild(panelEl);
}

function renderDominionStunts(root) {
  pruneDominionState();
  const wrap = document.createElement("div");

  const intro = document.createElement("p");
  intro.className = "help";
  intro.innerHTML =
    "<strong>Scion: Demigod pp. 156–157 — Dominion Stunts:</strong> once you hold a <strong>Dominion Boon</strong> in a Purview (two Purview Boons forgone in play), you and allied characters gain the <strong>full</strong> stunt list for that Purview (reference below). Declare which stunts are <strong>active for the scene</strong> at scene start or when rolling Initiative; most cost <strong>successes</strong> (1–5) from a relevant roll rather than Legend. Only one copy of each stunt may be active in the Band at a time; overlapping Purviews grant +1 Enhancement per Scion (max +3). <strong>Gift of Power</strong> (General) appears once you hold any Dominion Boon.";
  wrap.appendChild(intro);

  const grouped = dominionStuntsGroupedByPurview(bundle);
  const showPurviews = dominionStuntPurviewKeysForExport(
    {
      tier: character.tier,
      tierId: character.tier,
      pantheonId: character.pantheonId,
      purviews: character.purviewIds,
      patronPurviewSlots: character.patronPurviewSlots,
      dominionBoonPurviewIds: character.dominionBoonPurviewIds,
    },
    bundle,
  );
  let anyStunts = false;

  for (const pvKey of showPurviews) {
    const rows = grouped.get(pvKey);
    if (!rows || rows.length === 0) continue;
    anyStunts = true;
    const sec = document.createElement("section");
    sec.className = "boon-purview-group dominion-stunt-group";
    const h = document.createElement("h4");
    h.className = "boon-purview-heading";
    if (pvKey === "_general") {
      h.textContent = "General (all Demigods)";
    } else {
      h.textContent = purviewDisplayNameForPantheon(pvKey, bundle, character.pantheonId);
      const pvHead = bundle.purviews?.[pvKey];
      if (pvHead && typeof pvHead === "object") {
        applyGameDataHint(h, { ...pvHead, name: h.textContent });
      }
    }
    sec.appendChild(h);

    const list = document.createElement("div");
    list.className = "dominion-stunt-list";
    for (const st of rows) {
      const row = document.createElement("div");
      row.className = "dominion-stunt-row";
      const chipWrap = document.createElement("div");
      chipWrap.className = "chips dominion-stunt-chip-wrap";
      const label = document.createElement("span");
      label.className = "chip on chip-locked dominion-stunt-chip";
      const costLabel = st.successCost ? ` (${st.successCost})` : "";
      label.textContent = `${st.name}${costLabel}`;
      label.title = "Full access with Dominion in this Purview — declare active stunts at the table.";
      chipWrap.appendChild(label);
      row.appendChild(chipWrap);
      const desc = document.createElement("p");
      desc.className = "help dominion-stunt-desc";
      desc.textContent = String(st.description || "").trim();
      row.appendChild(desc);
      applyGameDataHint(label, st);
      list.appendChild(row);
    }
    sec.appendChild(list);
    wrap.appendChild(sec);
  }

  if (!anyStunts) {
    const none = document.createElement("p");
    none.className = "help";
    none.textContent =
      "Mark at least one Dominion Boon above (trade two Purview Boons in play for Dominion over that Purview) to unlock that Purview's stunt reference list. Gift of Power appears under General once you hold any Dominion Boon.";
    wrap.appendChild(none);
  }

  const panelEl = panel("Dominion Stunts", wrap);
  applyHint(panelEl, "dominion-stunts-step");
  root.appendChild(panelEl);
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
        ? "<strong>Saints & Monsters p. 87 — Finishing Touches (Mortal Sorcerer):</strong> five extra Skill dots and one extra Attribute dot (same as other Mortal-tier humans), then choose <em>one</em> of: <strong>two additional Techniques</strong> (describe them — not Calling Knacks), <strong>four Paraphernalia points</strong> on templates below, or <strong>one Technique plus two Paraphernalia points</strong>. You also receive one <strong>Motif</strong> (record on the Sorcerer tab). No Source of Power yet (pp. 64–65, 85, 87)."
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
  budget.className = "wizard-triple-field-row finishing-budget-row";
  if (heroLikeFinishing) {
    budget.innerHTML = `
    <div class="field"><label>Extra skill dots (budget)</label><input type="number" id="fin-skill" min="0" max="20" /></div>
    <div class="field"><label>Extra attribute dot(s) (budget)</label><input type="number" id="fin-attr" min="0" max="10" /></div>
    <p class="help" id="fin-focus-hero-note">Extra Knacks from Origin Finishing stay in your save; this step does not offer them again. Birthrights at Hero/Titanic (seven points) are on the <strong>Birthrights</strong> step.</p>`;
  } else if (tierFin === "sorcerer") {
    budget.innerHTML = `
    <div class="field"><label>Extra skill dots (budget)</label><input type="number" id="fin-skill" min="0" max="20" /></div>
    <div class="field"><label>Extra attribute dot(s) (budget)</label><input type="number" id="fin-attr" min="0" max="10" /></div>
    <div class="field"><label>Step Seven package (S&amp;M p. 87)</label>
      <select id="fin-sorc-mort-pkg">
        <option value="two_techniques">Two additional Techniques</option>
        <option value="four_paraphernalia">Four Paraphernalia points</option>
        <option value="one_technique_two_paraphernalia">One Technique + two Paraphernalia points</option>
      </select>
    </div>`;
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
  const budgetSkFin = Math.max(0, Math.round(Number(character.finishing.extraSkillDots) || 0));
  const budgetAtFin = Math.max(0, Math.round(Number(character.finishing.extraAttributeDots) || 0));
  const underspendSkFin = budgetSkFin > 0 && remSk > 0;
  const underspendAtFin = budgetAtFin > 0 && remAt > 0;

  const sum = document.createElement("p");
  sum.id = "fin-budget-summary";
  sum.className = "help finishing-budget-summary";
  sum.textContent = `Skill finishing: ${placedSk} / ${character.finishing.extraSkillDots || 0} dots placed (${remSk} remaining). Attribute finishing: ${placedAt} / ${character.finishing.extraAttributeDots || 0} dot(s) placed (${remAt} remaining).`;
  wrap.appendChild(sum);

  const w = document.createElement("p");
  w.id = "fin-budget-warn";
  w.className = "warn";
  w.hidden = !(overSk || overAt);
  w.textContent =
    (overSk ? "Placed skill dots exceed the budget — raise “Extra skill dots” or lower Skills below. " : "") +
    (overAt ? "Placed attribute dots exceed the budget — raise “Extra attribute dot(s)” or lower Attributes below." : "");
  wrap.appendChild(w);

  const missingSpec = skillIdsMissingChargenSpecialties();
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
    "panel finishing-place-panel" +
    (overSk || underspendSkFin || missingSpec.length > 0 ? " panel-gate-invalid" : "");
  skPanel.innerHTML = "<h2>Skills — spend finishing dots</h2>";
  const { left: finSkLeft, right: finSkRight } = skillIdsSplitForSkillsTables(bundle);
  const finSkTwoCol = document.createElement("div");
  finSkTwoCol.className = "skill-ratings-two-cols";

  function appendFinishingSkillsTable(skillIdList) {
    const skTable = document.createElement("table");
    skTable.className = "skill-ratings-table finishing-skills-table";
    appendSkillRatingsTableThead(skTable);
    const skBody = document.createElement("tbody");
    for (const sid of skillIdList) {
      const s = bundle.skills[sid];
      const val = character.skillDots[sid] || 0;
      const tr = document.createElement("tr");
      tr.className =
        "skill-rating-row" + (missingSpec.includes(sid) ? " skill-rating-row--gate-invalid" : "");
      appendSkillRatingNameCell(tr, sid, s, val, { skillsTableSpecialty: true });
      appendSkillRatingDotsCell(tr, sid, s, val, "finishing");
      skBody.appendChild(tr);
    }
    skTable.appendChild(skBody);
    finSkTwoCol.appendChild(skTable);
  }
  appendFinishingSkillsTable(finSkLeft);
  appendFinishingSkillsTable(finSkRight);
  skPanel.appendChild(finSkTwoCol);
  wrap.appendChild(skPanel);

  const atPanel = document.createElement("section");
  atPanel.id = "fin-attrs-panel";
  atPanel.className =
    "panel finishing-place-panel" + (overAt || underspendAtFin ? " panel-gate-invalid" : "");
  const atH = document.createElement("h2");
  atH.textContent = "Attributes — spend finishing dot(s)";
  atPanel.appendChild(atH);
  const atHelp = document.createElement("p");
  atHelp.className = "help";
  atHelp.textContent =
    tierFin === "sorcerer"
      ? "Saints & Monsters p. 87: one extra Attribute dot at Mortal Sorcerer creation (same as other human-tier characters). Spend it on an Attribute — not banked or traded."
      : "Origin p. 98: one extra Attribute dot at character creation for each player character. It must be spent on an Attribute (not banked or traded).";
  atPanel.appendChild(atHelp);
  const finAttrBase = buildCharacterAttrsPre();
  const finAttrFinal = applyFavoredApproach(finAttrBase);
  const finArenasGrid = document.createElement("div");
  finArenasGrid.className = "attributes-arenas-grid";
  for (const arena of arenaRankForDisplay()) {
    const sub = document.createElement("div");
    sub.className = "panel attributes-arena-panel";
    sub.innerHTML = `<h2>${arena} (${arenaPools()[arena]} dots beyond base 1 each)</h2>`;
    for (const id of ARENAS[arena]) {
      const meta = bundle.attributes[id];
      if (!meta || String(id).startsWith("_")) continue;
      const maxFinal = maxFinalAttrFinishing(id);
      const finalVal = finAttrFinal[id] ?? 1;
      const snap = character.finishing.attrBaseline?.[id];
      const baselinePre =
        snap != null ? Math.max(1, Math.min(5, Math.round(Number(snap)))) : (finAttrBase[id] ?? 1);
      const attrsLockedPre = { ...finAttrBase, [id]: baselinePre };
      const finalLockedThrough = Math.min(applyFavoredApproach(attrsLockedPre)[id] ?? 1, maxFinal);
      sub.appendChild(
        renderFinalAttrDotRow(
          meta.name,
          finalVal,
          maxFinal,
          (picked) => {
            const fav = resolvedFavoredApproach();
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
          false,
        ),
      );
    }
    finArenasGrid.appendChild(sub);
  }
  atPanel.appendChild(finArenasGrid);
  wrap.appendChild(atPanel);

  /* Hero / Titanic / Heroic Sorcerer: Origin Finishing already offered extra Knacks or four Birthright points — do not repeat that UI here. */
  if (!heroLikeFinishing) {
    const sorcMort = tierFin === "sorcerer";
    const pkgS = sorcMort ? String(character.finishing.sorcererMortalFinishingPackage || "four_paraphernalia").trim() : "";
    const knBrInvalid = finishingKnackOrBirthrightPanelGateInvalid();
    const knBr = document.createElement("section");
    knBr.id = "fin-knack-br-panel";
    knBr.className = "panel finishing-place-panel" + (knBrInvalid ? " panel-gate-invalid" : "");
    if (sorcMort && (pkgS === "two_techniques" || pkgS === "one_technique_two_paraphernalia")) {
      const title = pkgS === "two_techniques" ? "Two additional Techniques (Step Seven)" : "One additional Technique + two Paraphernalia points";
      const h2m = document.createElement("h2");
      h2m.textContent = title;
      knBr.appendChild(h2m);
      const hel = document.createElement("p");
      hel.className = "help";
      hel.innerHTML =
        pkgS === "two_techniques"
          ? "Saints & Monsters p. 87: pick <strong>two</strong> additional Techniques from your Working’s list (Workings chapter, pp. 65–78). Leave Paraphernalia picks empty for this package."
          : "Saints & Monsters p. 87: pick <strong>one</strong> additional Technique from the chips, then spend exactly <strong>two</strong> Paraphernalia points in the catalog below.";
      knBr.appendChild(hel);
      appendSorceryTechniqueChipsInto(knBr, "mortal_finishing");
      const ta = document.createElement("textarea");
      ta.id = "fin-sorc-mort-tech-notes";
      ta.rows = 2;
      ta.className = "finishing-sorcerer-mortal-tech-notes";
      ta.setAttribute("aria-label", "Optional notes for Mortal Sorcerer Step Seven Techniques");
      ta.placeholder = "Optional SG / table notes (not required if chips are set)";
      ta.value = character.finishing.sorcererMortalExtraTechniquesNotes || "";
      ta.addEventListener("input", () => {
        ensureFinishingShape();
        character.finishing.sorcererMortalExtraTechniquesNotes = ta.value;
        refreshFinishingWizardGateUiFromDom();
      });
      knBr.appendChild(ta);
    }
    if (!sorcMort && character.finishing.knackOrBirthright === "knacks") {
      knBr.innerHTML = `<h2>Extra Knacks (pick up to 2)</h2>`;
      const callingKnackSet = new Set(character.knackIds || []);
      const finUniq = [...new Set(character.finishing.finishingKnackIds || [])];
      const knackEntriesFin = Object.entries(bundle.knacks)
        .filter(([kid, k]) => !kid.startsWith("_") && isEntryVisibleForBooks(k, allowedBooks))
        .sort((a, b) => {
          const na = String(a[1]?.name || a[0]);
          const nb = String(b[1]?.name || b[0]);
          const c = na.localeCompare(nb, undefined, { sensitivity: "base" });
          if (c !== 0) return c;
          return String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: "base" });
        });

      /** @param {HTMLElement} container */
      function appendFinishingKnackChip(container, kid, k) {
        const eligibleFin = knackEligibleForFinishingExtraKnack(k, character, bundle);
        const on = character.finishing.finishingKnackIds.includes(kid);
        const inCalling = callingKnackSet.has(kid);
        const eligibleShow = on ? knackFinishingPickIsValidHeld(k, character, bundle) : eligibleFin;
        if (!eligibleShow && !on && !inCalling) return;
        if (inCalling && !on) {
          const chipKnown = document.createElement("button");
          chipKnown.type = "button";
          chipKnown.className = "chip on chip-knack-already-known";
          chipKnown.disabled = true;
          chipKnown.title = "Already chosen as your Calling Knack — shown here for reference in this pool.";
          setKnackChipContents(chipKnown, k);
          const appliesKnown = knackAppliesToCallingsLine(k, bundle, character);
          applyGameDataHint(chipKnown, k, appliesKnown ? { prefix: appliesKnown } : undefined);
          container.appendChild(chipKnown);
          return;
        }
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
        const appliesLine = knackAppliesToCallingsLine(k, bundle, character);
        applyGameDataHint(chip, k, appliesLine ? { prefix: appliesLine } : undefined);
        chip.addEventListener("click", () => {
          toggleFinishingKnack(kid);
          render();
        });
        container.appendChild(chip);
      }

      if (isOriginPlayTier(character.tier)) {
        const originCallingId = String(character.callingId || "").trim();
        /** @type {Map<"selected" | "any", [string, Record<string, unknown>][]>} */
        const finBuckets = new Map([
          ["selected", []],
          ["any", []],
        ]);
        for (const [kid, k] of knackEntriesFin) {
          const eligibleFin = knackEligibleForFinishingExtraKnack(k, character, bundle);
          const on = character.finishing.finishingKnackIds.includes(kid);
          const inCalling = callingKnackSet.has(kid);
          const eligibleShow = on ? knackFinishingPickIsValidHeld(k, character, bundle) : eligibleFin;
          if (!eligibleShow && !on && !inCalling) continue;
          finBuckets.get(originCallingKnackChipGroupKey(k, character, bundle)).push([kid, k]);
        }
        for (const key of /** @type {("selected" | "any")[]} */ (["selected", "any"])) {
          const list = finBuckets.get(key) || [];
          if (key === "selected" && list.length > 0) {
            const split = splitMotmKnackEntriesBySubpool(list, character, originCallingId, bundle);
            if (split && (split.standard.length || split.inverted.length)) {
              appendMotmTwinKnackPoolSections(knBr, split, originCallingId, {
                appendChip: (container, kid, k) => appendFinishingKnackChip(container, kid, k),
              });
              continue;
            }
          }
          const section = document.createElement("div");
          section.className = "calling-knack-chip-group finishing-extra-knack-group";
          const head = document.createElement("h3");
          head.className = "calling-knack-chip-group-title";
          if (key === "any") {
            head.textContent = GENERAL_CALLING_LABEL;
          } else {
            head.textContent = motmCallingKnackGroupTitle(originCallingId, bundle, { yourCalling: true });
          }
          section.appendChild(head);
          if (key === "selected") {
            appendMotmCallingRowHint(section, originCallingId, motmCallingPairForRow(originCallingId, bundle));
          }
          const chipWrap = document.createElement("div");
          chipWrap.className = "calling-knack-chip-group-body";
          if (list.length === 0) {
            const empty = document.createElement("p");
            empty.className = "help";
            empty.textContent =
              "No extra Knacks in this group match your gates, or every candidate is already your Calling Knack — adjust Calling or clear picks.";
            chipWrap.appendChild(empty);
          } else if (key === "selected") {
            appendKnackChipsWithMotmSubpools(chipWrap, list, originCallingId || undefined, {
              appendChip: (container, kid, k) => appendFinishingKnackChip(container, kid, k),
            });
          } else {
            const chips = document.createElement("div");
            chips.className = "chips chips--calling-knack-subgroup";
            for (const [kid, k] of list) appendFinishingKnackChip(chips, kid, k);
            chipWrap.appendChild(chips);
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
      const finBirthCap = finishingParaphernaliaPointsCap();
      if (!(sorcMort && finBirthCap <= 0)) {
      const cap = finBirthCap;
      const brSub = document.createElement("div");
      brSub.className = "finishing-paraphernalia-birthrights-subpanel";
      const h2br = document.createElement("h2");
      h2br.textContent = sorcMort ? "Paraphernalia" : `Birthrights (up to ${cap} points)`;
      brSub.appendChild(h2br);
      const hp = document.createElement("p");
      hp.className = "help";
      hp.innerHTML = sorcMort
        ? "Saints & Monsters p. 87: spend your Paraphernalia allowance on Birthright templates (Relics, Creatures, Followers, Guides, etc.). Same catalog as other lines — each row shows its point cost."
        : "Add templates or examples below; each pick costs its listed points (data). Remove picks to free points. The same catalog entry may be picked more than once if your budget allows. These picks count toward your tier Birthrights budget (same list as the Birthrights step).";
      brSub.appendChild(hp);
      const used = finishingBirthrightPointsUsed();
      const pts = document.createElement("p");
      pts.className = "help";
      const finBrXp = experiencePurchaseCost(bundle, "birthright");
      pts.textContent = `Points used: ${used} / ${cap}. Extra Birthrights beyond the cap are purchased on the Exp Leveling tab (${finBrXp ?? 5} XP each).`;
      brSub.appendChild(pts);
      const finBar = document.createElement("div");
      finBar.className = "picker-toolbar";
      const finBrSearch = document.createElement("input");
      finBrSearch.type = "search";
      finBrSearch.className = "picker-search";
      finBrSearch.placeholder = "Filter by name, type, or id…";
      finBrSearch.autocomplete = "off";
      finBrSearch.setAttribute("aria-label", "Filter finishing birthrights");
      finBar.appendChild(finBrSearch);
      brSub.appendChild(finBar);
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
      const usedBr = finishingBirthrightPointsUsed();
      const finEntries = Object.entries(bundle.birthrights)
        .filter(([id, br]) => !id.startsWith("_") && !isChargenWizardHiddenBirthrightRow(br, id) && isEntryVisibleForBooks(br, allowedBooks))
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
        const finAddMeta = birthrightAddButtonMeta(bid, usedBr, cap);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn secondary" + (finAddMeta.xpBuy ? " btn-experience-unlock" : "");
        btn.textContent = finAddMeta.underBudget ? "Add" : finAddMeta.xpBuy ? `Add (${finAddMeta.xpCost} XP)` : "Add";
        btn.disabled = !finAddMeta.enabled;
        applyGameDataHint(btn, br);
        const addHintFin = finAddMeta.underBudget
          ? "Adds another pick of this template if you want several of the same Birthright (each costs its points)."
          : finAddMeta.xpBuy
            ? `Spend ${finAddMeta.xpCost ?? 5} Experience for this Birthright (beyond chargen budget).`
            : `Not enough points left for this cost (${cost}). Remove picks below to free budget.`;
        btn.title = btn.title ? `${btn.title}\n\n${addHintFin}` : addHintFin;
        btn.addEventListener("click", () => {
          if (tryAddBirthrightPick(bid)) render();
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
      brSub.appendChild(finScroll);
      appendBirthrightPicksList(brSub);
      knBr.appendChild(brSub);
      }
    }
    wrap.appendChild(knBr);
  }

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
    .filter(([eid, eq]) => !eid.startsWith("_") && !isChargenWizardHiddenEquipmentRow(eq, eid) && isEntryVisibleForBooks(eq, allowedBooks))
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
  if (eqEntries.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "help book-filter-empty";
    emptyMsg.textContent = "No entries available for the current book selection. Adjust the Source Books filter to see more options.";
    eqCat.appendChild(emptyMsg);
  }
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
  equipmentPanel.appendChild(eqLayout);
  wrap.appendChild(equipmentPanel);

  const fatebindingsPanel = document.createElement("section");
  fatebindingsPanel.className = "panel finishing-place-panel";
  appendFatebindingsFinishingEditor(fatebindingsPanel, character, {
    idPrefix: "fin-fb",
    render,
    prepareState: () => ensureSheetAppendicesShape(),
    trackHint: isSorcererLineTier(character.tier)
      ? "Sorcerer (Saints & Monsters): Fatebindings match the Deity-track sheet layout; confirm limits in ch. 3."
      : null,
  });
  wrap.appendChild(fatebindingsPanel);

  const extendedNotesPanel = document.createElement("section");
  extendedNotesPanel.className = "panel finishing-place-panel";
  appendFinishingExtendedNotesPanel(extendedNotesPanel, character, { textareaId: "fin-sheet-notes" });
  wrap.appendChild(extendedNotesPanel);

  root.appendChild(panel("Finishing Touches", wrap));

  document.getElementById("fin-skill").value = String(character.finishing.extraSkillDots);
  document.getElementById("fin-attr").value = String(character.finishing.extraAttributeDots);
  const finFocusEl = document.getElementById("fin-focus");
  if (finFocusEl) finFocusEl.value = character.finishing.knackOrBirthright;
  const pkgMortEl = document.getElementById("fin-sorc-mort-pkg");
  if (pkgMortEl) {
    pkgMortEl.value = character.finishing.sorcererMortalFinishingPackage || "four_paraphernalia";
    pkgMortEl.addEventListener("change", (e) => {
      ensureFinishingShape();
      const v = e.target.value;
      if (v === "two_techniques" || v === "four_paraphernalia" || v === "one_technique_two_paraphernalia") {
        character.finishing.sorcererMortalFinishingPackage = v;
        trimBirthrightPicksToBudget();
        render();
      }
    });
  }
  const sheetNotesEl = document.getElementById("fin-sheet-notes");
  if (sheetNotesEl) sheetNotesEl.value = character.sheetNotesExtra || "";

  const syncBudget = () => {
    ensureFinishingShape();
    character.finishing.extraSkillDots = Math.max(0, Number(document.getElementById("fin-skill")?.value || 0));
    character.finishing.extraAttributeDots = Math.max(0, Number(document.getElementById("fin-attr")?.value || 0));
    render();
  };
  const finSkillInput = document.getElementById("fin-skill");
  const finAttrInput = document.getElementById("fin-attr");
  finSkillInput.onchange = syncBudget;
  finAttrInput.onchange = syncBudget;
  finSkillInput.addEventListener("input", () => {
    ensureFinishingShape();
    character.finishing.extraSkillDots = Math.max(0, Number(finSkillInput.value || 0));
    refreshFinishingWizardGateUiFromDom();
  });
  finAttrInput.addEventListener("input", () => {
    ensureFinishingShape();
    character.finishing.extraAttributeDots = Math.max(0, Number(finAttrInput.value || 0));
    refreshFinishingWizardGateUiFromDom();
  });
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

function renderExpLeveling(root) {
  ensureExperienceShape();
  const wrap = document.createElement("div");
  wrap.className = "exp-leveling-wrap";

  const poolSec = document.createElement("section");
  poolSec.className = "panel exp-leveling-pool-panel";
  const poolH = document.createElement("h2");
  poolH.textContent = "Experience pool";
  poolSec.appendChild(poolH);
  const poolHelp = document.createElement("p");
  poolHelp.className = "help";
  poolHelp.textContent =
    "Enter unspent Experience earned in play. Purchases on this step are previewed only — you can change your mind freely until you leave (Back or another tab), when you will be asked to save them. Chargen tabs stay locked — advance your character here after Review (Origin p. 113; Boons and Techniques also Saints & Monsters p. 87).";
  poolSec.appendChild(poolHelp);
  const poolActions = document.createElement("div");
  poolActions.className = "exp-leveling-pool-actions";
  if (expLevelingSessionDirty(character)) {
    const draftNote = document.createElement("p");
    draftNote.className = "help exp-leveling-draft-note";
    draftNote.textContent =
      "Unsaved Experience purchases on this step — leave via Back or another tab to save, or use Reset to undo everything from this visit.";
    poolActions.appendChild(draftNote);
  }
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "btn secondary exp-leveling-reset-btn";
  resetBtn.textContent = "Reset";
  resetBtn.disabled = !expLevelingSessionDirty(character);
  resetBtn.title = "Undo all Experience purchases made since you opened Exp Leveling.";
  resetBtn.addEventListener("click", () => {
    if (!expLevelingSessionDirty(character)) return;
    if (!window.confirm(RESET_CONFIRM_MESSAGE)) return;
    if (resetExpLevelingSession(character)) render();
  });
  poolActions.appendChild(resetBtn);
  poolSec.appendChild(poolActions);
  const poolRow = document.createElement("div");
  poolRow.className = "exp-leveling-pool-row field";
  const poolLab = document.createElement("label");
  poolLab.htmlFor = "exp-leveling-points";
  poolLab.textContent = "Unspent Experience";
  const poolInp = document.createElement("input");
  poolInp.type = "number";
  poolInp.min = "0";
  poolInp.step = "1";
  poolInp.id = "exp-leveling-points";
  poolInp.className = "exp-leveling-points-input";
  poolInp.value = String(experiencePointsAvailable(character));
  poolInp.setAttribute("aria-label", "Unspent Experience points");
  poolInp.addEventListener("change", () => {
    character.experiencePoints = Math.max(0, Math.round(Number(poolInp.value) || 0));
    render();
  });
  poolRow.appendChild(poolLab);
  poolRow.appendChild(poolInp);
  const poolRem = document.createElement("span");
  poolRem.className = "help exp-leveling-pool-remainder";
  poolRem.textContent = `Total XP spent: ${experiencePointsSpent(character)}`;
  poolRow.appendChild(poolRem);
  poolSec.appendChild(poolRow);

  const costTbl = document.createElement("table");
  costTbl.className = "skill-ratings-table exp-leveling-cost-table";
  const cHead = document.createElement("thead");
  const cHr = document.createElement("tr");
  ["Purchase", "Cost"].forEach((lab) => {
    const th = document.createElement("th");
    th.textContent = lab;
    cHr.appendChild(th);
  });
  cHead.appendChild(cHr);
  costTbl.appendChild(cHead);
  const cBody = document.createElement("tbody");
  for (const row of experienceAdvancementTableRows(bundle)) {
    const r = /** @type {{ object?: string; change?: string; cost?: number }} */ (row);
    const tr = document.createElement("tr");
    const tdObj = document.createElement("td");
    tdObj.textContent = r.change ? `${r.object || "?"} — ${r.change}` : String(r.object || "?");
    const tdCost = document.createElement("td");
    tdCost.textContent = `${r.cost ?? "?"} XP`;
    tdCost.className = "exp-leveling-cost-num";
    tr.appendChild(tdObj);
    tr.appendChild(tdCost);
    cBody.appendChild(tr);
  }
  costTbl.appendChild(cBody);
  poolSec.appendChild(costTbl);
  wrap.appendChild(poolSec);

  const attrSec = document.createElement("section");
  attrSec.className = "panel exp-leveling-attributes-panel";
  attrSec.innerHTML = `<h2>Attributes (${experiencePurchaseCost(bundle, "attribute") ?? 10} XP per dot)</h2>`;
  const attrHelp = document.createElement("p");
  attrHelp.className = "help";
  attrHelp.textContent = "Raise individual Attributes one dot at a time (after Favored Approach is applied).";
  attrSec.appendChild(attrHelp);
  const attrBase = {};
  for (const id of Object.keys(bundle.attributes || {})) {
    if (String(id).startsWith("_")) continue;
    attrBase[id] = character.attributes[id] ?? 1;
  }
  const attrFinal = applyFavoredApproach(attrBase);
  const attrGrid = document.createElement("div");
  attrGrid.className = "attributes-arenas-grid";
  for (const arena of arenaRankForDisplay()) {
    const sub = document.createElement("div");
    sub.className = "panel attributes-arena-panel";
    sub.innerHTML = `<h3>${arena}</h3>`;
    for (const id of ARENAS[arena]) {
      const meta = bundle.attributes[id];
      const maxFinal = 5;
      const finalVal = attrFinal[id] ?? 1;
      sub.appendChild(
        renderFinalAttrDotRow(
          meta.name,
          finalVal,
          maxFinal,
          (picked) => {
            const fav = resolvedFavoredApproach();
            let pre = APPROACH_ATTRS[fav].includes(id) ? picked - 2 : picked;
            pre = Math.max(1, Math.min(pre, 5));
            character.attributes[id] = pre;
            render();
          },
          meta,
          1,
          "(after Favored Approach)",
          null,
          true,
          true,
        ),
      );
    }
    attrGrid.appendChild(sub);
  }
  attrSec.appendChild(attrGrid);
  wrap.appendChild(attrSec);

  const favSec = document.createElement("section");
  favSec.className = "panel exp-leveling-favored-panel field field-experience-unlock";
  const favH = document.createElement("h2");
  favH.textContent = `Favored Approach (${experiencePurchaseCost(bundle, "favoredApproach") ?? 15} XP to change)`;
  favSec.appendChild(favH);
  const favLab = document.createElement("label");
  favLab.htmlFor = "exp-fav-approach";
  favLab.textContent = "Favored Approach";
  const favSel = document.createElement("select");
  favSel.id = "exp-fav-approach";
  FAVORED_APPROACHES_SORTED.forEach((a) => {
    const o = document.createElement("option");
    o.value = a;
    o.textContent = a;
    favSel.appendChild(o);
  });
  favSel.value = character.favoredApproach;
  favSel.disabled = !experienceCanAfford(character, bundle, "favoredApproach");
  favSel.addEventListener("change", () => {
    const prev = character.favoredApproach;
    const next = favSel.value;
    if (next === prev) return;
    if (experienceSpend(character, bundle, "favoredApproach", `Favored Approach → ${next}`)) {
      character.favoredApproach = next;
      render();
    } else {
      favSel.value = prev;
    }
  });
  favSec.appendChild(favLab);
  favSec.appendChild(favSel);
  wrap.appendChild(favSec);

  const skillSec = document.createElement("section");
  skillSec.className = "panel exp-leveling-skills-panel";
  skillSec.innerHTML = `<h2>Skills (${experiencePurchaseCost(bundle, "skill") ?? 5} XP per dot; Specialty ${experiencePurchaseCost(bundle, "specialty") ?? 3} XP)</h2>`;
  const skillHelp = document.createElement("p");
  skillHelp.className = "help";
  skillHelp.textContent = "Raise Skills one dot at a time. At 3+ dots, add a Specialty when empty (costs XP on commit).";
  skillSec.appendChild(skillHelp);
  const { left: skLeft, right: skRight } = skillIdsSplitForSkillsTables(bundle);
  const skTwoCol = document.createElement("div");
  skTwoCol.className = "skill-ratings-two-cols";
  const appendExpSkillsTable = (skillIdList) => {
    const table = document.createElement("table");
    table.className = "skill-ratings-table";
    appendSkillRatingsTableThead(table);
    const tbody = document.createElement("tbody");
    for (const sid of skillIdList) {
      const s = bundle.skills[sid];
      const val = character.skillDots[sid] || 0;
      const tr = document.createElement("tr");
      tr.className = "skill-rating-row";
      appendSkillRatingNameCell(tr, sid, s, val, { skillsTableSpecialty: true, specialtyReadOnly: true });
      appendSkillRatingDotsCell(tr, sid, s, val, "skills");
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    skTwoCol.appendChild(table);
  };
  appendExpSkillsTable(skLeft);
  appendExpSkillsTable(skRight);
  skillSec.appendChild(skTwoCol);
  wrap.appendChild(skillSec);

  const knackSec = document.createElement("section");
  knackSec.className = "panel exp-leveling-knacks-panel";
  knackSec.innerHTML = `<h2>Knacks (${experiencePurchaseCost(bundle, "knack") ?? 10} XP each)</h2>`;
  const knackHelp = document.createElement("p");
  knackHelp.className = "help";
  knackHelp.textContent =
    "Knacks you qualify for but cannot fit in your Calling knack budget appear here, grouped by Calling like the Callings tab. Click a dashed chip to purchase; selected chips stay highlighted — click again to deselect and refund XP.";
  knackSec.appendChild(knackHelp);
  const knackEntries = Object.entries(bundle.knacks || {})
    .filter(([kid, k]) => !kid.startsWith("_") && isEntryVisibleForBooks(k, allowedBooks))
    .sort((a, b) => String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0]), undefined, { sensitivity: "base" }));
  const knackXpCount = appendExpLevelingKnackSections(knackSec, knackEntries);
  if (knackXpCount === 0) {
    const empty = document.createElement("p");
    empty.className = "help";
    empty.textContent = "No Knacks currently available for Experience purchase (budget may not be full, or none qualify).";
    knackSec.appendChild(empty);
  }
  wrap.appendChild(knackSec);

  if (tierHasPurviewStep(character.tier) || (character.boonIds || []).length > 0) {
    const boonSec = document.createElement("section");
    boonSec.className = "panel exp-leveling-boons-panel";
    boonSec.innerHTML = `<h2>Boons (${experiencePurchaseCost(bundle, "boon") ?? 10} XP each)</h2>`;
    const boonHelp = document.createElement("p");
    boonHelp.className = "help";
    const boonBudget = boonBudgetSnapshot(character, bundle);
    boonHelp.textContent = boonBudget.usesLegendBudget
      ? `When your Legend Boon budget (${boonBudget.legendUsed ?? 0} / ${boonBudget.legendTotal ?? 0}) is full, eligible Boons below can be bought with Experience.`
      : boonBudget.heroCap != null
        ? `When your chargen Boon cap (${boonBudget.heroCap}) is full, eligible Boons below can be bought with Experience.`
        : "Eligible Boons you have not taken appear below for Experience purchase when your table uses caps.";
    boonSec.appendChild(boonHelp);
    const atFreeCap = boonBudget.atFreeCap;
    let boonXpCount = 0;
    const boonEntries = Object.entries(bundle.boons || {})
      .filter(([bid]) => !bid.startsWith("_"))
      .sort((a, b) => {
        const pa = String(boonPrimaryPurview(a[1]) || "").localeCompare(String(boonPrimaryPurview(b[1]) || ""));
        if (pa !== 0) return pa;
        return (Number(a[1].dot) || 0) - (Number(b[1].dot) || 0);
      });
    let lastPv = null;
    let pvChips = null;
    for (const [bid, b] of boonEntries) {
      if (boonIsPurviewInnateAutomaticGrant(b, bundle)) continue;
      if (!isEntryVisibleForBooks(b, allowedBooks)) continue;
      const eligible = boonEligible(b, character, bundle);
      const on = character.boonIds.includes(bid);
      const boonXpBuy = !on && eligible && atFreeCap && experienceCanAfford(character, bundle, "boon");
      if (!boonXpBuy) continue;
      boonXpCount += 1;
      const primaryPv = boonPrimaryPurview(b);
      if (primaryPv !== lastPv) {
        const gh = document.createElement("h3");
        gh.className = "boon-purview-heading";
        gh.textContent = purviewDisplayNameForPantheon(String(primaryPv || "").trim(), bundle, character.pantheonId) || primaryPv || "Purview";
        boonSec.appendChild(gh);
        pvChips = document.createElement("div");
        pvChips.className = "chips";
        boonSec.appendChild(pvChips);
        lastPv = primaryPv;
      }
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip chip-experience-unlock";
      const boonChipLabel = boonDisplayLabel(b, bundle, character.pantheonId);
      chip.textContent = boonChipLabel;
      chip.title = `Spend ${experiencePurchaseCost(bundle, "boon")} Experience for this Boon`;
      chip.addEventListener("click", () => {
        if (addExperienceBoonPick(bid)) render();
      });
      applyGameDataHint(chip, { ...b, name: boonChipLabel });
      pvChips.appendChild(chip);
    }
    if (boonXpCount === 0) {
      const empty = document.createElement("p");
      empty.className = "help";
      empty.textContent = boonBudget.usesLegendBudget
        ? atFreeCap
          ? "No affordable eligible Boons at your current XP — raise Experience or adjust Purviews."
          : `Legend Boon budget not full (${boonBudget.legendUsed ?? 0} / ${boonBudget.legendTotal ?? 0}) — pick free Boons on the Boons tab first.`
        : boonBudget.heroCap != null
          ? atFreeCap
            ? "No affordable eligible Boons at your current XP — raise Experience or adjust Purviews."
            : `Chargen Boon cap not reached (${boonBudget.totalBoonCount} / ${boonBudget.heroCap}) — pick free Boons on the Boons tab first.`
          : "No Boons currently listed for Experience purchase.";
      boonSec.appendChild(empty);
    }
    wrap.appendChild(boonSec);
  }

  if (tierSupportsDominionStunts(character.tier)) {
    const domSec = document.createElement("section");
    domSec.className = "panel exp-leveling-dominion-panel";
    domSec.innerHTML = "<h2>Dominion Boons (forgo 2 Boons each)</h2>";
    appendDominionBoonMarkingUi(domSec, { compact: true });
    wrap.appendChild(domSec);
  }

  const brSec = document.createElement("section");
  brSec.className = "panel exp-leveling-birthrights-panel";
  brSec.innerHTML = `<h2>Birthrights (${experiencePurchaseCost(bundle, "birthright") ?? 5} XP each)</h2>`;
  const brHelp = document.createElement("p");
  brHelp.className = "help";
  const brUsed = finishingBirthrightPointsUsed();
  const brCap = maxBirthrightPointsBudget();
  brHelp.textContent = `Chargen budget: ${brUsed} / ${brCap} points on Birthrights/Finishing picks. Add templates below for ${experiencePurchaseCost(bundle, "birthright") ?? 5} XP each (beyond budget).`;
  brSec.appendChild(brHelp);
  const brBar = document.createElement("div");
  brBar.className = "picker-toolbar";
  const brSearch = document.createElement("input");
  brSearch.type = "search";
  brSearch.className = "picker-search";
  brSearch.placeholder = "Filter birthrights…";
  brSearch.autocomplete = "off";
  brBar.appendChild(brSearch);
  brSec.appendChild(brBar);
  const brScroll = document.createElement("div");
  brScroll.className = "picker-scroll";
  const brTbl = document.createElement("table");
  brTbl.className = "skill-ratings-table birthrights-table";
  const brThead = document.createElement("thead");
  const brHr = document.createElement("tr");
  ["Entry", "Type", "Pts", ""].forEach((lab) => {
    const th = document.createElement("th");
    th.textContent = lab;
    brHr.appendChild(th);
  });
  brThead.appendChild(brHr);
  brTbl.appendChild(brThead);
  const brBody = document.createElement("tbody");
  const brEntries = Object.entries(bundle.birthrights || {})
    .filter(([id, br]) => !id.startsWith("_") && !isChargenWizardHiddenBirthrightRow(br, id) && isEntryVisibleForBooks(br, allowedBooks))
    .sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0]));
  for (const [bid, br] of brEntries) {
    const addMeta = birthrightAddButtonMeta(bid, brUsed, brCap);
    if (!addMeta.xpBuy) continue;
    const tr = document.createElement("tr");
    tr.setAttribute("data-filter-text", `${br.name || bid} ${bid} ${br.birthrightType || ""}`.trim());
    const tdN = document.createElement("td");
    tdN.textContent = br.name || bid;
    const tdT = document.createElement("td");
    tdT.textContent = br.birthrightType || "—";
    const tdP = document.createElement("td");
    tdP.textContent = String(birthrightPointCost(bid));
    const tdA = document.createElement("td");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn secondary btn-experience-unlock";
    btn.textContent = `Add (${addMeta.xpCost} XP)`;
    btn.addEventListener("click", () => {
      if (tryAddBirthrightPick(bid)) render();
    });
    applyGameDataHint(btn, br);
    tdA.appendChild(btn);
    tr.appendChild(tdN);
    tr.appendChild(tdT);
    tr.appendChild(tdP);
    tr.appendChild(tdA);
    brBody.appendChild(tr);
  }
  brTbl.appendChild(brBody);
  wirePickerRowFilter(brSearch, brBody);
  brScroll.appendChild(brTbl);
  brSec.appendChild(brScroll);
  if (brBody.children.length === 0) {
    const empty = document.createElement("p");
    empty.className = "help";
    empty.textContent = "No affordable Birthright templates at current XP (or chargen budget still has room — use Birthrights tab).";
    brSec.appendChild(empty);
  }
  const brPicksHost = document.createElement("div");
  brPicksHost.className = "exp-leveling-birthright-picks";
  appendBirthrightPicksList(brPicksHost, { emptyText: "No Birthright picks yet." });
  brSec.appendChild(brPicksHost);
  wrap.appendChild(brSec);

  if (isSorcererLineTier(character.tier)) {
    ensureSorceryProfileShape();
    const techHost = document.createElement("section");
    techHost.className = "panel exp-leveling-techniques-panel";
    const mode = normalizedTierId(character.tier) === "sorcerer" ? "mortal_finishing" : "hero_profile";
    appendSorceryTechniqueChipsInto(techHost, mode);
    wrap.appendChild(techHost);
  }

  const panelEl = panel("Exp Leveling", wrap);
  applyHint(panelEl, "exp-leveling-step");
  root.appendChild(panelEl);
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
  toolbar.appendChild(btnThisSheetPdf);
  wrap.appendChild(toolbar);

  const sheetHooks = isDragonHeirChargen(character)
    ? {
        getLegendPoolSpentAt: () => false,
        setLegendPoolSpentAt: () => {},
        getAwarenessPoolSpentAt: () => false,
        setAwarenessPoolSpentAt: () => {},
        getInheritancePoolSpentAt: (idx) => {
          ensureDragonShape(character, bundle);
          return !!(character.dragon.inheritancePoolDotSpentSlots && character.dragon.inheritancePoolDotSpentSlots[idx]);
        },
        setInheritancePoolSpentAt: (idx, v) => {
          ensureDragonShape(character, bundle);
          const slots = character.dragon.inheritancePoolDotSpentSlots;
          if (idx >= 0 && idx < slots.length) {
            character.dragon.inheritancePoolDotSpentSlots[idx] = !!v;
            render();
          }
        },
        onInheritancePoolDotClick: (i) => {
          ensureDragonShape(character, bundle);
          const cap = DRAGON_INHERITANCE_POOL_SHEET_DOT_COUNT;
          let cur = Math.round(Number(character.dragon.inheritancePoolRating) || 0);
          if (Number.isNaN(cur)) cur = 0;
          cur = Math.max(0, Math.min(cap, cur));
          if (cur === i) character.dragon.inheritancePoolRating = Math.max(0, i - 1);
          else character.dragon.inheritancePoolRating = Math.min(i, cap);
          ensureDragonShape(character, bundle);
          render();
        },
      }
    : {
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
          const maxT = LEGEND_SHEET_DOT_COUNT;
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
        : normalizedTierId(character.tier) === "god"
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
      const landedStep = stepDefsForTier(res.newTier)[stepIndex];
      if (landedStep === "review") reviewViewMode = "sheet";
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
  trimBirthrightPicksToBudget();
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
      ...snap,
    };
  }
  const p = selectedPantheon();
  const deity = patronListForPantheon(p).find((d) => d.id === character.parentDeityId);
  const fullPreAttrs = {};
  for (const id of Object.keys(bundle.attributes)) {
    if (String(id).startsWith("_")) continue;
    fullPreAttrs[id] = Math.max(1, Math.min(5, Math.round(Number(character.attributes[id] ?? 1))));
  }
  const baseline = character.finishing?.attrBaseline;
  const baseAttrs = {};
  if (baseline && typeof baseline === "object") {
    for (const id of Object.keys(bundle.attributes)) {
      if (String(id).startsWith("_")) continue;
      const v = Math.round(Number(baseline[id]));
      baseAttrs[id] = Number.isFinite(v) ? Math.max(1, Math.min(5, v)) : fullPreAttrs[id];
    }
  } else {
    Object.assign(baseAttrs, fullPreAttrs);
  }
  const finalAttrsStep = applyFavoredApproach(baseAttrs);
  const sheetFinalA = sheetFinalAttrsAfterFavored(
    {
      attributesIncludingFinishingBeforeFavored: fullPreAttrs,
      attributesBeforeFavored: baseAttrs,
      attributesAfterFavored: finalAttrsStep,
      favoredApproach: character.favoredApproach,
    },
    bundle,
  );
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
    maxLegend: legendDotMaxForTier(character.tier),
    legendDotMax: LEGEND_SHEET_DOT_COUNT,
    legendTraitEffects: legendTraitEffectsSummary(character.legendRating ?? 0, character.tier),
    dominionBoonLedger: dominionBoonLedgerSummary(character.dominionBoonPurviewIds, character.tier),
    legendPoolDotSpentSlots: padPoolSlotArray(
      character.legendPoolDotSpentSlots || [],
      Math.max(LEGEND_SHEET_DOT_COUNT, legendDotMaxForTier(character.tier)),
    ),
    awarenessRating: clampAwarenessRating(character.awarenessRating ?? 1),
    awarenessDotMax: isMythosPantheonSelected() ? awarenessDotMaxForTier(character.tier) : 1,
    awarenessPoolDotSpentSlots: padPoolSlotArray(
      character.awarenessPoolDotSpentSlots || [],
      isMythosPantheonSelected()
        ? Math.max(LEGEND_SHEET_DOT_COUNT, awarenessDotMaxForTier(character.tier))
        : 1,
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
    ...(() => {
      const bSk = character.finishing?.skillBaseline;
      const fullSkills = {};
      const skillsStep = {};
      for (const sid of skillIds()) {
        const full = Math.max(0, Math.min(5, Math.round(Number(character.skillDots[sid]) || 0)));
        fullSkills[sid] = full;
        if (bSk && typeof bSk === "object") {
          skillsStep[sid] = Math.max(0, Math.min(5, Math.round(Number(bSk[sid]) || 0)));
        } else {
          skillsStep[sid] = full;
        }
      }
      return { skills: skillsStep, skillsIncludingFinishing: fullSkills };
    })(),
    skillSpecialties: { ...character.skillSpecialties },
    attributesBeforeFavored: baseAttrs,
    attributesAfterFavored: finalAttrsStep,
    /** Full pre–Favored ratings including Origin Finishing Attribute dot(s); sheets/PDFs use this for final dots. */
    attributesIncludingFinishingBeforeFavored: fullPreAttrs,
    /** Origin Storypath: highest of Stamina, Resolve, Composure after Favored Approach. */
    defense: originDefenseFromFinalAttrs(sheetFinalA),
    /** Total dice when rolling Athletics + higher of Might or Dexterity (skill + attr dots after Favored Approach). */
    movementDice: originMovementPoolDice(
      sheetFinalA,
      Math.max(0, Math.min(5, Math.round(Number(character.skillDots?.athletics) || 0))),
    ),
    favoredApproach: character.favoredApproach,
    arenaPriority: character.arenaRank,
    ...(isSorcererLineTier(character.tier)
      ? {}
      : (function callingFieldsForExport() {
          const flatId = String(character.callingId || "").trim();
          /** @type {Record<string, unknown>} */
          const out = {};
          if (flatId) {
            out.calling = bundle.callings[flatId]?.name || "";
            out.callingId = flatId;
            out.callingDots = isOriginPlayTier(character.tier)
              ? 1
              : Math.max(1, Math.min(5, Math.round(Number(character.callingDots) || 1)));
          }
          if (heroUsesCallingSlots() && Array.isArray(character.callingSlots)) {
            const slots = character.callingSlots.map((s) => {
              const id = String(s?.id || "").trim();
              if (!id) return null;
              return {
                id,
                dots: Math.max(1, Math.min(5, Math.round(Number(s.dots) || 1))),
              };
            });
            if (slots.some((x) => x != null)) out.callingSlots = slots;
            out.knackSlotById = {
              ...(character.knackSlotById && typeof character.knackSlotById === "object" ? character.knackSlotById : {}),
            };
            out.knackLockedRowBudgetCostById = {
              ...(character.knackLockedRowBudgetCostById && typeof character.knackLockedRowBudgetCostById === "object"
                ? character.knackLockedRowBudgetCostById
                : {}),
            };
          }
          return out;
        })()),
    knackIds: isSorcererLineTier(character.tier) ? [] : [...character.knackIds],
    lockedKnackIds: isSorcererLineTier(character.tier) ? [] : [...(character.lockedKnackIds || [])],
    finishingBonusKnackIds: isSorcererLineTier(character.tier) ? [] : [...(character.finishingBonusKnackIds || [])],
    experienceKnackIds: isSorcererLineTier(character.tier) ? [] : [...(character.experienceKnackIds || [])],
    experienceBoonIds: [...(character.experienceBoonIds || [])].filter(
      (id) => typeof id === "string" && id.trim() && (character.boonIds || []).includes(id),
    ),
    carriedExperienceKnackIds: isSorcererLineTier(character.tier)
      ? []
      : [...(character.carriedExperienceKnackIds || [])],
    knacks: isSorcererLineTier(character.tier)
      ? []
      : character.knackIds.map((id) => bundle.knacks[id]?.name || id),
    finishingKnacks: isSorcererLineTier(character.tier)
      ? []
      : (character.finishing.finishingKnackIds || []).map((id) => bundle.knacks[id]?.name || id),
    purviews: mergedPurviewIdsForSheet({
      purviews: character.purviewIds,
      patronPurviewSlots: character.patronPurviewSlots,
    }),
    patronPurviewSlots: [...(character.patronPurviewSlots || [])],
    boons: (character.boonIds || []).filter((id) => {
      const bb = bundle.boons?.[id];
      return !bb || !boonIsPurviewInnateAutomaticGrant(bb, bundle);
    }),
    dominionBoonPurviewIds: tierSupportsDominionStunts(character.tier)
      ? [...(character.dominionBoonPurviewIds || [])]
      : [],
    dominionBoonForgoneByPurview: tierSupportsDominionStunts(character.tier)
      ? { ...(character.dominionBoonForgoneByPurview || {}) }
      : {},
    dominionBoonForgoneXpByPurview: tierSupportsDominionStunts(character.tier)
      ? { ...(character.dominionBoonForgoneXpByPurview || {}) }
      : {},
    boonBudget: boonBudgetSnapshot(character, bundle),
    ...(function dominionStuntFieldsForExport() {
      if (!tierSupportsDominionStunts(character.tier)) return {};
      const snap = buildDominionStuntExportFromCharacter(character, bundle);
      if (!snap.flat.length) return {};
      return {
        dominionStunts: snap.flat,
        dominionStuntGroups: snap.groups,
      };
    })(),
    experiencePoints: experiencePointsAvailable(character),
    experiencePointsRemaining: experiencePointsAvailable(character),
    experiencePointsSpent: experiencePointsSpent(character),
    experiencePointsTotal: experiencePointsTotal(character),
    experiencePurchaseLog: [...(character.experiencePurchaseLog || [])],
    experienceBirthrightPickIds: [...(character.experienceBirthrightPickIds || [])],
    experienceBirthrightsNamed: (character.experienceBirthrightPickIds || []).map(
      (id) => bundle.birthrights[id]?.name || id,
    ),
    experienceAttributeBumps: { ...(character.experienceAttributeBumps || {}) },
    experienceSkillBumps: { ...(character.experienceSkillBumps || {}) },
    finishing: (() => {
      const { fatebindingEditorIndex: _fbcUi, ...finRest } = character.finishing;
      return {
        ...finRest,
        finishingKnacksNamed: (character.finishing.finishingKnackIds || []).map((id) => bundle.knacks[id]?.name || id),
        birthrightsNamed: (character.finishing.birthrightPicks || []).map((id) => bundle.birthrights[id]?.name || id),
      };
    })(),
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
          source: formatGameDataSourceForDisplay(String(eq.source || "").trim()),
        };
      })
      .filter(Boolean),
    fatebindings: trimTrailingEmptyFatebindings(character.fatebindings),
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
  if (!pantheonId && parentDeityId) {
    for (const [pid, pant] of Object.entries(bundle.pantheons || {})) {
      if (!pant || typeof pant !== "object") continue;
      const list =
        patronKind === "titan"
          ? Array.isArray(pant.titans)
            ? pant.titans
            : []
          : Array.isArray(pant.deities)
            ? pant.deities
            : [];
      if (list.some((d) => d && d.id === parentDeityId)) {
        pantheonId = pid;
        break;
      }
    }
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
  const skFull =
    data.skillsIncludingFinishing && typeof data.skillsIncludingFinishing === "object"
      ? data.skillsIncludingFinishing
      : null;
  const sk = data.skills && typeof data.skills === "object" ? data.skills : {};
  const skPick = skFull || sk;
  for (const sid of skillIds()) {
    const v = skPick[sid];
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
  const srcFull =
    data.attributesIncludingFinishingBeforeFavored &&
    typeof data.attributesIncludingFinishingBeforeFavored === "object"
      ? data.attributesIncludingFinishingBeforeFavored
      : null;
  const srcAttrs =
    data.attributesBeforeFavored && typeof data.attributesBeforeFavored === "object"
      ? data.attributesBeforeFavored
      : data.attributesAfterFavored && typeof data.attributesAfterFavored === "object"
        ? data.attributesAfterFavored
        : data.attributes && typeof data.attributes === "object"
          ? data.attributes
          : null;
  const srcPick = srcFull || srcAttrs;
  if (srcPick) {
    for (const aid of Object.keys(bundle.attributes || {})) {
      if (aid.startsWith("_")) continue;
      const v = srcPick[aid];
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
  const legendRatingRaw = Math.max(0, Math.min(LEGEND_SHEET_DOT_COUNT, Math.round(Number(data.legendRating) || 0)));
  let boonIds = Array.isArray(data.boons)
    ? data.boons.filter((x) => typeof x === "string" && !x.startsWith("_") && validBoon.has(x))
    : [];
  boonIds = boonIds.filter((id) => {
    const bb = bundle.boons?.[id];
    return !bb || !boonIsPurviewInnateAutomaticGrant(bb, bundle);
  });
  const importBoonCap = maxWizardBoonPicksForTier(tier, bundle);
  let experienceBoonIds = Array.isArray(data.experienceBoonIds)
    ? data.experienceBoonIds.filter((x) => typeof x === "string" && !x.startsWith("_") && validBoon.has(x))
    : [...(base.experienceBoonIds || [])];
  experienceBoonIds = experienceBoonIds.filter((id) => boonIds.includes(id));
  if (tierUsesLegendTraitEffects(tier)) {
    const importCtx = {
      tier,
      legendRating: legendRatingRaw,
      boonIds,
      dominionBoonPurviewIds: Array.isArray(data.dominionBoonPurviewIds) ? data.dominionBoonPurviewIds : [],
      experienceBoonIds,
    };
    const xp = experienceBoonIdSet(importCtx);
    const total = legendTraitBoonPurchasesFromRating(legendRatingRaw);
    while (
      boonIds.some((id) => !xp.has(id)) &&
      legendBoonSlotsUsed({ ...importCtx, boonIds }) > total
    ) {
      let removed = false;
      for (let i = boonIds.length - 1; i >= 0; i -= 1) {
        if (!xp.has(boonIds[i])) {
          boonIds.splice(i, 1);
          removed = true;
          break;
        }
      }
      if (!removed) break;
    }
    experienceBoonIds = experienceBoonIds.filter((id) => boonIds.includes(id));
  } else if (Number.isFinite(importBoonCap) && boonIds.length > importBoonCap) {
    boonIds = boonIds.slice(0, importBoonCap);
    experienceBoonIds = experienceBoonIds.filter((id) => boonIds.includes(id));
  }
  let knackIds = Array.isArray(data.knackIds)
    ? data.knackIds.filter((x) => typeof x === "string" && !x.startsWith("_") && validKnack.has(x))
    : [];
  if (isSorcererLineTierId(tier)) {
    callingId = "";
    knackIds = [];
  }

  let lineageEarly = canonChargenLineageFromRaw(data.chargenLineage);
  if (lineageEarly !== "dragonHeir") {
    if (dragonPayloadImpliesHeir(data.dragon)) lineageEarly = "dragonHeir";
    else {
      const tlEarly = String(data.trackTierLabel ?? "").toLowerCase();
      if (tlEarly.includes("dragon") && tlEarly.includes("heir") && data.dragon && typeof data.dragon === "object") {
        lineageEarly = "dragonHeir";
      }
    }
  }
  const legendRating = lineageEarly === "dragonHeir" ? 0 : legendRatingRaw;

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
    delete f.fatebindingEditorIndex;
    Object.assign(finBase, f);
  }
  delete finBase.fatebindingEditorIndex;
  if (!Array.isArray(finBase.finishingKnackIds)) finBase.finishingKnackIds = [];
  if (!Array.isArray(finBase.birthrightPicks)) finBase.birthrightPicks = [];
  let callingDots =
    data.callingDots != null && !Number.isNaN(Number(data.callingDots)) ? Math.round(Number(data.callingDots)) : base.callingDots;
  if (isOriginPlayTier(tier)) callingDots = 1;
  else callingDots = Math.max(1, Math.min(5, callingDots));
  let callingSlots = null;
  const tierNormImp = normalizedTierId(tier);
  if (
    (tierNormImp === "hero" || tierNormImp === "titanic") &&
    Array.isArray(data.callingSlots) &&
    data.callingSlots.length > 0
  ) {
    const raw = data.callingSlots.slice(0, 3).map((x) =>
      x == null
        ? { id: "", dots: 1 }
        : x && typeof x === "object"
          ? {
              id: typeof x.id === "string" ? x.id.trim() : "",
              dots: Math.max(1, Math.min(5, Math.round(Number(x.dots) || 1))),
            }
          : { id: "", dots: 1 },
    );
    while (raw.length < 3) raw.push({ id: "", dots: 1 });
    callingSlots = raw;
    callingDots = Math.max(1, Math.min(5, callingSlots.reduce((a, s) => a + s.dots, 0)));
  }
  const knackImportCtx = {
    tier,
    callingId,
    pantheonId,
    parentDeityId,
    patronKind,
    purviewIds,
    legendRating:
      lineageEarly === "dragonHeir" && data.dragon && typeof data.dragon === "object"
        ? Math.max(1, Math.min(DRAGON_INHERITANCE_MAX, Math.round(Number(/** @type {any} */ (data.dragon).inheritance) || 1)))
        : legendRating,
    awarenessRating,
    callingDots,
    callingSlots: callingSlots || undefined,
  };
  knackIds = knackIds.filter((id) => {
    const kn = bundle.knacks[id];
    return !!kn && knackEligible(kn, knackImportCtx, bundle);
  });
  knackIds = pruneKnackIdsToCallingSlotCap(knackIds, knackImportCtx, bundle);
  let lockedKnackIds = Array.isArray(data.lockedKnackIds)
    ? data.lockedKnackIds.filter((x) => typeof x === "string" && !x.startsWith("_") && validKnack.has(x))
    : [];
  let finishingBonusKnackIds = Array.isArray(data.finishingBonusKnackIds)
    ? data.finishingBonusKnackIds.filter((x) => typeof x === "string" && !x.startsWith("_") && validKnack.has(x))
    : [];
  let experienceKnackIds = Array.isArray(data.experienceKnackIds)
    ? data.experienceKnackIds.filter((x) => typeof x === "string" && !x.startsWith("_") && validKnack.has(x))
    : [...base.experienceKnackIds];
  let carriedExperienceKnackIds = Array.isArray(data.carriedExperienceKnackIds)
    ? data.carriedExperienceKnackIds.filter((x) => typeof x === "string" && !x.startsWith("_") && validKnack.has(x))
    : [...base.carriedExperienceKnackIds];
  if (isSorcererLineTierId(tier)) {
    lockedKnackIds = [];
    finishingBonusKnackIds = [];
    experienceKnackIds = [];
    carriedExperienceKnackIds = [];
  }
  /** Hero: optional row index per Knack id from export; normalized again in `syncHeroKnackSlotAssignments`. */
  const knackSlotById = {};
  if (callingSlots && data.knackSlotById && typeof data.knackSlotById === "object") {
    for (const [knid, rv] of Object.entries(data.knackSlotById)) {
      if (!validKnack.has(knid) || !knackIds.includes(knid)) continue;
      const r = Math.round(Number(rv));
      if (Number.isFinite(r) && r >= 0 && r < 3) knackSlotById[knid] = r;
    }
  }
  const knackLockedRowBudgetCostById = {};
  if (callingSlots && data.knackLockedRowBudgetCostById && typeof data.knackLockedRowBudgetCostById === "object") {
    for (const [knid, cv] of Object.entries(data.knackLockedRowBudgetCostById)) {
      if (!validKnack.has(knid) || !knackIds.includes(knid)) continue;
      const c = Math.round(Number(cv));
      if (c === 1 || c === 2) knackLockedRowBudgetCostById[knid] = c;
    }
  }
  finBase.finishingKnackIds = finBase.finishingKnackIds.filter((id) => {
    const kn = bundle.knacks[id];
    return typeof id === "string" && !!kn && knackEligible(kn, knackImportCtx, bundle);
  });
  finBase.birthrightPicks = finBase.birthrightPicks.filter((id) => typeof id === "string" && validBirthright.has(id));
  trimFinishingBirthrightPicksToBudgetInPlace(finBase, tier);

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
      } else if (k === "additionalTechniqueIds" && Array.isArray(v)) {
        sorceryProfile.additionalTechniqueIds = v
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => x.trim());
      } else if (k === "experienceAdditionalTechniqueIds" && Array.isArray(v)) {
        sorceryProfile.experienceAdditionalTechniqueIds = v
          .filter((x) => typeof x === "string" && x.trim())
          .map((x) => x.trim());
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

  const chargenLineage = lineageEarly;

  const legNImp = Math.max(LEGEND_SHEET_DOT_COUNT, legendDotMaxForTier(tier));
  let legendPoolDotSpentSlots = padPoolSlotArray([], legNImp);
  if (Array.isArray(data.legendPoolDotSpentSlots) && data.legendPoolDotSpentSlots.length) {
    legendPoolDotSpentSlots = padPoolSlotArray(data.legendPoolDotSpentSlots.map((x) => !!x), legNImp);
  } else if (data.legendPoolDotSpent === true) {
    legendPoolDotSpentSlots = Array(legNImp).fill(false);
    legendPoolDotSpentSlots[0] = true;
  }
  const awNImp =
    pantheonId === "mythos" ? Math.max(LEGEND_SHEET_DOT_COUNT, awarenessDotMaxForTier(tier)) : 1;
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
    lockedKnackIds,
    finishingBonusKnackIds,
    experienceKnackIds,
    experienceBoonIds,
    carriedExperienceKnackIds,
    knackSlotById: callingSlots ? knackSlotById : {},
    knackLockedRowBudgetCostById: callingSlots ? knackLockedRowBudgetCostById : {},
    purviewIds,
    patronPurviewSlots,
    boonIds,
    dominionBoonPurviewIds: (() => {
      if (!tierSupportsDominionStunts(tier)) return [];
      const raw = Array.isArray(data.dominionBoonPurviewIds) ? data.dominionBoonPurviewIds : [];
      const validPv = new Set(Object.keys(bundle.purviews || {}).filter((k) => !k.startsWith("_")));
      return raw.filter((id) => typeof id === "string" && validPv.has(id));
    })(),
    dominionBoonForgoneByPurview: (() => {
      if (!tierSupportsDominionStunts(tier)) return {};
      const raw =
        data.dominionBoonForgoneByPurview && typeof data.dominionBoonForgoneByPurview === "object"
          ? data.dominionBoonForgoneByPurview
          : {};
      const validPvForgone = new Set(Object.keys(bundle.purviews || {}).filter((k) => !k.startsWith("_")));
      /** @type {Record<string, string[]>} */
      const out = {};
      for (const [pid, ids] of Object.entries(raw)) {
        if (typeof pid !== "string" || !validPvForgone.has(pid)) continue;
        if (!Array.isArray(ids)) continue;
        const clean = ids.filter((id) => typeof id === "string" && validBoon.has(id));
        if (clean.length) out[pid] = clean;
      }
      return out;
    })(),
    dominionBoonForgoneXpByPurview: (() => {
      if (!tierSupportsDominionStunts(tier)) return {};
      const raw =
        data.dominionBoonForgoneXpByPurview && typeof data.dominionBoonForgoneXpByPurview === "object"
          ? data.dominionBoonForgoneXpByPurview
          : {};
      const validPvForgone = new Set(Object.keys(bundle.purviews || {}).filter((k) => !k.startsWith("_")));
      /** @type {Record<string, string[]>} */
      const out = {};
      for (const [pid, ids] of Object.entries(raw)) {
        if (typeof pid !== "string" || !validPvForgone.has(pid)) continue;
        if (!Array.isArray(ids)) continue;
        const clean = ids.filter((id) => typeof id === "string" && validBoon.has(id));
        if (clean.length) out[pid] = clean;
      }
      return out;
    })(),
    experiencePoints: (() => {
      const n = Math.round(Number(data.experiencePoints) || 0);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    })(),
    experiencePointsSpent: (() => {
      const n = Math.round(Number(data.experiencePointsSpent) || 0);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    })(),
    experiencePurchaseLog: Array.isArray(data.experiencePurchaseLog)
      ? data.experiencePurchaseLog.filter((x) => typeof x === "string" && x.trim())
      : [...base.experiencePurchaseLog],
    experienceBirthrightPickIds: Array.isArray(data.experienceBirthrightPickIds)
      ? data.experienceBirthrightPickIds.filter((x) => typeof x === "string" && validBirthright.has(x))
      : [...base.experienceBirthrightPickIds],
    experienceAttributeBumps: (() => {
      const raw = data.experienceAttributeBumps;
      if (!raw || typeof raw !== "object") return { ...base.experienceAttributeBumps };
      /** @type {Record<string, number>} */
      const out = {};
      for (const [id, n] of Object.entries(raw)) {
        if (String(id).startsWith("_") || !bundle.attributes?.[id]) continue;
        const v = Math.round(Number(n) || 0);
        if (Number.isFinite(v) && v > 0) out[id] = v;
      }
      return out;
    })(),
    experienceSkillBumps: (() => {
      const raw = data.experienceSkillBumps;
      if (!raw || typeof raw !== "object") return { ...base.experienceSkillBumps };
      /** @type {Record<string, number>} */
      const out = {};
      for (const [id, n] of Object.entries(raw)) {
        if (String(id).startsWith("_") || !bundle.skills?.[id]) continue;
        const v = Math.round(Number(n) || 0);
        if (Number.isFinite(v) && v > 0) out[id] = v;
      }
      return out;
    })(),
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
    fatebindings: sanitizeFatebindingsForEditor(data.fatebindings),
    sheetNotesExtra: typeof data.sheetNotesExtra === "string" ? data.sheetNotesExtra : "",
    sorceryProfile,
    titanicProfile,
    mythosInnatePower,
    legendPoolDotSpentSlots,
    awarenessPoolDotSpentSlots,
    ...(chargenLineage === "dragonHeir" && data.dragon && typeof data.dragon === "object"
      ? {
          dragon: (() => {
            /** @type {any} */
            let merged;
            try {
              merged = JSON.parse(JSON.stringify(data.dragon));
            } catch {
              merged = { ...data.dragon };
            }
            if (data.inheritancePoolRating != null && !Number.isNaN(Number(data.inheritancePoolRating))) {
              merged.inheritancePoolRating = Math.round(Number(data.inheritancePoolRating));
            }
            if (Array.isArray(data.inheritancePoolDotSpentSlots)) {
              merged.inheritancePoolDotSpentSlots = data.inheritancePoolDotSpentSlots.map((x) => !!x);
            }
            return merged;
          })(),
        }
      : {}),
  };
}

/** Drop Knack picks that fail Calling / tier / pantheon gates (e.g. Immortal knacks after returning to Origin). */
function pruneStaleKnackIds() {
  if (!bundle?.knacks) return;
  if (isSorcererLineTier(character.tier)) {
    character.knackIds = [];
    character.knackSlotById = {};
    if (character.finishing?.finishingKnackIds) character.finishing.finishingKnackIds = [];
    return;
  }
  character.knackIds = (character.knackIds || []).filter((id) => {
    const k = bundle.knacks[id];
    return !!(k && knackEligibleOrLockedHeld(k, character, bundle));
  });
  reconcileLockedKnackIds(character, bundle);
  character.knackIds = pruneKnackIdsToCallingSlotCap(character.knackIds, character, bundle);
  ensureExperienceShape();
  if (heroUsesCallingSlotRows(character) && Array.isArray(character.callingSlots)) {
    ensureFinishingBonusKnackIds(character);
    snapshotMissingLockedKnackRowBudgetCosts(character, bundle);
    stripRowPaidKnacksFromExperiencePools(character);
    pinLockedOriginBudgetKnackToPrimaryRow(character, bundle);
    pruneOrphanUnmappedKnackPurchases(character, bundle);
    seedHeroKnackRowAssignments(character, bundle);
    pinLockedOriginBudgetKnackToPrimaryRow(character, bundle);
    settleUnassignedHeldKnackSlots(character, bundle);
    repairUnmappedHeroKnackSlots(character, bundle);
  } else {
    syncHeroKnackSlotAssignments(character, bundle);
  }
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

/**
 * Pre-fix saves: Knacks bought on Exp Leveling were in `knackIds` but counted against Calling budgets.
 * Infer XP purchases as any non–Finishing-extra Knack beyond the Origin Mortal one-dot Calling budget.
 */
function healExperienceKnackIdsFromMortalOverflow() {
  if (!Array.isArray(character.experienceKnackIds)) character.experienceKnackIds = [];
  if (character.experienceKnackIds.length) return;
  if (!bundle?.knacks) return;
  /** Hero three-row Calling buys use `knackSlotById` — never infer them as Exp Leveling overflow. */
  if (heroUsesCallingSlotRows(character)) return;
  const fin = finishingBonusKnackIdSet(character);
  const ids = character.knackIds || [];
  const budgetKnacks = [];
  const xp = [];
  for (const id of ids) {
    if (fin.has(id)) continue;
    const k = bundle.knacks[id];
    if (!k) continue;
    const trial = [...budgetKnacks, id];
    if (knackIdsCallingSlotsUsed(trial, bundle, { ...character, tier: "mortal" }) <= 1) {
      budgetKnacks.push(id);
    } else {
      xp.push(id);
    }
  }
  if (xp.length) character.experienceKnackIds = [...new Set(xp)];
}

/**
 * Hero+ saves advanced before `carriedExperienceKnackIds`: infer Origin XP knack buys that should not
 * spend Visitation Calling row knack budgets.
 */
function healCarriedExperienceKnackIds() {
  if (!Array.isArray(character.carriedExperienceKnackIds)) character.carriedExperienceKnackIds = [];
  if (character.carriedExperienceKnackIds.length) return;
  if (!bundle?.knacks || isOriginPlayTier(character.tier)) return;
  const fin = finishingBonusKnackIdSet(character);
  const locked = knackLockedIdSet(character);
  const ids = character.knackIds || [];
  const budgetKnacks = [];
  /** @type {string[]} */
  const xp = [];
  for (const id of ids) {
    if (fin.has(id)) continue;
    const k = bundle.knacks[id];
    if (!k) continue;
    const trial = [...budgetKnacks, id];
    if (knackIdsCallingSlotsUsed(trial, bundle, { ...character, tier: "mortal" }) <= 1) {
      budgetKnacks.push(id);
    } else if (locked.has(id)) {
      xp.push(id);
    }
  }
  if (xp.length) character.carriedExperienceKnackIds = [...new Set(xp)];
}

/**
 * Older Hero saves: infer Finishing extras (all locked Knacks except the first Calling-step pick).
 */
function healFinishingBonusKnackIds() {
  if (!Array.isArray(character.finishingBonusKnackIds)) character.finishingBonusKnackIds = [];
  if (character.finishingBonusKnackIds.length) return;
  const locked = knackLockedIdSet(character);
  if (locked.size <= 1) return;
  const ids = character.knackIds || [];
  const lockedInOrder = ids.filter((id) => locked.has(id));
  if (lockedInOrder.length <= 1) return;
  const budgetKnack = lockedInOrder[0];
  const xp = new Set([...experienceKnackIdSet(character), ...carriedExperienceKnackIdSet(character)]);
  character.finishingBonusKnackIds = lockedInOrder.filter((id) => id !== budgetKnack && !xp.has(id));
}

/**
 * Exports saved before `lockedKnackIds` — if the character has tier-advanced, treat current Knacks as locked.
 */
function healLockedKnackIdsFromTierAdvancement() {
  if (!Array.isArray(character.tierAdvancementLog) || !character.tierAdvancementLog.length) return;
  const present = new Set([
    ...(character.knackIds || []),
    ...(character.finishing?.finishingKnackIds || []),
  ]);
  if (knackLockedIdSet(character).size > 0) {
    character.lockedKnackIds = (character.lockedKnackIds || []).filter((id) => present.has(id));
    reconcileLockedKnackIds(character, bundle);
    settleLockedExperienceKnacks(character);
    return;
  }
  if (isOriginPlayTier(character.tier)) return;
  const log = character.tierAdvancementLog;
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const entry = log[i];
    const carried = Array.isArray(entry?.carriedKnackIds)
      ? entry.carriedKnackIds.filter((id) => typeof id === "string" && id.trim() && bundle?.knacks?.[id])
      : [];
    if (!carried.length) continue;
    character.lockedKnackIds = [...carried];
    const finBonus = Array.isArray(entry?.carriedFinishingBonusKnackIds)
      ? entry.carriedFinishingBonusKnackIds.filter((id) => typeof id === "string" && id.trim() && bundle?.knacks?.[id])
      : [];
    if (finBonus.length && !(character.finishingBonusKnackIds || []).length) {
      character.finishingBonusKnackIds = [...finBonus];
    }
    reconcileLockedKnackIds(character, bundle);
    settleLockedExperienceKnacks(character);
    return;
  }
  character.lockedKnackIds = [...(character.knackIds || [])];
  reconcileLockedKnackIds(character, bundle);
  settleLockedExperienceKnacks(character);
}

/**
 * Origin / Mortal-band Finishing “two extra Knacks” are stored in `finishing.finishingKnackIds`.
 * Hero+ omits the Finishing step; merge bonus ids into `knackIds` when Calling rows can pay for them.
 * After Mortal→Hero, `pruneKnackIdsToCallingSlotCap` may drop picks while Visitation Callings are still
 * empty; any merge survivor that fails assignment stays in `finishingKnackIds` until rows absorb them.
 */
function mergeFinishingBonusKnacksIntoMainKnackList() {
  if (isSorcererLineTier(character.tier)) return;
  if (wizardIncludesFinishingTouchesStep(character.tier)) return;
  if (!bundle?.knacks) return;
  character.finishing ||= {};
  const raw = character.finishing.finishingKnackIds;
  const bonus = Array.isArray(raw)
    ? [...new Set(raw.filter((id) => typeof id === "string" && id.trim() && !id.startsWith("_")))]
    : [];
  if (!bonus.length) return;
  const cur = character.knackIds || [];
  const next = [...cur];
  for (const kid of bonus) {
    if (next.includes(kid)) continue;
    const k = bundle.knacks[kid];
    if (!k || typeof k !== "object") continue;
    next.push(kid);
  }
  character.knackIds = next;
  character.finishing.finishingKnackIds = [];
  pruneStaleKnackIds();
  const main = new Set(character.knackIds || []);
  const held = [];
  for (const kid of bonus) {
    if (main.has(kid)) continue;
    const k = bundle.knacks[kid];
    if (!k || typeof k !== "object") continue;
    if (knackEligible(k, character, bundle)) held.push(kid);
  }
  character.finishing.finishingKnackIds = [...new Set(held)];
}

/** After replacing `character` (import) or on first load: clamp, hydrate paths/purviews, prune invalid ids. */
function normalizeCharacterStateAfterLoad() {
  healDragonHeirLineageFromState();
  character.chargenLineage = canonChargenLineageFromRaw(character.chargenLineage);
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
  syncPantheonFromParentDeity();
  const pantNorm = bundle?.pantheons?.[character.pantheonId];
  if (character.parentDeityId) {
    let okPat = pantNorm && patronListForPantheon(pantNorm).some((d) => d && d.id === character.parentDeityId);
    if (!okPat) {
      syncPantheonFromParentDeity();
      const pantRetry = bundle?.pantheons?.[character.pantheonId];
      okPat = pantRetry && patronListForPantheon(pantRetry).some((d) => d && d.id === character.parentDeityId);
    }
    if (!okPat) character.parentDeityId = "";
  }
  syncAwarenessWithPantheon();
  if (!Array.isArray(character.tierAdvancementLog)) character.tierAdvancementLog = [];
  if (!Array.isArray(character.lockedKnackIds)) character.lockedKnackIds = [];
  if (!Array.isArray(character.finishingBonusKnackIds)) character.finishingBonusKnackIds = [];
  healLockedKnackIdsFromTierAdvancement();
  healFinishingBonusKnackIds();
  ensureSkillDots();
  ensurePathSkillArrays();
  syncCallingToParentDeity();
  if (heroUsesCallingSlots()) {
    ensureCallingSlotsForHero();
    if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
    if (!character.knackLockedRowBudgetCostById || typeof character.knackLockedRowBudgetCostById !== "object") {
      character.knackLockedRowBudgetCostById = {};
    }
    reconcileLockedKnackIds(character, bundle);
    ensureHeroKnackSlotAssignments(character, bundle);
  } else character.callingSlots = null;
  mergeFinishingBonusKnacksIntoMainKnackList();
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
    const allowed = new Set(
      patronPurviewSlotLimitForCharacter() <= 1 ? patronPurviewOptionIds() : patronPurviewSlotOptionIds(),
    );
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
  pruneDominionState();
  ensureExperienceShape();
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

/** Paths step: phrases, pantheon, divine parent → `character`; patron Purview dropdowns persist on the Purviews step. */
function persistPathsStepFromDom() {
  persistPathsPhrasesFromDom();
  if (isDragonHeirChargen(character)) {
    const st = stepDefsForTier(character.tier)[stepIndex];
    persistDragonFromDom(character, bundle, st);
    return;
  }
  if (isSorcererLineTier(character.tier)) {
    return;
  }
  syncPatronKindFromWelcomeLine();
  character.pantheonId = document.getElementById("p-pantheon")?.value || "";
  character.parentDeityId = document.getElementById("p-deity")?.value || "";
  syncAwarenessWithPantheon();
  ensurePatronPurviewSlots();
  syncPurviewIdsFromPatronSlots();
  syncCallingToParentDeity();
}

/** Purviews step (and any DOM that mounts `p-patron-pv-*`): read patron slot selects into state and merge `purviewIds`. */
function persistPatronPurviewSlotsFromDom() {
  if (!tierHasPurviewStep(character.tier)) return;
  ensurePatronPurviewSlots();
  const lim = patronPurviewSlotLimitForCharacter();
  for (let i = 0; i < PATRON_PURVIEW_SLOT_COUNT; i += 1) {
    const sel = document.getElementById(`p-patron-pv-${i}`);
    if (sel) character.patronPurviewSlots[i] = sel.value || "";
    else if (i >= lim) character.patronPurviewSlots[i] = "";
  }
  syncPurviewIdsFromPatronSlots();
}

function persistSkillSpecialtiesFromForm() {
  const steps = stepDefsForTier(character.tier);
  const step = steps[stepIndex];
  if (step === "attributes") {
    for (const sid of skillIds()) {
      if ((character.skillDots[sid] || 0) < 3) continue;
      const inp = document.getElementById(`specialty-${sid}`);
      if (!inp) continue;
      const t = inp.value.trim();
      if (t) character.skillSpecialties[sid] = inp.value;
      else delete character.skillSpecialties[sid];
    }
    return;
  }
  const skillsLocked = step === "skills" && postOriginMortalChargenLocked(character);
  for (const sid of skillIds()) {
    if ((character.skillDots[sid] || 0) < 3) {
      if (!skillsLocked) delete character.skillSpecialties[sid];
      continue;
    }
    if (skillsLocked && !skillNeedsFreeChargenSpecialty(sid)) continue;
    const inp = document.getElementById(`specialty-${sid}`);
    if (!inp) continue;
    const t = inp.value.trim();
    if (t) character.skillSpecialties[sid] = inp.value;
    else if (!skillsLocked) delete character.skillSpecialties[sid];
  }
}

/**
 * Finishing step only: sync specialties (and budget inputs) from the DOM, then refresh the Next button
 * and inline gate visuals without a full `render()` (keeps focus/caret in Specialty fields).
 */
function refreshFinishingWizardGateUiFromDom() {
  const steps = stepDefsForTier(character.tier);
  const step = steps[stepIndex];
  if (step !== "finishing" || isDragonHeirChargen(character)) return;
  persistSkillSpecialtiesFromForm();
  ensureFinishingShape();
  const finSkillEl = document.getElementById("fin-skill");
  const finAttrEl = document.getElementById("fin-attr");
  if (finSkillEl) character.finishing.extraSkillDots = Math.max(0, Number(finSkillEl.value || 0));
  if (finAttrEl) character.finishing.extraAttributeDots = Math.max(0, Number(finAttrEl.value || 0));
  const finFocusEl = document.getElementById("fin-focus");
  if (finFocusEl) {
    character.finishing.knackOrBirthright =
      finFocusEl.value === "birthrights" || finFocusEl.value === "knacks" ? finFocusEl.value : "knacks";
  }
  const pkgMortRf = document.getElementById("fin-sorc-mort-pkg");
  if (pkgMortRf && normalizedTierId(character.tier) === "sorcerer") {
    const v = pkgMortRf.value;
    if (v === "two_techniques" || v === "four_paraphernalia" || v === "one_technique_two_paraphernalia") {
      character.finishing.sorcererMortalFinishingPackage = v;
      trimBirthrightPicksToBudget();
      ensureSorceryProfileShape();
      pruneSorceryAdditionalTechniques();
    }
  }
  const techNotesRf = document.getElementById("fin-sorc-mort-tech-notes");
  if (techNotesRf && normalizedTierId(character.tier) === "sorcerer") {
    character.finishing.sorcererMortalExtraTechniquesNotes = techNotesRf.value ?? "";
  }
  ensureFinishingBaselines();

  const host = document.getElementById("wizard-step-host");
  if (!host) return;

  const placedSk = finishingSkillDotsPlaced();
  const remSk = finishingSkillDotsRemaining();
  const placedAt = finishingAttrDotsPlaced();
  const remAt = finishingAttrDotsRemaining();
  const budgetSk = Math.max(0, Math.round(Number(character.finishing.extraSkillDots) || 0));
  const budgetAt = Math.max(0, Math.round(Number(character.finishing.extraAttributeDots) || 0));
  const overSk = placedSk > budgetSk;
  const overAt = placedAt > budgetAt;
  const underspendSk = budgetSk > 0 && remSk > 0;
  const underspendAt = budgetAt > 0 && remAt > 0;
  const missing = skillIdsMissingChargenSpecialties();
  const missingSet = new Set(missing);

  const summary = document.getElementById("fin-budget-summary");
  if (summary) {
    summary.textContent = `Skill finishing: ${placedSk} / ${character.finishing.extraSkillDots || 0} dots placed (${remSk} remaining). Attribute finishing: ${placedAt} / ${character.finishing.extraAttributeDots || 0} dot(s) placed (${remAt} remaining).`;
  }

  const warnEl = document.getElementById("fin-budget-warn");
  if (warnEl) {
    warnEl.hidden = !(overSk || overAt);
    warnEl.textContent =
      (overSk ? "Placed skill dots exceed the budget — raise “Extra skill dots” or lower Skills below. " : "") +
      (overAt ? "Placed attribute dots exceed the budget — raise “Extra attribute dot(s)” or lower Attributes below." : "");
  }

  const skPanel = host.querySelector(".finishing-skills-table")?.closest(".finishing-place-panel");
  if (skPanel) {
    skPanel.classList.toggle("panel-gate-invalid", overSk || underspendSk || missing.length > 0);
  }

  const atPanel = document.getElementById("fin-attrs-panel");
  if (atPanel) {
    atPanel.classList.toggle("panel-gate-invalid", overAt || underspendAt);
  }

  const knBrPanel = document.getElementById("fin-knack-br-panel");
  if (knBrPanel) {
    const tierRf = normalizedTierId(character.tier);
    const heroLf = tierRf === "hero" || tierRf === "titanic" || tierRf === "sorcerer_hero";
    if (!heroLf) {
      knBrPanel.classList.toggle("panel-gate-invalid", finishingKnackOrBirthrightPanelGateInvalid());
    }
  }

  let gateBox = host.querySelector(".skills-gate-errors");
  if (missing.length === 0) {
    gateBox?.remove();
  } else {
    if (!gateBox) {
      gateBox = document.createElement("div");
      gateBox.className = "skills-gate-errors";
      gateBox.setAttribute("role", "alert");
      const gt = document.createElement("p");
      gt.className = "skills-gate-errors-title";
      gt.textContent = "Fix the following before leaving Finishing:";
      gateBox.appendChild(gt);
      const ul = document.createElement("ul");
      gateBox.appendChild(ul);
      skPanel?.insertAdjacentElement("beforebegin", gateBox);
    }
    let ul = gateBox.querySelector("ul");
    if (!ul) {
      ul = document.createElement("ul");
      gateBox.appendChild(ul);
    }
    ul.innerHTML = "";
    for (const sid of missing) {
      const li = document.createElement("li");
      li.textContent = `${bundle.skills?.[sid]?.name || sid} is at 3 or more dots — enter a Specialty in the Skills table below.`;
      ul.appendChild(li);
    }
  }

  for (const inp of host.querySelectorAll('input[id^="specialty-"]')) {
    const tr = inp.closest("tr");
    if (!tr || !tr.classList.contains("skill-rating-row")) continue;
    const sid = String(inp.id || "").replace(/^specialty-/, "");
    tr.classList.toggle("skill-rating-row--gate-invalid", missingSet.has(sid));
  }

  const nextBtn = host.querySelector(".step-actions .btn.primary");
  if (nextBtn && nextBtn.textContent.trim() === "Next") {
    const finBlock = finishingStepLeaveBlockedReason();
    if (finBlock) {
      nextBtn.disabled = true;
      nextBtn.title = finBlock;
    } else {
      nextBtn.disabled = false;
      nextBtn.removeAttribute("title");
    }
  }
}

function persistFromForm() {
  if (isDragonHeirChargen(character)) {
    ensureDragonShape(character, bundle);
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
    persistDragonFromDom(character, bundle, step);
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
    persistSkillSpecialtiesFromForm();
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
        : normalizedTierId(character.tier) === "sorcerer"
          ? "birthrights"
          : document.getElementById("fin-focus")?.value || "knacks";
    const pkgElFin = document.getElementById("fin-sorc-mort-pkg");
    if (pkgElFin && normalizedTierId(character.tier) === "sorcerer") {
      const v = pkgElFin.value;
      if (v === "two_techniques" || v === "four_paraphernalia" || v === "one_technique_two_paraphernalia") {
        character.finishing.sorcererMortalFinishingPackage = v;
      }
    }
    const fnFin = document.getElementById("fin-sorc-mort-tech-notes");
    if (fnFin && normalizedTierId(character.tier) === "sorcerer") {
      character.finishing.sorcererMortalExtraTechniquesNotes = fnFin.value ?? "";
    }
    persistFatebindingEditorRowFromDom(character, "fin-fb");
    character.sheetNotesExtra = document.getElementById("fin-sheet-notes")?.value ?? "";
  }
  if (step === "workings") {
    ensureSorceryProfileShape();
  }
  if (step === "sorcerer") {
    ensureSorceryProfileShape();
    const sp = character.sorceryProfile;
    sp.motif = document.getElementById("f-sorc-motif")?.value ?? "";
    sp.techniquesNotes = document.getElementById("f-sorc-techniques")?.value ?? "";
    sp.notes = document.getElementById("f-sorc-notes")?.value ?? "";
    if (normalizedTierId(character.tier) !== "sorcerer") {
      const pr = document.getElementById("f-sorc-primary")?.value ?? "";
      sp.primaryPowerSource = pr === "invocation" || pr === "patronage" || pr === "prohibition" || pr === "talisman" ? pr : "";
      sp.powerSource = document.getElementById("f-sorc-source")?.value ?? "";
      sp.invocation = document.getElementById("f-sorc-invocation")?.value ?? "";
      sp.patronage = document.getElementById("f-sorc-patronage")?.value ?? "";
      sp.prohibition = document.getElementById("f-sorc-prohibition")?.value ?? "";
      sp.talisman = document.getElementById("f-sorc-talisman")?.value ?? "";
    }
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
  if (step === "purviews") {
    persistPatronPurviewSlotsFromDom();
    if (isMythosPantheonSelected()) {
      ensureMythosInnatePowerShape();
      const m = character.mythosInnatePower;
      if (!m.awarenessLocked) {
        const selEl = document.getElementById("f-mythos-innate-purview");
        if (selEl) m.awarenessPurviewId = selEl.value || "";
      }
    }
  }
}

function render() {
  const root = document.getElementById("wizard-root");
  if (!root) return;
  healDragonHeirLineageFromState();
  character.chargenLineage = canonChargenLineageFromRaw(character.chargenLineage);
  const stepHost = document.getElementById("wizard-step-host");
  const contentRoot = stepHost || root;
  const lineToolbar = document.getElementById("wizard-line-toolbar");
  try {
  renderAppMainTabs();
  const wnav = document.getElementById("wizard-nav");
  if (appMainTab !== "wizard") {
    if (lineToolbar) lineToolbar.hidden = true;
    if (wnav) {
      wnav.style.display = "none";
      wnav.innerHTML = "";
    }
    contentRoot.innerHTML = "<p class=\"help\">Loading library editor…</p>";
    const reloadBundle = async () => {
      const r = await fetchGameBundle();
      bundle = await r.json();
    };
    const ctx = { getBundle: () => bundle, reloadBundle };
    loadEditorsOnce()
      .then((ed) => {
        contentRoot.innerHTML = "";
        if (appMainTab === "birthrights_data") ed.mountBirthrightsDataEditor(contentRoot, ctx);
        else if (appMainTab === "tags_data") ed.mountTagsDataEditor(contentRoot, ctx);
        else if (appMainTab === "equipment_data") ed.mountEquipmentDataEditor(contentRoot, ctx);
        updateHeaderTierDisplay();
      })
      .catch((err) => {
        console.error(err);
        contentRoot.innerHTML = "";
        const p = document.createElement("p");
        p.className = "warn";
        p.textContent = `Could not load library editors: ${err instanceof Error ? err.message : String(err)}`;
        contentRoot.appendChild(p);
        updateHeaderTierDisplay();
      });
    return;
  }
  if (lineToolbar) lineToolbar.hidden = false;
  if (wnav) wnav.style.display = "";

  if (isDragonHeirChargen(character)) {
    if (!bundle?.dragonFlights || typeof bundle.dragonFlights !== "object" || !bundle?.dragonTier) {
      contentRoot.innerHTML = "";
      const p = document.createElement("p");
      p.className = "warn";
      p.textContent =
        "Dragon Heir data is missing from the game bundle. Add dragonTier, dragonCallingKnacks, dragonFlights, dragonMagic, and dragonKnacks to data/meta.json, restart the server, and hard-refresh.";
      contentRoot.appendChild(p);
      updateHeaderTierDisplay();
      return;
    }
    ensureDragonShape(character, bundle);
  }

  if (!bundle?.tier || typeof bundle.tier !== "object") {
    contentRoot.innerHTML = "";
    const p = document.createElement("p");
    p.className = "warn";
    p.textContent =
      "Game bundle has no tier data yet. Confirm the app is served by this project’s FastAPI server (so GET /api/bundle works) and that data/tier.json is listed in data/meta.json gameDataFiles.";
    contentRoot.appendChild(p);
    updateHeaderTierDisplay();
    return;
  }

  syncLegendToTier();
  syncAwarenessWithPantheon();
  stripSorcererLineCallingAndKnacks();
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
  mergeFinishingBonusKnacksIntoMainKnackList();
  clearPurviewsAndBoonsIfInapplicableTier();
  if (tierHasPurviewStep(character.tier)) restrictHeroPurviewsToPatronList();
  trimBirthrightPicksToBudget();
  pruneStaleBoonIds();
  pruneDominionState();
  ensureExperienceShape();
  const stepsPre = stepDefsForTier(character.tier);
  if (stepIndex >= stepsPre.length) stepIndex = Math.max(0, stepsPre.length - 1);
  /* Only persist Paths from the DOM when the Paths form is actually mounted (nav can change stepIndex before DOM is rebuilt). */
  if (stepsPre[stepIndex] === "paths" && document.getElementById("p-origin")) persistPathsStepFromDom();
  contentRoot.innerHTML = "";
  renderNav();
  const steps = stepDefsForTier(character.tier);
  const step = steps[stepIndex] || "welcome";
  if (step === "expLeveling") {
    character = activateExpLevelingSession(character);
  } else if (expLevelingSessionActive()) {
    character = discardExpLevelingSession() || character;
  }
  if (isDragonHeirChargen(character) && dragonHeirPostConceptStepList(character).includes(step)) {
    ensureDragonShape(character, bundle);
    const dSteps = dragonHeirPostConceptStepList(character);
    character.dragon.stepIndex = Math.max(0, dSteps.indexOf(step));
  }
  if (step === "calling" || step === "finishing") pruneStaleKnackIds();
  if (step === "welcome") {
    renderWelcome(contentRoot);
  } else if (step === "concept") {
    renderConcept(contentRoot);
  } else if (isDragonHeirChargen(character) && dragonHeirPostConceptStepList(character).includes(step) && step !== "skills") {
    renderDragonHeirStepInRoot({
      root: contentRoot,
      character,
      bundle,
      render,
      step,
      scrollStepIntoView: scrollWizardStepIntoView,
      navigateToDragonHeirStep: navigateDragonHeirToMainWizardStep,
    });
  } else if (step === "paths") {
    renderPaths(contentRoot);
  } else if (step === "skills") {
    renderSkills(contentRoot);
  } else if (step === "attributes") {
    renderAttributes(contentRoot);
  } else if (step === "calling") {
    renderCalling(contentRoot);
  } else if (step === "purviews") {
    renderPurviews(contentRoot);
  } else if (step === "birthrights") {
    renderBirthrights(contentRoot);
  } else if (step === "boons") {
    renderBoons(contentRoot);
  } else if (step === "workings") {
    renderWorkings(contentRoot);
  } else if (step === "sorcerer") {
    renderSorcerer(contentRoot);
  } else if (step === "titanicExtras") {
    renderTitanicExtras(contentRoot);
  } else if (step === "finishing") {
    renderFinishing(contentRoot);
  } else if (step === "review") {
    renderReview(contentRoot);
  } else if (step === "expLeveling") {
    renderExpLeveling(contentRoot);
  }

  const actions = document.createElement("div");
  actions.className = "step-actions";
  if (stepIndex > 0) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn secondary";
    back.textContent = "Back";
    back.addEventListener("click", () => {
      persistFromForm();
      if (step === "expLeveling") {
        const leave = resolveLeaveExpLevelingStep(character);
        if (!leave.proceed) return;
        character = leave.character;
      }
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
      if (step === "attributes" && !isDragonHeirChargen(character)) {
        if (!postOriginMortalChargenLocked(character)) {
          normalizeCharacterAttributesToPools();
          const preAttrs = buildCharacterAttrsPre();
          const attrMsgs = validateAttributes(preAttrs);
          if (attrMsgs.length || !attributeArenaPoolsSpendOk(preAttrs)) {
            window.alert(attrMsgs.length ? attrMsgs.join("\n") : "Arena attribute pools are not full.");
            render();
            return;
          }
        }
      }
      persistFromForm();
      if (isDragonHeirChargen(character)) {
        const dragBlock = dragonHeirStepLeaveBlockedReason(character, bundle, step);
        if (dragBlock) {
          window.alert(dragBlock);
          render();
          return;
        }
        if (step === "attributes") {
          captureDragonFinishingAttrBaseline(character.dragon, bundle);
        }
      } else {
        const block = forwardLeaveBlockScionAfterPersist(step);
        if (block) {
          window.alert(block);
          render();
          return;
        }
      }
      stepIndex += 1;
      render();
      scrollWizardStepIntoView();
    });
    applyWizardNextButtonGate(next, step);
    actions.appendChild(next);
  }
  contentRoot.appendChild(actions);
  updateHeaderTierDisplay();
  } catch (err) {
    console.error(err);
    contentRoot.innerHTML = "";
    const p = document.createElement("p");
    p.className = "warn";
    p.textContent =
      err instanceof Error
        ? `Wizard UI error: ${err.message}`
        : "Wizard UI error — check the browser console.";
    contentRoot.appendChild(p);
    updateHeaderTierDisplay();
  }
}

/**
 * Remove a conflicting character selection by type and id.
 * Called when the user confirms removal of a book that has active selections.
 *
 * @param {string} type - display type label (e.g. "Boon", "Knack", "Birthright", "Equipment", "Purview", "Calling")
 * @param {string} id - the selection id to remove
 */
function removeSelectionFromCharacter(type, id) {
  switch (type) {
    case "Boon":
      character.boonIds = (character.boonIds || []).filter((x) => x !== id);
      break;
    case "Knack":
      if (isKnackLocked(character, id)) break;
      character.knackIds = (character.knackIds || []).filter((x) => x !== id);
      removeExperienceKnackPickIfPresent(id);
      // Also remove from finishing knack ids if present
      if (character.finishing && Array.isArray(character.finishing.finishingKnackIds)) {
        character.finishing.finishingKnackIds = character.finishing.finishingKnackIds.filter((x) => x !== id);
      }
      // Remove from knack slot assignments
      if (character.knackSlotById && character.knackSlotById[id] !== undefined) {
        delete character.knackSlotById[id];
      }
      break;
    case "Birthright":
      character.birthrightIds = (character.birthrightIds || []).filter((x) => x !== id);
      // Also remove from finishing birthright picks if present
      if (character.finishing && Array.isArray(character.finishing.birthrightPicks)) {
        character.finishing.birthrightPicks = character.finishing.birthrightPicks.filter((x) => x !== id);
      }
      if (Array.isArray(character.experienceBirthrightPickIds)) {
        character.experienceBirthrightPickIds = character.experienceBirthrightPickIds.filter((x) => x !== id);
      }
      break;
    case "Equipment":
      character.sheetEquipmentIds = (character.sheetEquipmentIds || []).filter((x) => x !== id);
      break;
    case "Purview":
      character.purviewIds = (character.purviewIds || []).filter((x) => x !== id);
      // Also remove from patron purview slots if present
      if (Array.isArray(character.patronPurviewSlots)) {
        character.patronPurviewSlots = character.patronPurviewSlots.map((s) => (s === id ? "" : s));
      }
      break;
    case "Calling":
      if (character.callingId === id) {
        character.callingId = "";
      }
      // Also remove from calling slots (Hero three-row mode)
      if (Array.isArray(character.callingSlots)) {
        character.callingSlots = character.callingSlots.filter((slot) => {
          if (typeof slot === "object" && slot) return slot.id !== id;
          return true;
        });
      }
      break;
    case "Path":
      // Paths are not stored as IDs in the same way; no removal needed
      break;
    default:
      break;
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

  // --- Book Source Filter panel ---
  const registry = bundle._sourceRegistry || [];
  // Initialize allowedBooks with all known slugs (default: all enabled)
  for (const entry of registry) {
    allowedBooks.add(entry.slug);
  }
  const bookFilterPanel = createBookSourceFilterPanel(registry, allowedBooks, (slug, isAllowed) => {
    // onChange callback — re-render after filter change
  }, async (slug) => {
    // onBeforeUncheck — check for conflicts before removing a book
    const conflicts = detectConflicts(slug, character, bundle);
    if (conflicts.length === 0) return true; // no conflicts, proceed immediately

    // Conflicts exist: show modal, keep book in allowedBooks until user confirms
    const confirmed = await showConflictModal(conflicts);
    if (!confirmed) return false; // cancel — re-check checkbox, leave state unchanged

    // Confirmed: remove all conflicting selections from character state
    for (const conflict of conflicts) {
      removeSelectionFromCharacter(conflict.type, conflict.id);
    }
    return true; // proceed with removal from allowedBooks
  });
  const toolbar = document.getElementById("wizard-line-toolbar");
  if (toolbar) {
    toolbar.parentNode.insertBefore(bookFilterPanel, toolbar.nextSibling);
  }

  // Listen for book-filter-changed and re-render current step (same render cycle, no page rebuild)
  document.addEventListener("book-filter-changed", (e) => {
    allowedBooks = e.detail.allowedBooks;
    const scrollY = window.scrollY;
    render();
    window.scrollTo(0, scrollY);
  });

  const fileImport = document.getElementById("input-import-json");
  document.getElementById("btn-import-json")?.addEventListener("click", () => fileImport?.click());
  fileImport?.addEventListener("change", async () => {
    const file = fileImport.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      character = importCharacterFromExportPayload(parsed);

      // Restore allowedBooks from imported payload (Requirement 4.3, 4.4, 4.5)
      if (Array.isArray(parsed.allowedBooks)) {
        const validSlugs = new Set((bundle._sourceRegistry || []).map(e => e.slug));
        allowedBooks = new Set(parsed.allowedBooks.filter(slug => validSlugs.has(slug)));
      } else {
        // Field absent (older exports): default all books enabled
        allowedBooks = new Set((bundle._sourceRegistry || []).map(e => e.slug));
      }

      stepIndex = 0;
      reviewViewMode = "sheet";
      appMainTab = "wizard";
      skillsGateIssues = [];
      normalizeCharacterStateAfterLoad();
      updateHeaderTierDisplay();
      render();
      syncBookFilterPanelCheckboxes();
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
  const host = document.getElementById("wizard-step-host") || rootEl;
  const msg = err instanceof Error ? err.message : String(err);
  if (host) {
    host.innerHTML = "";
    const p = document.createElement("p");
    p.className = "warn";
    p.textContent = `Failed to load game data: ${msg}`;
    host.appendChild(p);
  }
});
