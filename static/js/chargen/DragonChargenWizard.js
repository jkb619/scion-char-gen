/**
 * Scion: Dragon — Heir character wizard (parallel track; Scion deity/titan flow stays in app.js).
 * @typedef {{ stepIndex?: number; flightId?: string; paths?: { origin?: string; role?: string; flight?: string }; pathRank?: { primary?: string; secondary?: string; tertiary?: string }; pathSkills?: { origin?: string[]; role?: string[]; flight?: string[] }; skillDots?: Record<string, number>; skillSpecialties?: Record<string, string>; attributes?: Record<string, number>; arenaRank?: string[]; favoredApproach?: string; callingSlots?: { id?: string; dots?: number }[]; knackSlotById?: Record<string, number>; callingKnackIds?: string[]; draconicKnackIds?: string[]; knownMagics?: string[]; spellsByMagicId?: Record<string, string>; bonusSpell?: { magicId?: string; spellId?: string }; birthrightPicks?: { id?: string; dots?: number }[]; finishingFocus?: string; finishingCallingKnackIds?: string[]; finishingBirthrightPicks?: { id?: string; dots?: number }[]; inheritance?: number; deedName?: string; remembranceTrackCenter?: boolean }} DragonState
 */

import { applyGameDataHint, applyHint } from "../fieldHelp.js";
import {
  knackEligible,
  knackEligibleForCallingStep,
  knackSetWithinCallingSlots,
  knackIdsCallingSlotsUsed,
  syncHeroKnackSlotAssignments,
} from "../eligibility.js";
import { originDefenseFromFinalAttrs, originMovementPoolDice, buildCharacterSheet } from "../characterSheet.js";

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

const PATH_KEYS = ["origin", "role", "flight"];

const STEPS = ["welcome", "paths", "skills", "attributes", "callings", "magic", "birthrights", "finishing", "review"];

/** Blank Birthright templates plus catalog rows tagged for Dragon Heir (avoids loading the full PB Relic dump in selects). */
const DRAGON_BIRTHRIGHT_TEMPLATE_IDS = new Set(["relic", "creature", "follower", "cult", "guide"]);

/**
 * @param {Record<string, unknown>} bundle
 * @returns {Record<string, unknown>}
 */
function birthrightsForDragonChargen(bundle) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [bid, b] of Object.entries(bundle.birthrights || {})) {
    if (bid.startsWith("_") || !b || typeof b !== "object") continue;
    if (DRAGON_BIRTHRIGHT_TEMPLATE_IDS.has(bid)) {
      out[bid] = b;
      continue;
    }
    const lines = /** @type {{ chargenLines?: unknown }} */ (b).chargenLines;
    if (Array.isArray(lines) && lines.includes("dragonHeir")) out[bid] = b;
  }
  return out;
}

/**
 * @param {Record<string, unknown>} bundle
 * @param {string} [currentPickId]
 */
function dragonBirthrightSelectOptions(bundle, currentPickId) {
  const base = birthrightsForDragonChargen(bundle);
  const id = String(currentPickId || "").trim();
  const all = bundle.birthrights || {};
  if (id && all[id] && typeof all[id] === "object" && !base[id]) {
    return { ...base, [id]: all[id] };
  }
  return base;
}

/** @param {Record<string, unknown>} character */
export function isDragonHeirChargen(character) {
  return String(character?.chargenLineage ?? "").trim() === "dragonHeir";
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
    skillDots: {},
    skillSpecialties: {},
    attributes: attrs,
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
    birthrightPicks: [],
    finishingFocus: "knacks",
    finishingCallingKnackIds: [],
    finishingBirthrightPicks: [],
    inheritance: 1,
    deedName: "",
    remembranceTrackCenter: true,
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
  if (!Number.isFinite(Number(d.stepIndex)) || d.stepIndex < 0) d.stepIndex = 0;
  if (d.stepIndex >= STEPS.length) d.stepIndex = STEPS.length - 1;
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
  if (!d.skillDots || typeof d.skillDots !== "object") d.skillDots = {};
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
  if (!d.knackSlotById || typeof d.knackSlotById !== "object") d.knackSlotById = {};
  if (!Array.isArray(d.callingKnackIds)) d.callingKnackIds = [];
  if (!Array.isArray(d.draconicKnackIds)) d.draconicKnackIds = [];
  if (!Array.isArray(d.knownMagics)) d.knownMagics = ["", "", ""];
  while (d.knownMagics.length < 3) d.knownMagics.push("");
  d.knownMagics = d.knownMagics.slice(0, 3).map((x) => String(x ?? "").trim());
  if (!d.spellsByMagicId || typeof d.spellsByMagicId !== "object") d.spellsByMagicId = {};
  if (!d.bonusSpell || typeof d.bonusSpell !== "object") d.bonusSpell = { magicId: "", spellId: "" };
  if (!Array.isArray(d.birthrightPicks)) d.birthrightPicks = [];
  d.birthrightPicks = d.birthrightPicks
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      id: String(p.id ?? "").trim(),
      dots: Math.max(1, Math.min(5, Math.round(Number(p.dots) || 1))),
    }));
  if (!d.finishingFocus) d.finishingFocus = "knacks";
  if (!Array.isArray(d.finishingCallingKnackIds)) d.finishingCallingKnackIds = [];
  if (!Array.isArray(d.finishingBirthrightPicks)) d.finishingBirthrightPicks = [];
  if (d.inheritance == null || Number.isNaN(Number(d.inheritance))) d.inheritance = 1;
  d.inheritance = Math.max(1, Math.min(9, Math.round(Number(d.inheritance) || 1)));
  if (d.deedName == null) d.deedName = "";
  d.remembranceTrackCenter = d.remembranceTrackCenter !== false;
}

function skillIds(bundle) {
  return Object.keys(bundle?.skills || {}).filter((k) => !k.startsWith("_"));
}

function ensureDragonSkillDots(d, bundle) {
  for (const id of skillIds(bundle)) {
    if (d.skillDots[id] == null) d.skillDots[id] = 0;
  }
}

function computeDragonPathDots(d, bundle) {
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
  for (const id of skillIds(bundle)) dots[id] = Math.min(5, dots[id]);
  return dots;
}

function applyDragonPathMathToSkillDots(d, bundle) {
  ensureDragonSkillDots(d, bundle);
  const rec = computeDragonPathDots(d, bundle);
  Object.assign(d.skillDots, rec);
  for (const sid of skillIds(bundle)) {
    if ((d.skillDots[sid] || 0) < 3) delete d.skillSpecialties[sid];
  }
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

/** Which priority bucket (primary 6 / secondary 4 / tertiary 2 extras) an attribute belongs to. */
function dragonAttrPriorityBucket(d, attrId) {
  for (let i = 0; i < 3; i += 1) {
    const arName = d.arenaRank[i];
    if (ARENAS[arName]?.includes(attrId)) return ["primary", "secondary", "tertiary"][i];
  }
  return "tertiary";
}

/** @returns {string[]} */
function validateDragonAttributesPreFavored(d) {
  const msgs = [];
  const pool = { primary: 6, secondary: 4, tertiary: 2 };
  for (const rank of ["primary", "secondary", "tertiary"]) {
    let sum = 0;
    for (const aid of Object.keys(d.attributes)) {
      if (dragonAttrPriorityBucket(d, aid) === rank) {
        sum += Math.max(0, (d.attributes[aid] ?? 1) - 1);
      }
    }
    if (sum !== pool[rank]) {
      msgs.push(
        `${rank} arena: distribute exactly ${pool[rank]} extra dots beyond the free 1 each (currently ${sum}).`,
      );
    }
  }
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
 * @param {{ root: HTMLElement; character: Record<string, unknown>; bundle: Record<string, unknown>; render: () => void; onExitToScionConcept?: () => void }} ctx
 */
export function renderDragonChargen(ctx) {
  const { root, character, bundle, render, onExitToScionConcept } = ctx;
  ensureDragonShape(character, bundle);
  const d = character.dragon;
  const step = STEPS[d.stepIndex] || "welcome";

  const nav = document.getElementById("wizard-nav");
  if (nav) {
    nav.style.display = "";
    nav.innerHTML = "";
    STEPS.forEach((id, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = id.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      if (idx === d.stepIndex) btn.classList.add("active");
      if (idx < d.stepIndex) btn.classList.add("done");
      btn.addEventListener("click", () => {
        persistDragonFromDom(character, bundle);
        d.stepIndex = idx;
        render();
      });
      nav.appendChild(btn);
    });
  }

  root.innerHTML = "";

  if (step === "welcome") {
    const body = document.createElement("div");
    body.innerHTML = `<p class="help">You are building a <strong>Dragon Heir</strong> using <em>Scion: Dragon</em> eight-step chargen (concept stays on the Scion screen; you continue here with Paths through Review).</p>
      <p class="help">Heirs use <strong>Inheritance</strong> instead of Legend for this line, Flight Paths instead of Pantheon Paths, <strong>Dragon Magic</strong>, and Draconic Knacks alongside Calling Knacks (Dragon pp. 110–114).</p>
      <p class="help"><em>Source:</em> Scion_Dragon_(Final_Download).pdf, Character Creation.</p>`;
    root.appendChild(panel("Dragon — Welcome", body));
  }

  if (step === "paths") {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="field"><label for="d-flight">Flight</label><select id="d-flight"><option value="">—</option></select></div>
      <div class="paths-step-grid">
        <div class="field"><label>Origin Path phrase</label><textarea id="d-p-origin"></textarea></div>
        <div class="field"><label>Role Path phrase</label><textarea id="d-p-role"></textarea></div>
        <div class="field"><label>Flight Path phrase</label><textarea id="d-p-flight"></textarea></div>
      </div>
      <p class="help" id="d-flight-skill-rule"></p>
      <div class="grid-2" id="d-path-ranks"></div>
      <div id="d-path-skill-panels"></div>`;
    root.appendChild(panel("Dragon — Paths", wrap));
    const fs = document.getElementById("d-flight");
    for (const [fid, meta] of Object.entries(bundle.dragonFlights || {})) {
      if (fid.startsWith("_") || !meta || typeof meta !== "object") continue;
      const o = document.createElement("option");
      o.value = fid;
      o.textContent = meta.name || fid;
      applyGameDataHint(o, meta);
      fs.appendChild(o);
    }
    fs.value = d.flightId || "";
    fs.addEventListener("change", () => {
      d.flightId = fs.value;
      const fl = bundle.dragonFlights?.[d.flightId];
      if (fl?.signatureMagicId) {
        d.knownMagics[0] = String(fl.signatureMagicId);
      }
      render();
    });
    document.getElementById("d-p-origin").value = d.paths.origin;
    document.getElementById("d-p-role").value = d.paths.role;
    document.getElementById("d-p-flight").value = d.paths.flight;
    ["d-p-origin", "d-p-role", "d-p-flight"].forEach((id) => applyHint(document.getElementById(id), id));

    const rule = document.getElementById("d-flight-skill-rule");
    const req = flightRequiredSkills(bundle, d.flightId);
    if (req.length) {
      const names = req.map((id) => bundle.skills[id]?.name || id).join(", ");
      rule.textContent = `Flight Path must include both Flight skills (${names}) plus one other Skill (Dragon p. 112).`;
    } else {
      rule.textContent = "Pick a Flight to see its two required Flight Path skills.";
    }

    const rankMount = document.getElementById("d-path-ranks");
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
      field.appendChild(lab);
      field.appendChild(sel);
      rankMount.appendChild(field);
    });

    const panels = document.getElementById("d-path-skill-panels");
    const reqFlight = flightRequiredSkills(bundle, d.flightId);
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
        h.title = "Describe this Path above; the phrase is shown here to guide Skill choices.";
      }
      box.appendChild(h);

      if (pk === "flight" && reqFlight.length >= 1) {
        const rule = document.createElement("p");
        rule.className = "help society-asset-rule";
        const aNames = reqFlight.map((id) => bundle.skills[id]?.name || id).join(" & ");
        rule.innerHTML = `<strong>Required for Flight Path:</strong> include both Flight skills — <span class="asset-skill-names">${aNames}</span> — plus exactly <em>${Math.max(0, 3 - reqFlight.length)}</em> other Skill(s) (Dragon p. 112).`;
        box.appendChild(rule);
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
            ? "Select exactly three Skills: both highlighted Flight skills plus one other."
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
          isFlightAsset ? { prefix: "Flight Path — include both listed Flight skills plus one other (Dragon p. 112)." } : undefined,
        );
        chip.addEventListener("click", () => {
          const set = new Set(d.pathSkills[pk] || []);
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
              if (viol) viol.textContent = "Flight Path must include both listed Flight skills.";
              return;
            }
          }
          if (viol) viol.textContent = "";
          d.pathSkills[pk] = next;
          render();
        });
        cdiv.appendChild(chip);
      }
      box.appendChild(cdiv);
      panels.appendChild(box);
    }
  }

  if (step === "skills") {
    applyDragonPathMathToSkillDots(d, bundle);
    const wrap = document.createElement("div");
    const intro = document.createElement("p");
    intro.className = "help";
    intro.textContent =
      "Ratings follow Path priority 3/2/1 (Dragon p. 111). Adjust Paths on the Paths step; add Specialties for any Skill at 3+ dots.";
    wrap.appendChild(intro);
    const tbl = document.createElement("table");
    tbl.className = "skill-ratings-table";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>Skill</th><th>Dots</th></tr>";
    tbl.appendChild(thead);
    const tb = document.createElement("tbody");
    for (const sid of skillIds(bundle)) {
      const sk = bundle.skills[sid];
      const val = Math.max(0, Math.min(5, Math.round(Number(d.skillDots[sid]) || 0)));
      const tr = document.createElement("tr");
      const nameTd = document.createElement("td");
      nameTd.textContent = sk?.name || sid;
      applyGameDataHint(nameTd, sk);
      const dotTd = document.createElement("td");
      dotTd.textContent = String(val);
      tr.appendChild(nameTd);
      tr.appendChild(dotTd);
      if (val >= 3) {
        const tr2 = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 2;
        td.className = "field";
        const lab = document.createElement("label");
        lab.htmlFor = `d-spec-${sid}`;
        lab.textContent = "Specialty";
        const inp = document.createElement("input");
        inp.type = "text";
        inp.id = `d-spec-${sid}`;
        inp.value = d.skillSpecialties[sid] || "";
        inp.addEventListener("input", () => {
          const t = inp.value.trim();
          if (t) d.skillSpecialties[sid] = inp.value;
          else delete d.skillSpecialties[sid];
        });
        td.appendChild(lab);
        td.appendChild(inp);
        tr2.appendChild(td);
        tb.appendChild(tr);
        tb.appendChild(tr2);
      } else {
        tb.appendChild(tr);
      }
    }
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    root.appendChild(panel("Dragon — Skills", wrap));
  }

  if (step === "attributes") {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p class="help">One free dot in each Attribute, then distribute <strong>6 / 4 / 2</strong> extra dots by arena priority, max 5 before Favored Approach (Dragon p. 111; same structure as Origin p. 97).</p>`;
    const arenaPick = document.createElement("div");
    arenaPick.className = "grid-2";
    ["primary", "secondary", "tertiary"].forEach((label, idx) => {
      const field = document.createElement("div");
      field.className = "field";
      const lab = document.createElement("label");
      lab.textContent = `${label} arena`;
      const sel = document.createElement("select");
      sel.id = `d-arena-${idx}`;
      for (const a of ARENA_ORDER) {
        const o = document.createElement("option");
        o.value = a;
        o.textContent = a;
        sel.appendChild(o);
      }
      sel.value = d.arenaRank[idx] || ARENA_ORDER[idx];
      sel.addEventListener("change", () => {
        d.arenaRank[idx] = sel.value;
        render();
      });
      field.appendChild(lab);
      field.appendChild(sel);
      arenaPick.appendChild(field);
    });
    wrap.appendChild(arenaPick);
    const wrapAttrs = document.createElement("div");
    for (const ar of ARENA_ORDER) {
      const sub = document.createElement("fieldset");
      sub.className = "panel";
      const leg = document.createElement("legend");
      leg.textContent = ar;
      sub.appendChild(leg);
      for (const aid of ARENAS[ar]) {
        const meta = bundle.attributes[aid];
        const row = document.createElement("div");
        row.className = "field";
        const lab = document.createElement("label");
        lab.htmlFor = `d-attr-${aid}`;
        lab.textContent = meta?.name || aid;
        const inp = document.createElement("input");
        inp.type = "number";
        inp.min = "1";
        inp.max = "5";
        inp.id = `d-attr-${aid}`;
        inp.value = String(Math.max(1, Math.min(5, Math.round(Number(d.attributes[aid]) || 1))));
        inp.addEventListener("change", () => {
          d.attributes[aid] = Math.max(1, Math.min(5, Math.round(Number(inp.value) || 1)));
          render();
        });
        row.appendChild(lab);
        row.appendChild(inp);
        sub.appendChild(row);
      }
      wrapAttrs.appendChild(sub);
    }
    wrap.appendChild(wrapAttrs);
    const sumP = document.createElement("p");
    sumP.className = "help";
    const errs = validateDragonAttributesPreFavored(d);
    sumP.textContent =
      errs.length === 0
        ? "Arena totals look valid for 6 / 4 / 2 distribution (before Favored Approach)."
        : errs.join(" ");
    if (errs.length) sumP.className = "warn";
    wrap.appendChild(sumP);
    const fav = document.createElement("div");
    fav.className = "field";
    fav.innerHTML = "<label>Favored Approach</label>";
    const selF = document.createElement("select");
    selF.id = "d-favored";
    for (const f of ["Force", "Finesse", "Resilience"]) {
      const o = document.createElement("option");
      o.value = f;
      o.textContent = f;
      selF.appendChild(o);
    }
    selF.value = d.favoredApproach;
    selF.addEventListener("change", () => {
      d.favoredApproach = selF.value;
      render();
    });
    fav.appendChild(selF);
    wrap.appendChild(fav);
    root.appendChild(panel("Dragon — Attributes", wrap));
  }

  if (step === "callings") {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p class="help">Three Callings, <strong>five dots</strong> split among them (minimum 1 each). You gain one Calling Knack per Calling dot; active Calling Knacks cannot exceed your Calling dots total, including Knacks from Birthrights (Dragon pp. 111–112).</p>
      <p class="help">Pick <strong>two Draconic Knacks</strong> (Feats of Scale or Transformation) at chargen (p. 112).</p>`;
    const slotBox = document.createElement("div");
    slotBox.className = "grid-2";
    for (let i = 0; i < 3; i += 1) {
      const row = document.createElement("div");
      row.className = "field";
      row.innerHTML = `<label>Calling ${i + 1}</label>`;
      const sel = document.createElement("select");
      sel.id = `d-call-${i}`;
      sel.innerHTML = `<option value="">—</option>`;
      for (const [cid, c] of Object.entries(bundle.callings || {})) {
        if (cid.startsWith("_") || !c || typeof c !== "object") continue;
        const o = document.createElement("option");
        o.value = cid;
        o.textContent = c.name || cid;
        sel.appendChild(o);
      }
      sel.value = d.callingSlots[i]?.id || "";
      sel.addEventListener("change", () => {
        d.callingSlots[i].id = sel.value;
        render();
      });
      const num = document.createElement("input");
      num.type = "number";
      num.min = "1";
      num.max = "5";
      num.id = `d-call-dots-${i}`;
      num.value = String(d.callingSlots[i].dots);
      num.addEventListener("change", () => {
        d.callingSlots[i].dots = Math.max(1, Math.min(5, Math.round(Number(num.value) || 1)));
        render();
      });
      row.appendChild(sel);
      row.appendChild(num);
      slotBox.appendChild(row);
    }
    wrap.appendChild(slotBox);
    const sum = d.callingSlots.reduce((s, x) => s + x.dots, 0);
    const sumP = document.createElement("p");
    sumP.className = sum === 5 ? "help" : "warn";
    sumP.textContent = `Calling dots total: ${sum} (must be exactly 5)`;
    wrap.appendChild(sumP);

    const shell = dragonKnackShell(character);
    syncHeroKnackSlotAssignments(shell, bundle);
    d.knackSlotById = { ...shell.knackSlotById };

    const cap = d.callingSlots.reduce((s, x) => s + x.dots, 0);
    const usedSlots = knackIdsCallingSlotsUsed(d.callingKnackIds, bundle);

    const knPanel = document.createElement("div");
    knPanel.className = "panel calling-knacks-panel";
    knPanel.innerHTML = `<h2>Calling Knacks</h2><p class="help">Same chip UI as Scion: <strong>Mortal</strong> / <strong>Immortal</strong> from the data. <strong>Muted</strong> chips match your Callings but cannot fit the current five-dot Knack budget. Slots used: <strong>${usedSlots}</strong> / <strong>${cap}</strong>. Each <strong>Heroic</strong> Knack costs one slot; one <strong>Immortal</strong> costs two (max one Immortal). Use <cite>Pandora’s Box</cite> at the table for full text.</p>`;
    const knChips = document.createElement("div");
    knChips.className = "chips";
    const knackEntries = Object.entries(bundle.knacks || {})
      .filter(([kid]) => !kid.startsWith("_"))
      .sort((a, b) => {
        const ea = knackEligible(a[1], shell, bundle);
        const eb = knackEligible(b[1], shell, bundle);
        if (ea !== eb) return ea ? -1 : 1;
        return String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0]), undefined, { sensitivity: "base" });
      });
    for (const [kid, k] of knackEntries) {
      const baseOk = knackEligible(k, shell, bundle);
      const eligible = knackEligibleForCallingStep(k, shell, bundle);
      const on = d.callingKnackIds.includes(kid);
      if (!baseOk && !on) continue;
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
        chip.title =
          "This Knack no longer fits your per-Calling Knack budgets (each Heroic Knack uses one slot; one Immortal uses two; at most one Immortal). Adjust Calling dots or clear Knacks.";
      }
      if (slotBlocked) {
        chip.title =
          "You qualify for this Knack, but your Calling rows cannot pay its slot cost yet—raise dots on a matching Calling row.";
      }
      setKnackChipContents(chip, k);
      chip.addEventListener("click", () => {
        if (chip.disabled) return;
        const set = new Set(d.callingKnackIds);
        if (set.has(kid)) set.delete(kid);
        else if (eligible) set.add(kid);
        const next = [...set];
        const shTry = { ...dragonKnackShell(character), knackIds: next };
        if (!knackSetWithinCallingSlots(next, shTry, bundle)) return;
        d.callingKnackIds = next;
        const shSync = dragonKnackShell(character);
        syncHeroKnackSlotAssignments(shSync, bundle);
        d.knackSlotById = { ...shSync.knackSlotById };
        render();
      });
      applyGameDataHint(chip, k);
      knChips.appendChild(chip);
    }
    knPanel.appendChild(knChips);
    wrap.appendChild(knPanel);

    const dkPanel = document.createElement("div");
    dkPanel.className = "panel calling-knacks-panel";
    dkPanel.innerHTML =
      "<h2>Draconic Knacks</h2><p class=\"help\">Pick <strong>two</strong> (Feats of Scale / Transformation). Chips use the same layout as Calling Knacks.</p>";
    const dkChips = document.createElement("div");
    dkChips.className = "chips";
    for (const [kid, k] of Object.entries(bundle.dragonKnacks || {})) {
      if (kid.startsWith("_") || !k || typeof k !== "object") continue;
      const on = d.draconicKnackIds.includes(kid);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (on ? " on" : "");
      setDraconicKnackChipContents(chip, k);
      chip.addEventListener("click", () => {
        const set = new Set(d.draconicKnackIds);
        if (set.has(kid)) set.delete(kid);
        else set.add(kid);
        const next = [...set];
        if (next.length > 2) return;
        d.draconicKnackIds = next;
        render();
      });
      applyGameDataHint(chip, k);
      dkChips.appendChild(chip);
    }
    dkPanel.appendChild(dkChips);
    wrap.appendChild(dkPanel);
    root.appendChild(panel("Dragon — Callings & Knacks", wrap));
  }

  if (step === "magic") {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p class="help">Start with three Dragon Magics: your Flight’s signature, plus two others. When you define your Handler, one Magic must match theirs (Dragon p. 112). You begin with one Spell per known Magic plus one bonus Spell from any of the three.</p>`;
    const sigRow = document.createElement("div");
    sigRow.className = "field";
    const sigLab = document.createElement("label");
    sigLab.textContent = "Signature Flight Magic (locked)";
    const sigInp = document.createElement("input");
    sigInp.type = "text";
    sigInp.readOnly = true;
    const mid0 = d.knownMagics[0];
    sigInp.value = mid0 ? bundle.dragonMagic?.[mid0]?.name || mid0 : "— pick Flight on Paths —";
    sigRow.appendChild(sigLab);
    sigRow.appendChild(sigInp);
    wrap.appendChild(sigRow);
    for (let slot = 1; slot <= 2; slot += 1) {
      const field = document.createElement("div");
      field.className = "field";
      const lab = document.createElement("label");
      lab.textContent = slot === 1 ? "Second Magic" : "Third Magic";
      const sel = document.createElement("select");
      sel.id = `d-magic-${slot}`;
      sel.innerHTML = `<option value="">—</option>`;
      for (const [mid, m] of Object.entries(bundle.dragonMagic || {})) {
        if (mid.startsWith("_") || !m || typeof m !== "object") continue;
        const o = document.createElement("option");
        o.value = mid;
        o.textContent = m.name || mid;
        sel.appendChild(o);
      }
      sel.value = d.knownMagics[slot] || "";
      sel.addEventListener("change", () => {
        d.knownMagics[slot] = sel.value;
        render();
      });
      field.appendChild(lab);
      field.appendChild(sel);
      wrap.appendChild(field);
    }
    const spellBlock = document.createElement("div");
    spellBlock.innerHTML = "<h3>Spells</h3>";
    for (let i = 0; i < 3; i += 1) {
      const mid = d.knownMagics[i];
      if (!mid) continue;
      const mag = bundle.dragonMagic?.[mid];
      const row = document.createElement("div");
      row.className = "field";
      const lab = document.createElement("label");
      lab.textContent = `Spell for ${mag?.name || mid}`;
      const sel = document.createElement("select");
      sel.id = `d-spell-${i}`;
      sel.innerHTML = `<option value="">—</option>`;
      const spells = Array.isArray(mag?.spells) ? mag.spells : [];
      for (const sp of spells) {
        if (!sp?.id) continue;
        const o = document.createElement("option");
        o.value = sp.id;
        o.textContent = sp.name || sp.id;
        sel.appendChild(o);
      }
      sel.value = d.spellsByMagicId[mid] || "";
      sel.addEventListener("change", () => {
        d.spellsByMagicId[mid] = sel.value;
        render();
      });
      row.appendChild(lab);
      row.appendChild(sel);
      spellBlock.appendChild(row);
    }
    const bonus = document.createElement("div");
    bonus.className = "field";
    bonus.innerHTML = "<label>Bonus Spell (any known Magic)</label>";
    const selM = document.createElement("select");
    selM.id = "d-bonus-magic";
    selM.innerHTML = `<option value="">—</option>`;
    d.knownMagics.filter(Boolean).forEach((mid) => {
      const o = document.createElement("option");
      o.value = mid;
      o.textContent = bundle.dragonMagic?.[mid]?.name || mid;
      selM.appendChild(o);
    });
    selM.value = d.bonusSpell.magicId || "";
    const selS = document.createElement("select");
    selS.id = "d-bonus-spell";
    selS.innerHTML = `<option value="">—</option>`;
    const refillSpells = () => {
      selS.innerHTML = `<option value="">—</option>`;
      const m = bundle.dragonMagic?.[selM.value];
      for (const sp of Array.isArray(m?.spells) ? m.spells : []) {
        if (!sp?.id) continue;
        const o = document.createElement("option");
        o.value = sp.id;
        o.textContent = sp.name || sp.id;
        selS.appendChild(o);
      }
      selS.value = d.bonusSpell.spellId || "";
    };
    selM.addEventListener("change", () => {
      d.bonusSpell.magicId = selM.value;
      d.bonusSpell.spellId = "";
      refillSpells();
    });
    selS.addEventListener("change", () => {
      d.bonusSpell.spellId = selS.value;
    });
    refillSpells();
    bonus.appendChild(selM);
    bonus.appendChild(selS);
    spellBlock.appendChild(bonus);
    wrap.appendChild(spellBlock);
    root.appendChild(panel("Dragon — Dragon Magic", wrap));
  }

  if (step === "birthrights") {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p class="help">Distribute <strong>seven Birthright dots</strong> among Relics, Followers, etc. (Dragon p. 112). Pick from <strong>blank templates</strong> or <strong>Dragon examples</strong>; set dots per row.</p>`;
    const rows = document.createElement("div");
    rows.id = "d-br-rows";
    wrap.appendChild(rows);
    const addRow = (pick, idx) => {
      const row = document.createElement("div");
      row.className = "field grid-2";
      const sel = document.createElement("select");
      sel.dataset.brIdx = String(idx);
      sel.innerHTML = `<option value="">—</option>`;
      for (const [bid, b] of Object.entries(dragonBirthrightSelectOptions(bundle, pick.id))) {
        const o = document.createElement("option");
        o.value = bid;
        o.textContent = /** @type {{ name?: string }} */ (b).name || bid;
        sel.appendChild(o);
      }
      sel.value = pick.id || "";
      const num = document.createElement("input");
      num.type = "number";
      num.min = "1";
      num.max = "5";
      num.value = String(pick.dots || 1);
      row.appendChild(sel);
      row.appendChild(num);
      sel.addEventListener("change", () => {
        d.birthrightPicks[idx].id = sel.value;
        render();
      });
      num.addEventListener("change", () => {
        d.birthrightPicks[idx].dots = Math.max(1, Math.min(5, Math.round(Number(num.value) || 1)));
        render();
      });
      rows.appendChild(row);
    };
    if (d.birthrightPicks.length === 0) d.birthrightPicks.push({ id: "", dots: 1 });
    d.birthrightPicks.forEach((p, i) => addRow(p, i));
    const used = d.birthrightPicks.reduce((s, p) => s + (p.id ? p.dots : 0), 0);
    const tot = document.createElement("p");
    tot.className = used === 7 ? "help" : "warn";
    tot.textContent = `Dots placed: ${used} / 7`;
    wrap.appendChild(tot);
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn secondary";
    addBtn.textContent = "Add Birthright row";
    addBtn.addEventListener("click", () => {
      d.birthrightPicks.push({ id: "", dots: 1 });
      render();
    });
    wrap.appendChild(addBtn);
    root.appendChild(panel("Dragon — Birthrights", wrap));
  }

  if (step === "finishing") {
    applyDragonPathMathToSkillDots(d, bundle);
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p class="help">Apply <strong>+5 Skills</strong>, <strong>+1 Attribute</strong> (cannot exceed 5 after Favored Approach), then either <strong>+2 Calling Knacks</strong> or <strong>+4 Birthright dots</strong> (Dragon p. 112). Record Deed Name, Remembrances, Health, Defense, Movement on your sheet.</p>`;
    const choice = document.createElement("div");
    choice.className = "field";
    choice.innerHTML = "<label>Finishing bonus</label>";
    const sel = document.createElement("select");
    sel.id = "d-fin-focus";
    sel.innerHTML = `<option value="knacks">+2 Calling Knacks</option><option value="birthrights">+4 Birthright dots</option>`;
    sel.value = d.finishingFocus || "knacks";
    sel.addEventListener("change", () => {
      d.finishingFocus = sel.value;
      render();
    });
    choice.appendChild(sel);
    wrap.appendChild(choice);
    if (d.finishingFocus === "knacks") {
      const shell = dragonKnackShell(character);
      syncHeroKnackSlotAssignments(shell, bundle);
      d.knackSlotById = { ...shell.knackSlotById };
      const finPanel = document.createElement("div");
      finPanel.className = "panel calling-knacks-panel";
      finPanel.innerHTML =
        "<h2>Extra Calling Knacks</h2><p class=\"help\">Pick <strong>two</strong> additional Calling Knacks not already taken above (Dragon p. 112). Chips match the Calling step.</p>";
      const finChips = document.createElement("div");
      finChips.className = "chips";
      const baseSet = new Set(d.callingKnackIds);
      const finEntries = Object.entries(bundle.knacks || {})
        .filter(([kid]) => !kid.startsWith("_") && !baseSet.has(kid))
        .filter(([_, k]) => knackEligible(k, shell, bundle))
        .sort((a, b) => String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0]), undefined, { sensitivity: "base" }));
      for (const [kid, k] of finEntries) {
        const on = d.finishingCallingKnackIds.includes(kid);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (on ? " on" : "");
        setKnackChipContents(chip, k);
        chip.addEventListener("click", () => {
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
      finPanel.appendChild(finChips);
      wrap.appendChild(finPanel);
    } else {
      const h = document.createElement("h3");
      h.textContent = "Extra Birthrights (+4 dots total)";
      wrap.appendChild(h);
      const note = document.createElement("p");
      note.className = "help";
      note.textContent = "Add rows below; distribute exactly 4 additional dots.";
      wrap.appendChild(note);
      const rows = document.createElement("div");
      if (!Array.isArray(d.finishingBirthrightPicks) || d.finishingBirthrightPicks.length === 0) {
        d.finishingBirthrightPicks = [{ id: "", dots: 1 }];
      }
      d.finishingBirthrightPicks.forEach((p, idx) => {
        const row = document.createElement("div");
        row.className = "field grid-2";
        const sel = document.createElement("select");
        sel.innerHTML = `<option value="">—</option>`;
        for (const [bid, b] of Object.entries(dragonBirthrightSelectOptions(bundle, p.id))) {
          const o = document.createElement("option");
          o.value = bid;
          o.textContent = /** @type {{ name?: string }} */ (b).name || bid;
          sel.appendChild(o);
        }
        sel.value = p.id || "";
        const num = document.createElement("input");
        num.type = "number";
        num.min = "1";
        num.max = "5";
        num.value = String(p.dots || 1);
        sel.addEventListener("change", () => {
          d.finishingBirthrightPicks[idx].id = sel.value;
          render();
        });
        num.addEventListener("change", () => {
          d.finishingBirthrightPicks[idx].dots = Math.max(1, Math.min(5, Math.round(Number(num.value) || 1)));
          render();
        });
        row.appendChild(sel);
        row.appendChild(num);
        rows.appendChild(row);
      });
      wrap.appendChild(rows);
      const add = document.createElement("button");
      add.type = "button";
      add.className = "btn secondary";
      add.textContent = "Add row";
      add.addEventListener("click", () => {
        d.finishingBirthrightPicks.push({ id: "", dots: 1 });
        render();
      });
      wrap.appendChild(add);
      const used = d.finishingBirthrightPicks.reduce((s, p) => s + (p.id ? p.dots : 0), 0);
      const tot = document.createElement("p");
      tot.className = used === 4 ? "help" : "warn";
      tot.textContent = `Finishing Birthright dots: ${used} / 4`;
      wrap.appendChild(tot);
    }
    const deed = document.createElement("div");
    deed.className = "field";
    deed.innerHTML = "<label>Deed Name</label>";
    const inp = document.createElement("input");
    inp.type = "text";
    inp.id = "d-deed-name";
    inp.value = d.deedName || "";
    inp.addEventListener("input", () => {
      d.deedName = inp.value;
    });
    deed.appendChild(inp);
    wrap.appendChild(deed);
    root.appendChild(panel("Dragon — Finishing", wrap));
  }

  if (step === "review") {
    persistDragonFromDom(character, bundle);
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

    toolbar.appendChild(lab);
    toolbar.appendChild(btnSheet);
    toolbar.appendChild(btnJson);
    toolbar.appendChild(btnPrint);
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

    root.appendChild(panel("Dragon — Review / Export", wrap));
  }

  const actions = document.createElement("div");
  actions.className = "step-actions";
  if (d.stepIndex > 0 || (d.stepIndex === 0 && typeof onExitToScionConcept === "function")) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn secondary";
    back.textContent = d.stepIndex === 0 ? "Back to Scion Concept" : "Back";
    back.addEventListener("click", () => {
      persistDragonFromDom(character, bundle);
      if (d.stepIndex === 0 && typeof onExitToScionConcept === "function") {
        onExitToScionConcept();
        return;
      }
      if (d.stepIndex > 0) d.stepIndex -= 1;
      render();
    });
    actions.appendChild(back);
  }
  if (d.stepIndex < STEPS.length - 1) {
    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn primary";
    next.textContent = "Next";
    next.addEventListener("click", () => {
      persistDragonFromDom(character, bundle);
      if (step === "paths") {
        if (!d.flightId) {
          window.alert("Choose a Flight.");
          return;
        }
        for (const pk of PATH_KEYS) {
          if ((d.pathSkills[pk] || []).length !== 3) {
            window.alert(`Pick exactly three Skills for the ${pk} path.`);
            return;
          }
        }
        const req = new Set(flightRequiredSkills(bundle, d.flightId));
        const flSkills = new Set(d.pathSkills.flight || []);
        if (req.size && [...req].some((x) => !flSkills.has(x))) {
          window.alert("Flight Path must include both of the Flight’s listed skills.");
          return;
        }
      }
      if (step === "attributes") {
        const ve = validateDragonAttributesPreFavored(d);
        if (ve.length) {
          window.alert(ve.join("\n"));
          return;
        }
      }
      if (step === "callings") {
        const sum = d.callingSlots.reduce((s, x) => s + x.dots, 0);
        const ids = d.callingSlots.map((s) => s.id).filter(Boolean);
        if (sum !== 5 || ids.length !== 3 || new Set(ids).size !== 3) {
          window.alert("Assign exactly five Calling dots across three different Callings (minimum one dot each).");
          return;
        }
        const cap = sum;
        const used = knackIdsCallingSlotsUsed(d.callingKnackIds, bundle);
        if (used > cap) {
          window.alert("Too many Calling Knacks for your Calling dots.");
          return;
        }
        if (d.draconicKnackIds.length !== 2) {
          window.alert("Select exactly two Draconic Knacks.");
          return;
        }
      }
      if (step === "magic") {
        if (!d.knownMagics[0] || !d.knownMagics[1] || !d.knownMagics[2]) {
          window.alert("You need three Dragon Magics (signature is set from Flight; pick two more).");
          return;
        }
        for (const mid of d.knownMagics) {
          if (!d.spellsByMagicId[mid]) {
            window.alert(`Choose a Spell for each Magic (${mid}).`);
            return;
          }
        }
        if (!d.bonusSpell?.magicId || !d.bonusSpell?.spellId) {
          window.alert("Choose the bonus Spell (Magic + Spell).");
          return;
        }
      }
      if (step === "birthrights") {
        const used = d.birthrightPicks.reduce((s, p) => s + (p.id ? p.dots : 0), 0);
        if (used !== 7) {
          window.alert("Birthrights must total exactly seven dots.");
          return;
        }
      }
      if (step === "finishing") {
        if (d.finishingFocus === "birthrights") {
          const u = d.finishingBirthrightPicks.reduce((s, p) => s + (p.id ? p.dots : 0), 0);
          if (u !== 4) {
            window.alert("Finishing Birthright bonus must total exactly four dots.");
            return;
          }
        } else if (d.finishingCallingKnackIds.length !== 2) {
          window.alert("Pick exactly two extra Calling Knacks, or switch to Birthright bonus.");
          return;
        } else {
          const sh = dragonKnackShell(character);
          for (const kid of d.finishingCallingKnackIds) {
            const k = bundle.knacks?.[kid];
            if (!k || !knackEligible(k, sh, bundle)) {
              window.alert(`Finishing knack no longer valid: ${kid}`);
              return;
            }
          }
        }
      }
      d.stepIndex += 1;
      render();
    });
    actions.appendChild(next);
  }
  root.appendChild(actions);
}

/** @param {Record<string, unknown>} character */
export function persistDragonFromDom(character, bundle) {
  if (!isDragonHeirChargen(character)) return;
  ensureDragonShape(character, bundle);
  const d = character.dragon;
  const step = STEPS[d.stepIndex] || "welcome";
  if (step === "paths") {
    d.paths.origin = document.getElementById("d-p-origin")?.value ?? d.paths.origin;
    d.paths.role = document.getElementById("d-p-role")?.value ?? d.paths.role;
    d.paths.flight = document.getElementById("d-p-flight")?.value ?? d.paths.flight;
    const fv = document.getElementById("d-flight")?.value;
    if (fv != null) d.flightId = fv;
  }
  if (step === "attributes") {
    for (const aid of Object.keys(bundle.attributes || {})) {
      if (aid.startsWith("_")) continue;
      const el = document.getElementById(`d-attr-${aid}`);
      if (el) d.attributes[aid] = Math.max(1, Math.min(5, Math.round(Number(el.value) || 1)));
    }
    const fav = document.getElementById("d-favored")?.value;
    if (fav && APPROACH_ATTRS[fav]) d.favoredApproach = fav;
  }
  if (step === "finishing") {
    const ff = document.getElementById("d-fin-focus")?.value;
    if (ff === "knacks" || ff === "birthrights") d.finishingFocus = ff;
    d.deedName = document.getElementById("d-deed-name")?.value ?? d.deedName;
  }
  if (step === "magic") {
    d.bonusSpell = d.bonusSpell || {};
    d.bonusSpell.magicId = document.getElementById("d-bonus-magic")?.value ?? d.bonusSpell.magicId;
    d.bonusSpell.spellId = document.getElementById("d-bonus-spell")?.value ?? d.bonusSpell.spellId;
  }
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
    skills: { ...d.skillDots },
    skillSpecialties: { ...d.skillSpecialties },
    attributesAfterFavored: finAttrs,
    arenaPriority: [...d.arenaRank],
    favoredApproach: d.favoredApproach,
    defense: originDefenseFromFinalAttrs(finAttrs),
    movementDice: originMovementPoolDice(finAttrs, ath),
    sheetEquipmentIds: [...(character.sheetEquipmentIds || [])],
    fatebindings: character.fatebindings ?? "",
    sheetNotesExtra: character.sheetNotesExtra ?? "",
    dragon: dragonBlob,
  };
}
