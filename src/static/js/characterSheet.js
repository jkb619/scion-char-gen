import { boonDisplayLabel } from "./boonLabels.js";
import { boonIsPurviewInnateAutomaticGrant } from "./eligibility.js";
import { purviewInnateBlocks } from "./purviewInnate.js";
import { purviewDisplayNameForPantheon } from "./purviewDisplayName.js";
import { applyGameDataHint } from "./fieldHelp.js";
import { LEGEND_SHEET_DOT_COUNT } from "./characterSheetLegendPools.js";
import { fillMcgFourPageLayout } from "./characterSheetMcgLayout.js";
import { fillDragonFourPageLayout } from "./characterSheetDragonLayout.js";
import { sheetFinalAttrsAfterFavored, sheetFinalSkillDots } from "./sheetExportAttrs.js";
import { knackSheetGroupLabel } from "./knackSheetGroupLabel.js";
import { formatGameDataSourceForDisplay } from "./sourceDisplayForUi.js";

/** Read-only Legend dot row for print / non-Review sheets (may be fewer than sheet pool columns). Bubbles stay empty for at-table Legend rating. */
function sheetLegendDotTrackReadOnly(_filledRatingIgnored, max) {
  const wrap = document.createElement("span");
  wrap.className = "cs-dot-track cs-legend-dot-track" + (max > 6 ? " cs-legend-dot-track-dense" : "");
  const cap = Math.max(1, Math.min(20, Math.round(Number(max) || 1)));
  for (let i = 1; i <= cap; i += 1) {
    const d = document.createElement("span");
    d.className = "cs-dot";
    d.setAttribute("aria-hidden", "true");
    wrap.appendChild(d);
  }
  return wrap;
}

/** Read-only Awareness dot row (Mythos). */
function sheetAwarenessDotTrackReadOnly(n, max) {
  const cap = Math.max(1, Math.min(20, Math.round(Number(max) || 1)));
  const wrap = document.createElement("span");
  wrap.className = "cs-dot-track cs-legend-dot-track" + (cap > 6 ? " cs-legend-dot-track-dense" : "");
  wrap.setAttribute("role", "img");
  const v = Math.max(1, Math.min(cap, Math.round(Number(n) || 1)));
  wrap.setAttribute("aria-label", `Awareness ${v} of ${cap}`);
  for (let i = 1; i <= cap; i += 1) {
    const d = document.createElement("span");
    d.className = "cs-dot" + (i <= v ? " on" : "");
    d.setAttribute("aria-hidden", "true");
    wrap.appendChild(d);
  }
  return wrap;
}

/**
 * Origin / Storypath: Defense equals the **highest** Resilience Attribute after Favored Approach
 * (Stamina, Resolve, Composure). See Origin chargen (pp. 98–99) and Resilience / combat notes.
 * @param {Record<string, number | undefined>} finalAttrs — attributes after Favored Approach (dots 1–5)
 */
export function originDefenseFromFinalAttrs(finalAttrs) {
  const clip = (v) => Math.max(1, Math.min(5, Math.round(Number(v) || 1)));
  return Math.max(
    clip(finalAttrs?.stamina),
    clip(finalAttrs?.resolve),
    clip(finalAttrs?.composure),
  );
}

/**
 * Chargen “movement dice” pool size: **Athletics** skill dots + **higher** of **Might** or **Dexterity**
 * (attributes after Favored Approach). Recorded at sheet finish per app `tier.json` / `skills.json` (Origin).
 * @param {Record<string, number | undefined>} finalAttrs
 * @param {number} athleticsSkillDots — Athletics rating 0–5
 */
export function originMovementPoolDice(finalAttrs, athleticsSkillDots) {
  const ath = Math.max(0, Math.min(5, Math.round(Number(athleticsSkillDots) || 0)));
  const clip = (v) => Math.max(1, Math.min(5, Math.round(Number(v) || 1)));
  const might = clip(finalAttrs?.might);
  const dex = clip(finalAttrs?.dexterity);
  return ath + Math.max(might, dex);
}

/**
 * Origin / Storypath Health slots from final Stamina (after Favored Approach).
 * Base track: Bruised, Injured, Maimed, Taken Out. At Stamina 3–4 gain one extra Bruised; at Stamina 5+ gain two extra (three Bruised total).
 * @param {number} staminaRating — final Stamina dots (1–5 at chargen)
 */
export function originHealthInjurySlots(staminaRating) {
  const s = Math.max(1, Math.min(5, Math.round(Number(staminaRating) || 1)));
  let bruisedCount = 1;
  if (s >= 5) bruisedCount = 3;
  else if (s >= 3) bruisedCount = 2;
  /** @type {{ tier: string; label: string }[]} */
  const slots = [];
  for (let i = 0; i < bruisedCount; i += 1) {
    slots.push({
      tier: "bruised",
      label: bruisedCount > 1 ? `Bruised (${i + 1})` : "Bruised",
    });
  }
  slots.push({ tier: "injured", label: "Injured" });
  slots.push({ tier: "maimed", label: "Maimed" });
  slots.push({ tier: "takenOut", label: "Taken Out" });
  return { stamina: s, bruisedCount, slots };
}

/**
 * Pantheon Virtue extremes (first two entries in `virtues.json` for that pantheon) with five dots between (0–5 filled toward the second Virtue).
 * @param {{ pantheonId?: string; virtueSpectrum?: number }} slice
 * @param {Record<string, unknown>} bundle
 * @param {boolean} interactive
 * @param {(dotIndex: number) => void} [onSpectrum] — when interactive; `dotIndex` is 1–5 for the clicked dot (parent applies toggle vs current value)
 */
export function buildVirtueSpectrumElement(slice, bundle, interactive, onSpectrum) {
  const pid = String(slice?.pantheonId ?? "").trim();
  if (!pid) return null;
  const pack = bundle?.virtues?.[pid];
  const list = pack?.virtues;
  if (!Array.isArray(list) || list.length < 2) return null;
  const left = list[0];
  const right = list[1];
  const cur = Math.max(0, Math.min(5, Math.round(Number(slice?.virtueSpectrum) || 0)));

  const wrap = document.createElement("div");
  wrap.className = "cs-field cs-virtue-spectrum" + (interactive ? " cs-virtue-spectrum--interactive" : "");
  wrap.setAttribute(
    "aria-label",
    `Virtues between ${left.name || left.id} and ${right.name || right.id}, ${cur} of 5`,
  );

  const lab = document.createElement("div");
  lab.className = "cs-field-label";
  lab.textContent = "Virtues";
  wrap.appendChild(lab);

  const inner = document.createElement("div");
  inner.className = "cs-field-value cs-virtue-spectrum-inner";

  const leftEl = document.createElement("div");
  leftEl.className = "cs-virtue-pole cs-virtue-pole--left";
  const ln = document.createElement("span");
  ln.className = "cs-virtue-name";
  ln.textContent = left.name || left.id || "";
  leftEl.appendChild(ln);

  const track = document.createElement("span");
  track.className = "cs-dot-track cs-virtue-dot-track";
  track.setAttribute("role", "img");
  for (let dotIdx = 1; dotIdx <= 5; dotIdx += 1) {
    const d = document.createElement("span");
    d.className = "cs-dot" + (dotIdx <= cur ? " on" : "");
    d.setAttribute("aria-hidden", "true");
    if (interactive && typeof onSpectrum === "function") {
      d.tabIndex = 0;
      d.addEventListener("click", () => onSpectrum(dotIdx));
    }
    track.appendChild(d);
  }

  const rightEl = document.createElement("div");
  rightEl.className = "cs-virtue-pole cs-virtue-pole--right";
  const rn = document.createElement("span");
  rn.className = "cs-virtue-name";
  rn.textContent = right.name || right.id || "";
  rightEl.appendChild(rn);

  inner.appendChild(leftEl);
  inner.appendChild(track);
  inner.appendChild(rightEl);
  wrap.appendChild(inner);
  return wrap;
}

/**
 * Character sheet HTML (Scion 2e–style layout for Review).
 * @param {Record<string, unknown>} data — `buildExportObject()` output
 * @param {Record<string, unknown>} bundle — loaded game bundle
 */
/**
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} bundle
 * @param {{
 *   getLegendPoolSpentAt: (idx: number) => boolean;
 *   setLegendPoolSpentAt: (idx: number, v: boolean) => void;
 *   getAwarenessPoolSpentAt: (idx: number) => boolean;
 *   setAwarenessPoolSpentAt: (idx: number, v: boolean) => void;
 *   onLegendDotClick?: (dotIndex1Based: number) => void;
 *   getInheritancePoolSpentAt?: (idx: number) => boolean;
 *   setInheritancePoolSpentAt?: (idx: number, v: boolean) => void;
 *   onInheritancePoolDotClick?: (dotIndex1Based: number) => void;
 * } | null | undefined} [sheetHooks] — Review: Deity Legend/Awareness pools; Dragon Heir Inheritance pool
 */
export function buildCharacterSheet(data, bundle, sheetHooks) {
  const skills = bundle?.skills || {};
  const attrs = bundle?.attributes || {};
  if (String(data.chargenLineage ?? "").trim() === "dragonHeir") {
    const el = document.createElement("div");
    el.className = "character-sheet character-sheet--dragon-heir";
    el.dataset.sheetLayout = "dragon4";
    const skillName = (id) => skills[id]?.name || id;
    const attrName = (id) => attrs[id]?.name || id;
    const ldmRaw = data.legendDotMax;
    const legendMax =
      ldmRaw != null && ldmRaw !== "" && !Number.isNaN(Number(ldmRaw))
        ? Math.max(1, Math.min(20, Math.round(Number(ldmRaw))))
        : LEGEND_SHEET_DOT_COUNT;
    fillDragonFourPageLayout(el, {
      data,
      bundle,
      skillName,
      attrName,
      originHealthInjurySlots,
      sheetHooks: sheetHooks || null,
      legendMax,
      legendDotTrackReadOnly: sheetLegendDotTrackReadOnly,
      awarenessDotTrackReadOnly: sheetAwarenessDotTrackReadOnly,
    });
    return el;
  }
  const tid = data.tierId ?? data.tier;
  const tierName = data.tierName || bundle?.tier?.[tid]?.name || tid || "—";
  const tierKey = String(tid ?? "mortal").trim().toLowerCase();
  const tierKeyNorm = tierKey === "origin" ? "mortal" : tierKey;
  const ldmRaw = data.legendDotMax;
  const legendMax =
    ldmRaw != null && ldmRaw !== "" && !Number.isNaN(Number(ldmRaw))
      ? Math.max(1, Math.min(20, Math.round(Number(ldmRaw))))
      : LEGEND_SHEET_DOT_COUNT;

  const skillName = (id) => skills[id]?.name || id;
  const attrName = (id) => attrs[id]?.name || id;

  const patronKind = String(data.patronKind ?? "").trim().toLowerCase();
  const isTitanLine = patronKind === "titan" || tierKeyNorm === "titanic";
  const isSorcererLine =
    tierKeyNorm === "sorcerer" ||
    tierKeyNorm === "sorcerer_hero" ||
    tierKeyNorm === "sorcerer_demigod" ||
    tierKeyNorm === "sorcerer_god";
  let mcgPaletteClass = "";
  if (isSorcererLine) mcgPaletteClass = " character-sheet--mcg-sorcerer";
  else if (isTitanLine) mcgPaletteClass = " character-sheet--mcg-titan";

  const el = document.createElement("div");
  el.className = "character-sheet character-sheet--mcg" + mcgPaletteClass;
  el.dataset.sheetLayout = "mcg4";

  function dotTrack(n) {
    const wrap = document.createElement("span");
    wrap.className = "cs-dot-track";
    const v = Math.max(0, Math.min(5, Number(n) || 0));
    for (let i = 1; i <= 5; i += 1) {
      const d = document.createElement("span");
      d.className = "cs-dot" + (i <= v ? " on" : "");
      d.setAttribute("aria-hidden", "true");
      wrap.appendChild(d);
    }
    return wrap;
  }

  const admRaw = data.awarenessDotMax;
  const awarenessMax =
    admRaw != null && admRaw !== "" && !Number.isNaN(Number(admRaw))
      ? Math.max(LEGEND_SHEET_DOT_COUNT, Math.round(Number(admRaw)))
      : String(data.pantheonId || "").trim() === "mythos"
        ? Math.max(LEGEND_SHEET_DOT_COUNT, legendMax)
        : 1;

  function buildKnackSheetRows() {
    const out =
      /** @type {{ knackId: string; title: string; description: string; mechanicalEffects: string; source: string }[]} */ ([]);
    const addIds = (ids, suffix) => {
      const pant = String(data.pantheonId ?? "").trim();
      for (const id of ids || []) {
        const k = bundle?.knacks?.[id];
        const base = k?.name || id;
        const title =
          k && typeof k === "object"
            ? `${base} (${knackSheetGroupLabel(k, bundle, pant)})`
            : suffix
              ? `${base} (${suffix})`
              : base;
        out.push({
          knackId: String(id),
          title,
          description: (k?.description || "").trim(),
          mechanicalEffects: (k?.mechanicalEffects || "").trim(),
          source: formatGameDataSourceForDisplay((k?.source || "").trim()),
        });
      }
    };
    if (Array.isArray(data.knackIds) && data.knackIds.length) addIds(data.knackIds, "");
    const finIds = data.finishing?.finishingKnackIds;
    if (Array.isArray(finIds) && finIds.length) addIds(finIds, "");
    if (out.length) return out;
    for (const name of data.knacks || []) {
      if (name) out.push({ knackId: "", title: String(name), description: "", mechanicalEffects: "", source: "" });
    }
    for (const name of data.finishingKnacks || []) {
      if (name) out.push({ knackId: "", title: String(name), description: "", mechanicalEffects: "", source: "" });
    }
    return out;
  }

  function buildBoonSheetRows() {
    const out = /** @type {{ title: string; description: string; source: string }[]} */ ([]);
    for (const bid of data.boons || []) {
      const b = bundle?.boons?.[bid];
      if (b && boonIsPurviewInnateAutomaticGrant(b, bundle)) continue;
      out.push({
        title: b ? boonDisplayLabel(b, bundle, data.pantheonId) : bid,
        description: (b?.description || "").trim(),
        source: formatGameDataSourceForDisplay((b?.source || "").trim()),
      });
    }
    return out;
  }

  function buildEquipmentSheetRows() {
    const out = /** @type {{ title: string; description: string; source: string }[]} */ ([]);
    const eqBundle = bundle?.equipment || {};
    const tagBundle = bundle?.tags || {};
    const ids = Array.isArray(data.sheetEquipmentIds) ? data.sheetEquipmentIds : [];
    for (const eid of ids) {
      if (!eid || String(eid).startsWith("_")) continue;
      const eq = eqBundle[eid];
      if (!eq) continue;
      const tagIds = Array.isArray(eq.tagIds) ? eq.tagIds : [];
      const tagPart =
        tagIds.length > 0
          ? `Tags: ${tagIds.map((tid) => tagBundle[tid]?.name || tid).filter(Boolean).join(", ")}`
          : "";
      const typePart = eq.equipmentType ? `Type: ${eq.equipmentType}` : "";
      const mech = (eq.mechanicalEffects || "").trim();
      const desc = [typePart, tagPart, (eq.description || "").trim(), mech ? `Mechanics: ${mech}` : ""]
        .filter(Boolean)
        .join(" · ");
      out.push({
        title: eq.name || eid,
        description: desc,
        source: formatGameDataSourceForDisplay((eq.source || "").trim()),
      });
    }
    return out;
  }


  const finalA = sheetFinalAttrsAfterFavored(data, bundle);
  const skillDots = sheetFinalSkillDots(data, bundle);
  const specs = data.skillSpecialties || {};
  const defRating = originDefenseFromFinalAttrs(finalA);
  const athDots = Math.max(0, Math.min(5, Math.round(Number(skillDots.athletics) || 0)));
  const moveDice = originMovementPoolDice(finalA, athDots);
  const healthSpec = originHealthInjurySlots(Number(finalA.stamina ?? 1));

  fillMcgFourPageLayout(el, {
    data,
    bundle,
    tierName,
    tid,
    tierKeyNorm,
    legendMax,
    skillName,
    attrName,
    skillDots,
    specs,
    finalA,
    defRating,
    moveDice,
    healthSpec,
    dotTrack,
    legendDotTrackReadOnly: sheetLegendDotTrackReadOnly,
    awarenessDotTrackReadOnly: sheetAwarenessDotTrackReadOnly,
    buildVirtueSpectrumElement,
    buildKnackSheetRows,
    buildBoonSheetRows,
    buildEquipmentSheetRows,
    purviewDisplayNameForPantheon,
    purviewInnateBlocks,
    boonDisplayLabel,
    boonIsPurviewInnateAutomaticGrant,
    applyGameDataHint,
    awarenessMax,
    sheetHooks: sheetHooks || null,
  });

  const sp = data.sorceryProfile;
  const tp = data.titanicProfile;
  const smBlock = [];
  if (sp && typeof sp === "object") {
    if (String(sp.motif || "").trim()) smBlock.push(`Sorcerer motif: ${String(sp.motif).trim()}`);
    if (String(sp.powerSource || "").trim()) smBlock.push(`Sources of power: ${String(sp.powerSource).trim()}`);
    if (String(sp.invocation || "").trim()) smBlock.push(`Invocation: ${String(sp.invocation).trim()}`);
    if (String(sp.patronage || "").trim()) smBlock.push(`Patronage: ${String(sp.patronage).trim()}`);
    if (String(sp.prohibition || "").trim()) smBlock.push(`Prohibition: ${String(sp.prohibition).trim()}`);
    if (String(sp.talisman || "").trim()) smBlock.push(`Talisman: ${String(sp.talisman).trim()}`);
    if (String(sp.notes || "").trim()) smBlock.push(`Sorcery notes: ${String(sp.notes).trim()}`);
  }
  if (tp && typeof tp === "object") {
    if (String(tp.motif || "").trim()) smBlock.push(`Titanic motif: ${String(tp.motif).trim()}`);
    const mc = String(tp.mutationCallingId || "").trim();
    if (mc) smBlock.push(`Mutation Calling: ${bundle?.callings?.[mc]?.name || mc}`);
    const md = Math.round(Number(tp.mutationDots) || 0);
    if (md > 0) smBlock.push(`Mutation dots: ${md}`);
    if (String(tp.condition || "").trim()) smBlock.push(`Mutation condition: ${String(tp.condition).trim()}`);
    if (String(tp.suppressEpicenterNotes || "").trim())
      smBlock.push(`Epicenter / collateral notes: ${String(tp.suppressEpicenterNotes).trim()}`);
  }
  if (smBlock.length) {
    const ap = document.createElement("div");
    ap.className = "cs-page cs-page--mcg cs-page--mcg-appendix";
    const h = document.createElement("header");
    h.className = "cs-subpage-banner";
    const left = document.createElement("div");
    left.className = "cs-subpage-banner-name";
    left.textContent = String(data.characterName ?? "").trim() || "Character";
    const right = document.createElement("div");
    right.className = "cs-subpage-banner-sub";
    right.textContent = "Saints & Monsters";
    h.appendChild(left);
    h.appendChild(right);
    ap.appendChild(h);
    const smSec = document.createElement("section");
    smSec.className = "cs-section";
    const sh = document.createElement("h3");
    sh.className = "cs-section-title";
    sh.textContent = "Sorcerer & Titanic extras";
    smSec.appendChild(sh);
    const fb = document.createElement("div");
    fb.className = "cs-field";
    const lab = document.createElement("div");
    lab.className = "cs-field-label";
    lab.textContent = "Recorded in wizard (export JSON)";
    const val = document.createElement("div");
    val.className =
      "cs-field-value cs-field-value-multiline cs-field-value-sheet-appendix cs-field-value-sheet-appendix--tall";
    val.textContent = smBlock.join("\n\n");
    fb.appendChild(lab);
    fb.appendChild(val);
    smSec.appendChild(fb);
    ap.appendChild(smSec);
    el.appendChild(ap);
  }


  return el;
}
