import { boonDisplayLabel } from "./boonLabels.js";
import { boonIsPurviewInnateAutomaticGrant } from "./eligibility.js";
import { purviewInnateBlocks } from "./purviewInnate.js";
import { purviewDisplayNameForPantheon } from "./purviewDisplayName.js";
import { applyGameDataHint } from "./fieldHelp.js";

/**
 * Origin / Storypath Health slots from final Stamina (after Favored Approach).
 * Base track: Bruised, Injured, Maimed, Taken Out. At Stamina 3–4 gain one extra Bruised; at Stamina 5+ gain two extra (three Bruised total).
 * @param {number} staminaRating — final Stamina dots (1–5 at chargen)
 */
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

function originHealthInjurySlots(staminaRating) {
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
export function buildCharacterSheet(data, bundle) {
  const skills = bundle?.skills || {};
  const attrs = bundle?.attributes || {};
  if (String(data.chargenLineage ?? "").trim() === "dragonHeir") {
    const el = document.createElement("div");
    el.className = "character-sheet character-sheet--dragon-heir";
    const d = data.dragon && typeof data.dragon === "object" ? data.dragon : null;
    const fl = d?.flightId && bundle?.dragonFlights?.[d.flightId];
    const h = document.createElement("h2");
    h.textContent = "Dragon Heir (Scion: Dragon)";
    el.appendChild(h);
    const p = document.createElement("p");
    p.className = "help";
    p.textContent =
      "This sheet view is a compact summary. Use the wizard’s Dragon → Review JSON for the full export blob, and your book for Health, Remembrances, and Twists of Fate (Dragon pp. 112–120).";
    el.appendChild(p);
    const ul = document.createElement("ul");
    ul.className = "cs-summary-list";
    const add = (label, val) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${label}:</strong> ${val}`;
      ul.appendChild(li);
    };
    add("Name", data.characterName || "—");
    add("Concept", data.concept || "—");
    add("Flight", fl?.name || d?.flightId || "—");
    add("Inheritance", String(d?.inheritance ?? data.inheritance ?? "1"));
    add("Deed name", d?.deedName || "—");
    el.appendChild(ul);
    const pre = document.createElement("pre");
    pre.className = "mono";
    pre.textContent = JSON.stringify(
      {
        skills: data.skills,
        attributesAfterFavored: data.attributesAfterFavored,
        callingSlots: d?.callingSlots,
        knownMagics: d?.knownMagics,
        callingKnackIds: d?.callingKnackIds,
        draconicKnackIds: d?.draconicKnackIds,
      },
      null,
      2,
    );
    el.appendChild(pre);
    return el;
  }
  const tid = data.tierId ?? data.tier;
  const tierName = (data.tierName || bundle?.tier?.[tid]?.name || tid || "—") + (tid ? ` (${tid})` : "");
  const tierAka = data.tierAlsoKnownAs || bundle?.tier?.[tid]?.alsoKnownAs || "";
  const legRaw = data.legendRating;
  const tierKey = String(tid ?? "mortal").trim().toLowerCase();
  const tierKeyNorm = tierKey === "origin" ? "mortal" : tierKey;
  const tierWizardSteps = bundle?.tier?.[tierKeyNorm]?.wizardSteps;
  const purviewsAtThisTier = Array.isArray(tierWizardSteps) && tierWizardSteps.includes("purviews");
  const ldmRaw = data.legendDotMax;
  const legendMax =
    ldmRaw != null && ldmRaw !== "" && !Number.isNaN(Number(ldmRaw))
      ? Math.max(1, Math.round(Number(ldmRaw)))
      : (() => {
          const m = { mortal: 1, hero: 4, demigod: 8, god: 12, sorcerer: 1, titanic: 4 };
          return m[tierKeyNorm] ?? 1;
        })();

  const skillIds = Object.keys(skills).filter((k) => !k.startsWith("_"));
  const skillName = (id) => skills[id]?.name || id;
  const attrName = (id) => attrs[id]?.name || id;

  const el = document.createElement("div");
  el.className = "character-sheet";

  const arenaOrder = ["Physical", "Mental", "Social"];
  const ARENAS = {
    Physical: ["might", "dexterity", "stamina"],
    Mental: ["intellect", "cunning", "resolve"],
    Social: ["presence", "manipulation", "composure"],
  };

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

  function legendDotTrackReadOnly(n, max) {
    const wrap = document.createElement("span");
    wrap.className = "cs-dot-track cs-legend-dot-track" + (max > 6 ? " cs-legend-dot-track-dense" : "");
    const cap = Math.max(1, Math.min(20, Math.round(Number(max) || 1)));
    const v = Math.max(0, Math.min(cap, Math.round(Number(n) || 0)));
    for (let i = 1; i <= cap; i += 1) {
      const d = document.createElement("span");
      d.className = "cs-dot" + (i <= v ? " on" : "");
      d.setAttribute("aria-hidden", "true");
      wrap.appendChild(d);
    }
    return wrap;
  }

  /** Mythos Awareness: 1–10 dots (default 1). */
  function awarenessDotTrackReadOnly(n) {
    const wrap = document.createElement("span");
    wrap.className = "cs-dot-track cs-legend-dot-track cs-legend-dot-track-dense";
    wrap.setAttribute("role", "img");
    const cap = 10;
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

  function section(title) {
    const s = document.createElement("section");
    s.className = "cs-section";
    const h = document.createElement("h3");
    h.className = "cs-section-title";
    h.textContent = title;
    s.appendChild(h);
    return s;
  }

  function fieldBlock(label, value, multiline = false) {
    const b = document.createElement("div");
    b.className = "cs-field";
    const lab = document.createElement("div");
    lab.className = "cs-field-label";
    lab.textContent = label;
    const val = document.createElement("div");
    val.className = "cs-field-value" + (multiline ? " cs-field-value-multiline" : "");
    const t = value == null || value === "" ? "—" : String(value);
    val.textContent = t;
    b.appendChild(lab);
    b.appendChild(val);
    return b;
  }

  function briefCatalogText(str, max) {
    const t = String(str ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (!t) return "";
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1).trimEnd()}…`;
  }

  /** @param {{ title: string; description?: string; source?: string }[]} rows */
  function catalogListField(label, rows, emptyText, briefMax = 280) {
    const b = document.createElement("div");
    b.className = "cs-field cs-field-catalog cs-field-span-all";
    const lab = document.createElement("div");
    lab.className = "cs-field-label";
    lab.textContent = label;
    const val = document.createElement("div");
    val.className = "cs-field-value cs-catalog-list";
    if (!rows.length) {
      val.classList.add("cs-field-empty");
      val.textContent = emptyText;
    } else {
      for (const row of rows) {
        const entry = document.createElement("div");
        entry.className = "cs-catalog-entry";
        const titleEl = document.createElement("div");
        titleEl.className = "cs-catalog-title";
        titleEl.textContent = row.title;
        entry.appendChild(titleEl);
        if (row.description) {
          const d = document.createElement("div");
          d.className = "cs-catalog-desc";
          d.textContent = briefCatalogText(row.description, briefMax);
          entry.appendChild(d);
        }
        if (row.source) {
          const s = document.createElement("div");
          s.className = "cs-catalog-src";
          s.textContent = row.source;
          entry.appendChild(s);
        }
        val.appendChild(entry);
      }
    }
    b.appendChild(lab);
    b.appendChild(val);
    return b;
  }

  function buildKnackSheetRows() {
    const out = /** @type {{ title: string; description: string; source: string }[]} */ ([]);
    const addIds = (ids, suffix) => {
      for (const id of ids || []) {
        const k = bundle?.knacks?.[id];
        const base = k?.name || id;
        const title = suffix ? `${base} (${suffix})` : base;
        out.push({
          title,
          description: (k?.description || "").trim(),
          source: (k?.source || "").trim(),
        });
      }
    };
    if (Array.isArray(data.knackIds) && data.knackIds.length) addIds(data.knackIds, "");
    const finIds = data.finishing?.finishingKnackIds;
    if (Array.isArray(finIds) && finIds.length) addIds(finIds, "finishing");
    if (out.length) return out;
    for (const name of data.knacks || []) {
      if (name) out.push({ title: String(name), description: "", source: "" });
    }
    for (const name of data.finishingKnacks || []) {
      if (name) out.push({ title: `${String(name)} (finishing)`, description: "", source: "" });
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
        source: (b?.source || "").trim(),
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
        source: (eq.source || "").trim(),
      });
    }
    return out;
  }

  /** @param {string} subtitle */
  function appendixBanner(subtitle) {
    const h = document.createElement("header");
    h.className = "cs-subpage-banner";
    const left = document.createElement("div");
    left.className = "cs-subpage-banner-name";
    left.textContent = String(data.characterName ?? "").trim() || "Character";
    const right = document.createElement("div");
    right.className = "cs-subpage-banner-sub";
    right.textContent = subtitle;
    h.appendChild(left);
    h.appendChild(right);
    return h;
  }

  function page() {
    const p = document.createElement("div");
    p.className = "cs-page";
    return p;
  }

  let pageEl = page();
  el.appendChild(pageEl);

  function addToPage(node) {
    pageEl.appendChild(node);
  }

  function maybePageBreak() {
    pageEl = page();
    el.appendChild(pageEl);
  }

  /* —— Page 1: Identity —— */
  const banner = document.createElement("header");
  banner.className = "cs-banner";
  const banT = document.createElement("div");
  banT.className = "cs-banner-title";
  const charName = String(data.characterName ?? "").trim();
  banT.textContent = charName || "Character";
  const banRight = document.createElement("div");
  banRight.className = "cs-banner-right";
  const banTier = document.createElement("div");
  banTier.className = "cs-banner-tier-name";
  banTier.textContent = String(tierName);
  banRight.appendChild(banTier);
  if (tierAka) {
    const aka = document.createElement("div");
    aka.className = "cs-banner-aka";
    aka.textContent = String(tierAka);
    banRight.appendChild(aka);
  }
  const banLeg = document.createElement("div");
  banLeg.className = "cs-banner-legend";
  const legLab = document.createElement("span");
  legLab.className = "cs-banner-legend-label";
  legLab.textContent = "Legend ";
  banLeg.appendChild(legLab);
  const lv =
    legRaw != null && legRaw !== "" && !Number.isNaN(Number(legRaw)) ? Number(legRaw) : 0;
  banLeg.appendChild(legendDotTrackReadOnly(lv, legendMax));
  banRight.appendChild(banLeg);
  const pantheonIdForSheet = String(data.pantheonId ?? "").trim();
  if (pantheonIdForSheet === "mythos") {
    const banAw = document.createElement("div");
    banAw.className = "cs-banner-legend";
    const awLab = document.createElement("span");
    awLab.className = "cs-banner-legend-label";
    awLab.textContent = "Awareness ";
    banAw.appendChild(awLab);
    const awRaw = data.awarenessRating;
    const av =
      awRaw != null && awRaw !== "" && !Number.isNaN(Number(awRaw)) ? Number(awRaw) : 1;
    banAw.appendChild(awarenessDotTrackReadOnly(av));
    banRight.appendChild(banAw);
  }
  banner.appendChild(banT);
  banner.appendChild(banRight);
  addToPage(banner);

  const idGrid = document.createElement("div");
  idGrid.className = "cs-id-grid";
  idGrid.appendChild(fieldBlock("Concept", data.concept, true));
  idGrid.appendChild(fieldBlock("Player / group notes", data.notes, true));
  if (data.heroBirthrightDotsUnusedFromSeven != null) {
    idGrid.appendChild(
      fieldBlock(
        "Birthright dots unused (Hero total 7, Step 6)",
        `${data.heroBirthrightDotsUnusedFromSeven} — remaining of seven Birthright points on the Birthrights step (Hero pp. 172, 186)`,
        true,
      ),
    );
  }
  addToPage(idGrid);

  const deeds = section("Deeds");
  const deedGrid = document.createElement("div");
  deedGrid.className = "cs-deeds-grid";
  deedGrid.appendChild(fieldBlock("Short-term", data.deeds?.short, true));
  deedGrid.appendChild(fieldBlock("Long-term", data.deeds?.long, true));
  deedGrid.appendChild(fieldBlock("Band", data.deeds?.band, true));
  deeds.appendChild(deedGrid);
  addToPage(deeds);

  maybePageBreak();

  /* —— Paths & patron —— */
  const paths = section("Paths & patron");
  const pathGrid = document.createElement("div");
  pathGrid.className = "cs-two-col";
  pathGrid.appendChild(fieldBlock("Pantheon", data.pantheon));
  const patronLabel = String(data.patronKind ?? "deity").trim() === "titan" ? "Titan parent" : "Divine parent";
  pathGrid.appendChild(fieldBlock(patronLabel, data.parentDeity));
  pathGrid.appendChild(fieldBlock("Favored Approach", data.favoredApproach));
  pathGrid.appendChild(
    fieldBlock(
      "Arena priority",
      Array.isArray(data.arenaPriority) ? data.arenaPriority.map((a, i) => `${6 - i * 2} ${a}`).join(" · ") : "—",
    ),
  );
  paths.appendChild(pathGrid);
  const virtueRow = buildVirtueSpectrumElement(
    { pantheonId: data.pantheonId, virtueSpectrum: data.virtueSpectrum },
    bundle,
    false,
  );
  if (virtueRow) paths.appendChild(virtueRow);
  paths.appendChild(fieldBlock("Origin Path", data.paths?.origin, true));
  paths.appendChild(fieldBlock("Role Path", data.paths?.role, true));
  paths.appendChild(fieldBlock("Society / Pantheon Path", data.paths?.society, true));
  const pr = data.pathPriority || {};
  paths.appendChild(
    fieldBlock(
      "Path priority",
      `Primary: ${pr.primary || "—"} · Secondary: ${pr.secondary || "—"} · Tertiary: ${pr.tertiary || "—"}`,
    ),
  );
  addToPage(paths);

  const ps = section("Path skills (3 per path)");
  const psk = document.createElement("div");
  psk.className = "cs-path-skills";
  for (const key of ["origin", "role", "society"]) {
    const col = document.createElement("div");
    col.className = "cs-path-skill-col";
    const h = document.createElement("div");
    h.className = "cs-path-skill-head";
    h.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    col.appendChild(h);
    const ids = Array.isArray(data.pathSkills?.[key]) ? data.pathSkills[key] : [];
    const ul = document.createElement("ul");
    ul.className = "cs-path-skill-list";
    if (ids.length === 0) {
      const li = document.createElement("li");
      li.textContent = "—";
      ul.appendChild(li);
    } else {
      for (const sid of ids) {
        const li = document.createElement("li");
        li.textContent = skillName(sid);
        ul.appendChild(li);
      }
    }
    col.appendChild(ul);
    psk.appendChild(col);
  }
  ps.appendChild(psk);
  addToPage(ps);

  maybePageBreak();

  /* —— Skills —— */
  const sk = section("Skills");
  const table = document.createElement("table");
  table.className = "cs-skills-table";
  const thead = document.createElement("thead");
  const thr = document.createElement("tr");
  ["Skill", "Rating", "Specialties"].forEach((lab, idx) => {
    const th = document.createElement("th");
    th.textContent = lab;
    if (idx === 1) th.className = "cs-num";
    thr.appendChild(th);
  });
  thead.appendChild(thr);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  const skillDots = data.skills && typeof data.skills === "object" ? data.skills : {};
  const specs = data.skillSpecialties || {};
  for (const sid of skillIds) {
    const tr = document.createElement("tr");
    const n = skillDots[sid] || 0;
    const tdN = document.createElement("td");
    tdN.textContent = skillName(sid);
    const tdR = document.createElement("td");
    tdR.className = "cs-num";
    tdR.appendChild(dotTrack(n));
    const tdS = document.createElement("td");
    tdS.textContent = specs[sid] || "";
    tr.appendChild(tdN);
    tr.appendChild(tdR);
    tr.appendChild(tdS);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  sk.appendChild(table);
  addToPage(sk);

  /* —— Attributes —— */
  const at = section("Attributes (after Favored Approach)");
  const finalA = data.attributesAfterFavored || {};
  const arenaGrid = document.createElement("div");
  arenaGrid.className = "cs-arena-grid";
  for (const arena of arenaOrder) {
    const ids = ARENAS[arena] || [];
    const box = document.createElement("div");
    box.className = "cs-arena-box";
    const an = document.createElement("div");
    an.className = "cs-arena-name";
    an.textContent = arena;
    box.appendChild(an);
    for (const aid of ids) {
      const row = document.createElement("div");
      row.className = "cs-attr-row";
      const lab = document.createElement("span");
      lab.className = "cs-attr-name";
      lab.textContent = attrName(aid);
      const dots = document.createElement("span");
      dots.className = "cs-attr-dots";
      dots.appendChild(dotTrack(finalA[aid] ?? 1));
      row.appendChild(lab);
      row.appendChild(dots);
      box.appendChild(row);
    }
    arenaGrid.appendChild(box);
  }
  at.appendChild(arenaGrid);
  const defRating = originDefenseFromFinalAttrs(finalA);
  at.appendChild(fieldBlock("Defense", String(defRating)));
  const athDots = Math.max(0, Math.min(5, Math.round(Number(skillDots.athletics) || 0)));
  const moveDice = originMovementPoolDice(finalA, athDots);
  at.appendChild(fieldBlock("Movement dice", String(moveDice)));
  addToPage(at);

  const stamFinal = Number(finalA.stamina ?? 1);
  const healthSpec = originHealthInjurySlots(stamFinal);
  const inj = section("Injury & Health (Origin)");
  const healthNote = document.createElement("p");
  healthNote.className = "cs-health-note";
  healthNote.textContent = `Stamina (after Favored Approach): ${healthSpec.stamina}. Track: ${healthSpec.bruisedCount} Bruised Health slot(s), then Injured, Maimed, and Taken Out (Origin pp. 63, 98–99). Write each Injury’s Condition in the box; Difficulty to related actions is shown on each slot label (Storypath).`;
  inj.appendChild(healthNote);
  const healthTrack = document.createElement("div");
  healthTrack.className = "cs-health-track";
  /** @type {Record<string, string>} */
  const injuryPenalty = { bruised: "−1", injured: "−2", maimed: "−4" };
  for (const slot of healthSpec.slots) {
    const cell = document.createElement("div");
    cell.className = `cs-health-slot cs-health-slot--${slot.tier}`;
    const labelRow = document.createElement("div");
    labelRow.className = "cs-health-slot-label-row";
    const lab = document.createElement("div");
    lab.className = "cs-health-slot-label";
    lab.textContent = slot.label;
    labelRow.appendChild(lab);
    const pen = injuryPenalty[slot.tier];
    if (pen) {
      const badge = document.createElement("span");
      badge.className = "cs-health-slot-penalty";
      badge.textContent = pen;
      badge.title = "Difficulty to related actions when this Injury applies";
      labelRow.appendChild(badge);
    }
    const box = document.createElement("div");
    box.className = "cs-health-slot-box";
    const ariaPen = pen ? `, ${pen} Difficulty` : "";
    box.setAttribute("aria-label", `${slot.label}${ariaPen} — write Condition`);
    cell.appendChild(labelRow);
    cell.appendChild(box);
    healthTrack.appendChild(cell);
  }
  inj.appendChild(healthTrack);
  addToPage(inj);

  maybePageBreak();

  /* —— Calling, knacks, purviews —— */
  const pow = section("Calling, Knacks & powers");
  const powGrid = document.createElement("div");
  powGrid.className = "cs-two-col";
  const callingBlock = document.createElement("div");
  callingBlock.className = "cs-field";
  const callingLab = document.createElement("div");
  callingLab.className = "cs-field-label";
  callingLab.textContent = "Calling(s)";
  const callingVal = document.createElement("div");
  callingVal.className = "cs-field-value cs-calling-row";
  const slotRows = Array.isArray(data.callingSlots) ? data.callingSlots.filter((s) => s && typeof s === "object") : [];
  if (slotRows.length >= 3) {
    slotRows.forEach((slot, idx) => {
      const row = document.createElement("div");
      row.className = "cs-calling-multi-row";
      const nm = document.createElement("span");
      nm.className = "cs-calling-name";
      const cid = String(slot.id || "").trim();
      nm.textContent = cid ? bundle.callings?.[cid]?.name || cid : `— (Calling ${idx + 1})`;
      row.appendChild(nm);
      const d = Math.max(1, Math.min(5, Math.round(Number(slot.dots) || 1)));
      row.appendChild(dotTrack(d));
      callingVal.appendChild(row);
    });
  } else {
    const callingName = document.createElement("div");
    callingName.className = "cs-calling-name";
    callingName.textContent = data.calling == null || data.calling === "" ? "—" : String(data.calling);
    callingVal.appendChild(callingName);
    const callingDots = Math.max(1, Math.min(5, Math.round(Number(data.callingDots) || 1)));
    callingVal.appendChild(dotTrack(callingDots));
  }
  callingBlock.appendChild(callingLab);
  callingBlock.appendChild(callingVal);
  powGrid.appendChild(callingBlock);
  const knackRows = buildKnackSheetRows();
  if (knackRows.length > 0) {
    powGrid.appendChild(catalogListField("Knacks (Calling + finishing)", knackRows, "—"));
  }
  if (purviewsAtThisTier) {
    const purviewIds = (data.purviews || []).filter(Boolean);
    if (purviewIds.length > 0) {
      const nameFor = (pid) => purviewDisplayNameForPantheon(pid, bundle, data.pantheonId);
      const pvField = document.createElement("div");
      pvField.className = "cs-field";
      const pvLab = document.createElement("div");
      pvLab.className = "cs-field-label";
      pvLab.textContent = "Purviews";
      const pvVal = document.createElement("div");
      pvVal.className = "cs-field-value";
      purviewIds.forEach((pid, i) => {
        if (i > 0) pvVal.appendChild(document.createTextNode(", "));
        const sp = document.createElement("span");
        sp.className = "cs-purview-sheet-entry";
        sp.textContent = nameFor(pid);
        const pv = bundle.purviews?.[pid];
        if (pv && typeof pv === "object") applyGameDataHint(sp, pv);
        pvVal.appendChild(sp);
      });
      pvField.appendChild(pvLab);
      pvField.appendChild(pvVal);
      powGrid.appendChild(pvField);
    }
    const boonRows = buildBoonSheetRows();
    if (boonRows.length > 0) {
      powGrid.appendChild(catalogListField("Boons", boonRows, "—"));
    }
    const purviewIdsForInnate = (data.purviews || []).filter(Boolean);
    if (purviewIdsForInnate.length > 0) {
      const nameForInnate = (pid) => purviewDisplayNameForPantheon(pid, bundle, data.pantheonId);
      const mythosSheet = String(data.pantheonId || "").trim() === "mythos";
      const titanicSheet = tierKeyNorm === "titanic";
      /** @type {{ title: string; description: string; source: string }[]} */
      const innateRows = [];
      for (const pid of [...purviewIdsForInnate].sort()) {
        const blocks = purviewInnateBlocks(bundle, pid, { mythosPantheon: mythosSheet, titanicTier: titanicSheet });
        const desc = blocks.map((bl) => `${bl.label}: ${bl.body}`).join("\n\n");
        innateRows.push({
          title: `${nameForInnate(pid)} (${pid})`,
          description: desc,
          source: "",
        });
      }
      const mi = data.mythosInnatePower;
      if (mythosSheet && mi && typeof mi === "object") {
        let mythNote = "";
        if (mi.awarenessLocked === true || (mi.style === "awareness" && mi.awarenessPurviewId)) {
          const ap = String(mi.awarenessPurviewId || "").trim();
          const apName = ap ? nameForInnate(ap) : "—";
          mythNote = `Committed to Mythos Awareness Innate for “${apName}” (${ap || "—"}); cannot be reversed in play (MotM).`;
        } else {
          mythNote =
            "Mythos: using standard Purview innates until you commit to an Awareness Innate on the Purviews step (wizard).";
        }
        innateRows.push({ title: "Mythos innate choice", description: mythNote, source: "" });
      }
      powGrid.appendChild(
        catalogListField("Innate powers (granted with Purviews; not Boons)", innateRows, "—", 1600),
      );
    }
  }
  pow.appendChild(powGrid);
  addToPage(pow);

  const fin = section("Finishing touches (summary)");
  const f = data.finishing || {};
  const finLines = [
    `Extra skill dots (budget): ${f.extraSkillDots ?? "—"}`,
    `Extra attribute dots (budget): ${f.extraAttributeDots ?? "—"}`,
    `Focus: ${f.knackOrBirthright === "birthrights" ? "Birthright points" : "Extra Knacks"}`,
  ];
  if (Array.isArray(f.finishingKnacksNamed) && f.finishingKnacksNamed.length)
    finLines.push(`Finishing knacks: ${f.finishingKnacksNamed.join("; ")}`);
  if (Array.isArray(f.birthrightsNamed) && f.birthrightsNamed.length)
    finLines.push(`Birthrights: ${f.birthrightsNamed.join("; ")}`);
  fin.appendChild(fieldBlock("Recorded on sheet", finLines.join("\n"), true));
  addToPage(fin);

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
    maybePageBreak();
    addToPage(appendixBanner("Saints & Monsters"));
    const smSec = section("Sorcerer & Titanic extras");
    smSec.appendChild(fieldBlock("Recorded in wizard (export JSON)", smBlock.join("\n\n"), true));
    const smVal = smSec.querySelector(".cs-field-value-multiline");
    if (smVal) smVal.classList.add("cs-field-value-sheet-appendix", "cs-field-value-sheet-appendix--tall");
    addToPage(smSec);
  }

  maybePageBreak();
  addToPage(appendixBanner("Equipment & gear"));
  const equipSec = section("Equipment & gear");
  const equipRows = buildEquipmentSheetRows();
  equipSec.appendChild(
    catalogListField(
      "Items (library picks + write-ins below)",
      equipRows,
      "No library items selected — use Finishing → Sheet appendix, or note gear in the lines below.",
    ),
  );
  const eqBlankHint = document.createElement("p");
  eqBlankHint.className = "cs-appendix-blank-hint";
  eqBlankHint.textContent = "Additional gear, relic quirks, or legal notes:";
  equipSec.appendChild(eqBlankHint);
  const eqBlanks = document.createElement("div");
  eqBlanks.className = "cs-write-lines";
  for (let i = 0; i < 8; i += 1) {
    const line = document.createElement("div");
    line.className = "cs-write-line";
    eqBlanks.appendChild(line);
  }
  equipSec.appendChild(eqBlanks);
  addToPage(equipSec);

  maybePageBreak();
  addToPage(appendixBanner("Fatebindings"));
  const fbSec = section("Fatebindings");
  fbSec.appendChild(
    fieldBlock(
      "Bindings, patrons, nemeses, and story ties",
      data.fatebindings,
      true,
    ),
  );
  const fbVal = fbSec.querySelector(".cs-field-value-multiline");
  if (fbVal) fbVal.classList.add("cs-field-value-sheet-appendix");
  addToPage(fbSec);

  maybePageBreak();
  addToPage(appendixBanner("Session notes & chronicle"));
  const noteSec = section("Extended notes");
  noteSec.appendChild(
    fieldBlock(
      "Session log, chronicle details, SG reminders (Finishing step)",
      data.sheetNotesExtra,
      true,
    ),
  );
  const noteVal = noteSec.querySelector(".cs-field-value-multiline");
  if (noteVal) noteVal.classList.add("cs-field-value-sheet-appendix", "cs-field-value-sheet-appendix--tall");
  addToPage(noteSec);

  return el;
}
