/**
 * Four-page Review sheet for Scion: Dragon Heir — layout mirrors the MCG (Deity) four-pager
 * (`cs-mcg-*` structure) with Dragon data; palette comes from `.character-sheet--dragon-heir` CSS.
 */

import { appendLegendAwarenessDotsWithPools } from "./characterSheetLegendPools.js";
import { sheetDescriptionLinesForDisplay, sheetMultilineSixWriteLines } from "./sheetDescriptionLines.js";
import { applyGameDataHint } from "./fieldHelp.js";
import { appendDragonSpellBoonStylePlate } from "./dragonSpellUi.js";
import { birthrightTagLabels } from "./birthrightTags.js";
import { purviewDisplayNameForPantheon } from "./purviewDisplayName.js";
import { nonEmptyFatebindingRowsForSheet } from "./fatebindingsSheet.js";
import { sheetFinalAttrsAfterFavored } from "./sheetExportAttrs.js";

const LEFT_SKILLS = [
  "academics",
  "athletics",
  "closeCombat",
  "culture",
  "empathy",
  "firearms",
  "integrity",
  "leadership",
];
const RIGHT_SKILLS = [
  "medicine",
  "occult",
  "persuasion",
  "pilot",
  "science",
  "subterfuge",
  "survival",
  "technology",
];

const ARENA_ORDER = ["Mental", "Physical", "Social"];
const ARENAS = {
  Mental: ["intellect", "cunning", "resolve"],
  Physical: ["might", "dexterity", "stamina"],
  Social: ["presence", "manipulation", "composure"],
};
const APPROACH_FOR_ATTR = { might: "Power", dexterity: "Finesse", stamina: "Resilience" };

/**
 * @param {HTMLElement} el
 * @param {{
 *   data: Record<string, unknown>;
 *   bundle: Record<string, unknown>;
 *   skillName: (id: string) => string;
 *   attrName: (id: string) => string;
 *   originHealthInjurySlots: (stamina: number) => { stamina: number; bruisedCount: number; slots: { tier: string; label: string }[] };
 *   sheetHooks?: object | null;
 *   legendMax?: number;
 *   legendDotTrackReadOnly: (n: number, max: number) => HTMLElement;
 *   awarenessDotTrackReadOnly: (n: number, max: number) => HTMLElement;
 * }} api
 */
export function fillDragonFourPageLayout(el, api) {
  const {
    data,
    bundle,
    skillName,
    attrName,
    originHealthInjurySlots,
    sheetHooks,
    legendDotTrackReadOnly,
    awarenessDotTrackReadOnly,
  } = api;
  const legendPoolCtx = { sheetHooks: sheetHooks ?? null, legendDotTrackReadOnly, awarenessDotTrackReadOnly };
  const d = data.dragon && typeof data.dragon === "object" ? data.dragon : {};
  const finalA = /** @type {Record<string, number>} */ (sheetFinalAttrsAfterFavored(data, bundle));
  const skillDots = /** @type {Record<string, number>} */ (data.skills && typeof data.skills === "object" ? data.skills : {});
  const specs = /** @type {Record<string, string>} */ (
    data.skillSpecialties && typeof data.skillSpecialties === "object" ? data.skillSpecialties : {}
  );

  function dotTrack(n) {
    const wrap = document.createElement("span");
    wrap.className = "cs-dot-track";
    const v = Math.max(0, Math.min(5, Number(n) || 0));
    for (let i = 1; i <= 5; i += 1) {
      const dot = document.createElement("span");
      dot.className = "cs-dot" + (i <= v ? " on" : "");
      dot.setAttribute("aria-hidden", "true");
      wrap.appendChild(dot);
    }
    return wrap;
  }

  function page() {
    const p = document.createElement("div");
    p.className = "cs-page cs-page--dragon";
    el.appendChild(p);
    return p;
  }

  function mcgSheetTick() {
    const tick = document.createElement("span");
    tick.className = "cs-mcg-sheet-tick";
    tick.setAttribute("aria-hidden", "true");
    return tick;
  }

  function mcgLinedField(label, value) {
    const w = document.createElement("div");
    w.className = "cs-mcg-line-field";
    const l = document.createElement("span");
    l.className = "cs-mcg-line-label";
    l.textContent = label;
    const v = document.createElement("div");
    v.className = "cs-mcg-line-value";
    v.textContent = value == null || value === "" ? "" : String(value);
    w.appendChild(l);
    w.appendChild(v);
    return w;
  }

  function mcgSectionTitle(text) {
    const t = document.createElement("div");
    t.className = "cs-mcg-band-title";
    t.textContent = text;
    return t;
  }

  function mcgCheckboxRow(labels) {
    const r = document.createElement("div");
    r.className = "cs-mcg-check-row cs-mcg-check-row--stub";
    for (const lab of labels) {
      const x = document.createElement("span");
      x.className = "cs-mcg-check cs-mcg-check--stub";
      x.appendChild(mcgSheetTick());
      x.appendChild(document.createTextNode(" " + lab));
      r.appendChild(x);
    }
    return r;
  }

  function mcgDeedSheetRow(label, text) {
    const row = document.createElement("div");
    row.className = "cs-mcg-deed-row";
    const lab = document.createElement("span");
    lab.className = "cs-mcg-deed-label";
    lab.textContent = label;
    const val = document.createElement("div");
    val.className = "cs-mcg-deed-value";
    val.textContent = text == null || text === "" ? "" : String(text);
    const tick = mcgSheetTick();
    tick.title = "Track when resolved at the table.";
    row.appendChild(lab);
    row.appendChild(val);
    row.appendChild(tick);
    return row;
  }

  function mcgHardArmorRow() {
    const w = document.createElement("div");
    w.className = "cs-mcg-line-field cs-mcg-hard-armor-row";
    const l = document.createElement("span");
    l.className = "cs-mcg-line-label";
    l.textContent = "Hard armor";
    const ticks = document.createElement("div");
    ticks.className = "cs-mcg-hard-armor-ticks";
    ticks.appendChild(mcgSheetTick());
    ticks.appendChild(mcgSheetTick());
    const v = document.createElement("div");
    v.className = "cs-mcg-line-value";
    w.appendChild(l);
    w.appendChild(ticks);
    w.appendChild(v);
    return w;
  }

  function mcgBrRuledBlock(label, text) {
    const w = document.createElement("div");
    w.className = "cs-mcg-br-ruled-field";
    const l = document.createElement("span");
    l.className = "cs-mcg-line-label";
    l.textContent = label;
    const v = document.createElement("div");
    v.className = "cs-mcg-br-ruled-value";
    v.textContent = text == null || text === "" ? "" : String(text);
    w.appendChild(l);
    w.appendChild(v);
    return w;
  }

  /** @param {"origin"|"role"|"flight"} key */
  function dragonPathColumn(key) {
    const col = document.createElement("div");
    col.className = "cs-mcg-path-col";
    const head = document.createElement("div");
    head.className = "cs-mcg-path-head";
    head.textContent =
      key === "flight" ? "Flight path" : `${key.charAt(0).toUpperCase()}${key.slice(1)} path`;
    col.appendChild(head);
    col.appendChild(mcgLinedField("Path", (paths[key] || "").trim()));
    const skLab = document.createElement("div");
    skLab.className = "cs-mcg-subhead";
    skLab.textContent = "Skills";
    col.appendChild(skLab);
    const ul = document.createElement("ul");
    ul.className = "cs-mcg-path-skills";
    const ids = Array.isArray(pathSkills[key]) ? pathSkills[key] : [];
    if (!ids.length) {
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
    col.appendChild(mcgLinedField("Contacts", ""));
    col.appendChild(mcgCheckboxRow(["Invoked", "Suspended", "Revoked"]));
    return col;
  }

  function skillRowMcg(sid) {
    const row = document.createElement("div");
    row.className = "cs-mcg-skill-row";
    const nm = document.createElement("span");
    nm.className = "cs-mcg-skill-name";
    nm.textContent = skillName(sid);
    const n = Math.max(0, Math.min(5, Math.round(Number(skillDots[sid]) || 0)));
    row.appendChild(nm);
    row.appendChild(dotTrack(n));
    const sp = document.createElement("span");
    sp.className = "cs-mcg-skill-spec";
    sp.textContent = specs[sid] || "";
    row.appendChild(sp);
    return row;
  }

  function knackLabel(id) {
    const kid = String(id || "").trim();
    if (!kid) return "";
    return (
      bundle?.dragonCallingKnacks?.[kid]?.name ||
      bundle?.knacks?.[kid]?.name ||
      bundle?.dragonKnacks?.[kid]?.name ||
      kid
    );
  }

  function buildDragonKnackSheetRows() {
    const out =
      /** @type {{ knackId: string; title: string; description: string; mechanicalEffects: string; source: string }[]} */ ([]);
    const ids = /** @type {string[]} */ ([]);
    const push = (arr) => {
      for (const x of arr || []) {
        const id = String(x || "").trim();
        if (!id || ids.includes(id)) continue;
        ids.push(id);
      }
    };
    push(d.callingKnackIds);
    push(d.draconicKnackIds);
    push(d.finishingCallingKnackIds);
    for (const id of ids) {
      const k =
        bundle?.dragonCallingKnacks?.[id] ||
        bundle?.knacks?.[id] ||
        bundle?.dragonKnacks?.[id] ||
        /** @type {Record<string, unknown>} */ ({});
      out.push({
        knackId: id,
        title: knackLabel(id),
        description: String(k?.description ?? "").trim(),
        mechanicalEffects: String(k?.mechanicalEffects ?? "").trim(),
        source: String(k?.source ?? "").trim(),
      });
    }
    return out;
  }

  function buildEquipmentRows() {
    const out = /** @type {{ title: string; tags: string; description?: string }}[] */ ([]);
    const eqBundle = bundle?.equipment || {};
    const tagBundle = bundle?.tags || {};
    const ids = Array.isArray(data.sheetEquipmentIds) ? data.sheetEquipmentIds : [];
    for (const eid of ids) {
      if (!eid || String(eid).startsWith("_")) continue;
      const eq = eqBundle[eid];
      if (!eq) continue;
      const tagIds = Array.isArray(eq.tagIds) ? eq.tagIds : [];
      const tags =
        tagIds.length > 0 ? tagIds.map((tid) => tagBundle[tid]?.name || tid).filter(Boolean).join(", ") : "";
      const desc = typeof eq.description === "string" ? eq.description.trim() : "";
      out.push({ title: eq.name || eid, tags, description: desc });
    }
    return out;
  }

  /** @returns {{ sp: Record<string, unknown>; mag: Record<string, unknown> }[]} */
  function buildSpellSlots() {
    const out = /** @type {{ sp: Record<string, unknown>; mag: Record<string, unknown> }[]} */ ([]);
    const known = Array.isArray(d.knownMagics) ? d.knownMagics : [];
    const spellsBy = d.spellsByMagicId && typeof d.spellsByMagicId === "object" ? d.spellsByMagicId : {};
    for (const mid of known) {
      if (!mid) continue;
      const mag = bundle?.dragonMagic?.[mid];
      const sid = String(spellsBy[mid] || "").trim();
      const sp = Array.isArray(mag?.spells) ? mag.spells.find((x) => x && x.id === sid) : null;
      if (sp && mag && typeof sp === "object" && typeof mag === "object") out.push({ sp, mag });
    }
    const bm = String(d.bonusSpell?.magicId || "").trim();
    const bs = String(d.bonusSpell?.spellId || "").trim();
    if (bm && bs) {
      const mag = bundle?.dragonMagic?.[bm];
      const sp = Array.isArray(mag?.spells) ? mag.spells.find((x) => x && x.id === bs) : null;
      if (sp && mag && typeof sp === "object" && typeof mag === "object") out.push({ sp, mag });
    }
    const adv = Array.isArray(d.advancementSpells) ? d.advancementSpells : [];
    for (const picked of adv) {
      const mid = String(picked?.magicId || "").trim();
      const sid = String(picked?.spellId || "").trim();
      if (!mid || !sid) continue;
      const mag = bundle?.dragonMagic?.[mid];
      const sp = Array.isArray(mag?.spells) ? mag.spells.find((x) => x && x.id === sid) : null;
      if (sp && mag && typeof sp === "object" && typeof mag === "object") out.push({ sp, mag });
    }
    return out;
  }

  function allBirthrightPicks() {
    const raw = [...(d.birthrightPicks || []), ...(d.finishingBirthrightPicks || [])].filter(
      (p) => p && typeof p === "object" && String(p.id || "").trim(),
    );
    return raw.slice(0, 8);
  }

  const paths = d.paths && typeof d.paths === "object" ? d.paths : {};
  const pathSkills = d.pathSkills && typeof d.pathSkills === "object" ? d.pathSkills : {};
  const deeds = data.deeds && typeof data.deeds === "object" ? data.deeds : {};
  const healthSpec = originHealthInjurySlots(Number(finalA.stamina ?? 1));
  const injuryPenalty = { bruised: "+1d", injured: "+2d", maimed: "+4d" };
  const charName = String(data.characterName ?? "").trim();
  const chronicle = String(data.tierName || data.trackTierLabel || "").trim();
  const pr = d.pathRank && typeof d.pathRank === "object" ? d.pathRank : {};
  const rkLab = (rk) => {
    const v = String(pr[rk] || "").trim();
    if (v === "flight") return "Flight";
    if (v === "role") return "Role";
    return "Origin";
  };

  /* —— Page 1 (MCG spine) —— */
  const p1 = page();
  const top = document.createElement("div");
  top.className = "cs-mcg-p1-top";
  const rowA = document.createElement("div");
  rowA.className = "cs-mcg-header-rows";
  rowA.appendChild(mcgLinedField("Name", charName || "—"));
  rowA.appendChild(mcgLinedField("Player", ""));
  rowA.appendChild(mcgLinedField("Flight", data.flightName || data.flightId || "—"));
  const rowB = document.createElement("div");
  rowB.className = "cs-mcg-header-rows";
  rowB.appendChild(mcgLinedField("Concept", data.concept || "—"));
  rowB.appendChild(mcgLinedField("Chronicle", chronicle || "Dragon Heir"));
  const inhSummary = [
    data.inheritance != null ? `Track ${data.inheritance}` : "",
    data.inheritanceMilestone ? String(data.inheritanceMilestone) : "",
  ]
    .filter(Boolean)
    .join(" — ");
  rowB.appendChild(mcgLinedField("Inheritance", inhSummary || "—"));
  top.appendChild(rowA);
  top.appendChild(rowB);
  p1.appendChild(top);

  p1.appendChild(mcgSectionTitle("Paths"));
  const pathsRow = document.createElement("div");
  pathsRow.className = "cs-mcg-paths-3";
  pathsRow.appendChild(dragonPathColumn("origin"));
  pathsRow.appendChild(dragonPathColumn("role"));
  pathsRow.appendChild(dragonPathColumn("flight"));
  p1.appendChild(pathsRow);

  const prio = document.createElement("p");
  prio.className = "cs-mcg-path-priority";
  prio.textContent = `Path priority — Primary: ${rkLab("primary")} · Secondary: ${rkLab("secondary")} · Tertiary: ${rkLab("tertiary")}`;
  p1.appendChild(prio);

  p1.appendChild(mcgSectionTitle("Skills"));
  const skWrap = document.createElement("div");
  skWrap.className = "cs-mcg-skills-2col";
  const skL = document.createElement("div");
  skL.className = "cs-mcg-skill-col";
  const skR = document.createElement("div");
  skR.className = "cs-mcg-skill-col";
  for (const sid of LEFT_SKILLS) skL.appendChild(skillRowMcg(sid));
  for (const sid of RIGHT_SKILLS) skR.appendChild(skillRowMcg(sid));
  skWrap.appendChild(skL);
  skWrap.appendChild(skR);
  p1.appendChild(skWrap);

  p1.appendChild(mcgSectionTitle("Attributes"));
  const attrGrid = document.createElement("div");
  attrGrid.className = "cs-mcg-attr-grid";
  const corner = document.createElement("div");
  corner.className = "cs-mcg-attr-corner";
  attrGrid.appendChild(corner);
  for (const lab of ["Power", "Finesse", "Resilience"]) {
    const h = document.createElement("div");
    h.className = "cs-mcg-attr-colhead";
    h.textContent = lab;
    attrGrid.appendChild(h);
  }
  for (const arena of ARENA_ORDER) {
    const rn = document.createElement("div");
    rn.className = "cs-mcg-attr-arena-label";
    rn.textContent = arena;
    attrGrid.appendChild(rn);
    for (const aid of ARENAS[arena]) {
      const cell = document.createElement("div");
      cell.className = "cs-mcg-attr-cell";
      const lab = document.createElement("div");
      lab.className = "cs-mcg-attr-cell-label";
      const approach = APPROACH_FOR_ATTR[aid];
      lab.textContent = approach ? `${attrName(aid)} (${approach})` : attrName(aid);
      cell.appendChild(lab);
      cell.appendChild(dotTrack(finalA[aid] ?? 1));
      attrGrid.appendChild(cell);
    }
  }
  p1.appendChild(attrGrid);

  const p1Bot = document.createElement("div");
  p1Bot.className = "cs-mcg-p1-bottom";
  const leftCol = document.createElement("div");
  leftCol.className = "cs-mcg-p1-left";
  leftCol.appendChild(mcgSectionTitle("Legendary titles"));
  for (let i = 0; i < 6; i += 1) {
    const ln = document.createElement("div");
    ln.className = "cs-mcg-write-line";
    leftCol.appendChild(ln);
  }
  const pushCallingRow = (label, dots) => {
    const row = document.createElement("div");
    row.className = "cs-mcg-calling-line";
    const nm = document.createElement("span");
    nm.textContent = label;
    row.appendChild(nm);
    row.appendChild(dotTrack(dots));
    leftCol.appendChild(row);
  };
  /** @type {{ label: string; dots: number }[]} */
  const callingSheetRows = [];
  const slots = Array.isArray(d.callingSlots) ? d.callingSlots : [];
  for (const slot of slots) {
    if (!slot || typeof slot !== "object") continue;
    const cid = String(slot.id || "").trim();
    if (!cid) continue;
    callingSheetRows.push({
      label: bundle?.callings?.[cid]?.name || cid,
      dots: Math.max(1, Math.min(5, Math.round(Number(slot.dots) || 1))),
    });
  }
  if (callingSheetRows.length) {
    leftCol.appendChild(mcgSectionTitle("Callings"));
    for (const r of callingSheetRows) pushCallingRow(r.label, r.dots);
  }
  leftCol.appendChild(mcgLinedField("Guide", ""));
  leftCol.appendChild(mcgSectionTitle("Deeds"));
  leftCol.appendChild(mcgDeedSheetRow("Draconic", d.deedName || ""));
  leftCol.appendChild(mcgDeedSheetRow("Short-term", deeds.short));
  leftCol.appendChild(mcgDeedSheetRow("Long-term", deeds.long));
  leftCol.appendChild(mcgDeedSheetRow("Band", deeds.band));

  const rightCol = document.createElement("div");
  rightCol.className = "cs-mcg-p1-right";
  const inhStack = document.createElement("div");
  inhStack.className = "cs-mcg-track-stack";
  const inhBlock = document.createElement("div");
  inhBlock.className = "cs-mcg-legend-with-pool";
  const inhL = document.createElement("span");
  inhL.className = "cs-mcg-track-label";
  inhL.textContent = "Inheritance";
  const inhDotsCell = document.createElement("div");
  inhDotsCell.className = "cs-mcg-legend-dots-cell";
  const inhFill = Math.min(4, Math.max(0, Math.round(Number(data.inheritance) || 0)));
  const inhTrack = document.createElement("div");
  inhTrack.className = "cs-mcg-legend-pool-track";
  for (let i = 1; i <= 4; i += 1) {
    const col = document.createElement("div");
    col.className = "cs-mcg-legend-pool-col";
    const dot = document.createElement("span");
    dot.className = "cs-dot" + (i <= inhFill ? " on" : "");
    dot.setAttribute("aria-hidden", "true");
    col.appendChild(dot);
    const lab = document.createElement("label");
    lab.className = "cs-mcg-pool-check cs-mcg-pool-check--under-dot";
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.className = "cs-mcg-pool-check-input";
    lab.appendChild(inp);
    col.appendChild(lab);
    inhTrack.appendChild(col);
  }
  inhDotsCell.appendChild(inhTrack);
  inhBlock.appendChild(inhL);
  inhBlock.appendChild(inhDotsCell);
  inhStack.appendChild(inhBlock);

  const legBlock = document.createElement("div");
  legBlock.className = "cs-mcg-legend-with-pool";
  const legL = document.createElement("span");
  legL.className = "cs-mcg-track-label";
  legL.textContent = "Legend";
  const legDotsCell = document.createElement("div");
  legDotsCell.className = "cs-mcg-legend-dots-cell";
  const lv =
    data.legendRating != null && data.legendRating !== "" && !Number.isNaN(Number(data.legendRating))
      ? Number(data.legendRating)
      : 0;
  appendLegendAwarenessDotsWithPools(legDotsCell, lv, 1, "Legend", legendPoolCtx);
  legBlock.appendChild(legL);
  legBlock.appendChild(legDotsCell);
  inhStack.appendChild(legBlock);

  rightCol.appendChild(inhStack);
  rightCol.appendChild(mcgLinedField("Omen", ""));
  const remTxt =
    d.remembranceTrackCenter === false
      ? "Track: custom (center off in wizard)"
      : "Track: centered (default)";
  rightCol.appendChild(mcgLinedField("Remembrance", remTxt));

  const diceGrid = document.createElement("div");
  diceGrid.className = "cs-mcg-dice-track-grid";
  const momPersonalL = document.createElement("span");
  momPersonalL.className = "cs-mcg-track-label";
  momPersonalL.textContent = "Momentum (personal)";
  const momPersonalSq = document.createElement("span");
  momPersonalSq.className = "cs-mcg-square-track";
  for (let i = 0; i < 12; i += 1) {
    const s = document.createElement("span");
    s.className = "cs-mcg-sq";
    momPersonalSq.appendChild(s);
  }
  const momL = document.createElement("span");
  momL.className = "cs-mcg-track-label";
  momL.textContent = "Momentum (track at table)";
  const momSq = document.createElement("span");
  momSq.className = "cs-mcg-square-track";
  for (let i = 0; i < 12; i += 1) {
    const s = document.createElement("span");
    s.className = "cs-mcg-sq";
    momSq.appendChild(s);
  }
  const divL = document.createElement("span");
  divL.className = "cs-mcg-track-label";
  divL.textContent = "Divinity dice (higher tiers)";
  const divSq = document.createElement("span");
  divSq.className = "cs-mcg-square-track cs-mcg-square-track--10";
  for (let i = 0; i < 10; i += 1) {
    const s = document.createElement("span");
    s.className = "cs-mcg-sq";
    divSq.appendChild(s);
  }
  diceGrid.appendChild(momPersonalL);
  diceGrid.appendChild(momPersonalSq);
  diceGrid.appendChild(momL);
  diceGrid.appendChild(momSq);
  diceGrid.appendChild(divL);
  diceGrid.appendChild(divSq);
  rightCol.appendChild(diceGrid);

  p1Bot.appendChild(leftCol);
  p1Bot.appendChild(rightCol);
  p1.appendChild(p1Bot);

  const foot = document.createElement("footer");
  foot.className = "cs-mcg-sheet-footer";
  foot.textContent =
    "Dragon Heir sheet — same four-page layout spine as the MCG (Deity) community sheet; jade palette. Rules text lives in Scion: Dragon.";
  p1.appendChild(foot);

  /* —— Page 2 (MCG-style sheet / combat) —— */
  const p2 = page();
  p2.appendChild(mcgSectionTitle("Enhancements"));
  const enh = document.createElement("div");
  enh.className = "cs-mcg-enh-grid";
  for (let c = 0; c < 2; c += 1) {
    const tbl = document.createElement("table");
    tbl.className = "cs-mcg-mini-table";
    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    ["Enhancement", "Bonus"].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tbl.appendChild(thead);
    const tb = document.createElement("tbody");
    for (let r = 0; r < 4; r += 1) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td>";
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    enh.appendChild(tbl);
  }
  p2.appendChild(enh);

  p2.appendChild(mcgSectionTitle("Equipment"));
  const eqRows = buildEquipmentRows();
  const eqT = document.createElement("table");
  eqT.className = "cs-mcg-eq-table";
  const eqH = document.createElement("thead");
  eqH.innerHTML = "<tr><th>Item</th><th>Tags / notes</th></tr>";
  eqT.appendChild(eqH);
  const eqB = document.createElement("tbody");
  const maxEq = 7;
  for (let i = 0; i < maxEq; i += 1) {
    const tr = document.createElement("tr");
    const r = eqRows[i];
    const td1 = document.createElement("td");
    const td2 = document.createElement("td");
    if (r) {
      td1.textContent = r.title;
      td2.textContent = [r.tags, r.description].filter(Boolean).join(" — ");
    }
    tr.appendChild(td1);
    tr.appendChild(td2);
    eqB.appendChild(tr);
  }
  eqT.appendChild(eqB);
  p2.appendChild(eqT);

  p2.appendChild(mcgSectionTitle("Deed names"));
  const deedGrid = document.createElement("div");
  deedGrid.className = "cs-dragon-deed-names";
  const deedNameLines = [d.deedName, deeds.short, deeds.long, deeds.band].map((x) => String(x || "").trim());
  for (let i = 0; i < 4; i += 1) {
    const row = document.createElement("div");
    row.className = "cs-dragon-deed-name-row";
    const t = document.createElement("span");
    t.className = "cs-dragon-deed-name-text";
    t.textContent = deedNameLines[i] || "";
    row.appendChild(t);
    row.appendChild(mcgSheetTick());
    deedGrid.appendChild(row);
  }
  p2.appendChild(deedGrid);

  const p2mid = document.createElement("div");
  p2mid.className = "cs-mcg-p2-mid";
  const descCol = document.createElement("div");
  descCol.appendChild(mcgSectionTitle("Description"));
  for (const line of sheetDescriptionLinesForDisplay(data.sheetDescription)) {
    const ln = document.createElement("div");
    ln.className = "cs-mcg-write-line cs-mcg-write-line--desc";
    ln.textContent = line;
    descCol.appendChild(ln);
  }
  const combCol = document.createElement("div");
  combCol.appendChild(mcgSectionTitle("Combat"));
  combCol.appendChild(mcgLinedField("Movement", String(data.movementDice ?? "")));
  combCol.appendChild(mcgLinedField("Defense", String(data.defense ?? "")));
  combCol.appendChild(mcgLinedField("Initiative", ""));
  combCol.appendChild(mcgLinedField("Soft armor", ""));
  combCol.appendChild(mcgHardArmorRow());
  p2mid.appendChild(descCol);
  p2mid.appendChild(combCol);
  p2.appendChild(p2mid);

  p2.appendChild(mcgSectionTitle("Health"));
  const hNote = document.createElement("p");
  hNote.className = "cs-health-note";
  hNote.textContent = `Stamina (after Favored): ${healthSpec.stamina}. Bruised slots: ${healthSpec.bruisedCount}.`;
  p2.appendChild(hNote);
  const healthTrack = document.createElement("div");
  healthTrack.className = "cs-health-track";
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
      labelRow.appendChild(badge);
    }
    const box = document.createElement("div");
    box.className = "cs-health-slot-box";
    cell.appendChild(labelRow);
    cell.appendChild(box);
    healthTrack.appendChild(cell);
  }
  p2.appendChild(healthTrack);

  p2.appendChild(mcgSectionTitle("Experience"));
  p2.appendChild(mcgLinedField("Total", ""));
  p2.appendChild(mcgLinedField("Remaining", ""));
  const spent = document.createElement("div");
  spent.className = "cs-mcg-write-block";
  const sl = document.createElement("span");
  sl.className = "cs-mcg-subhead";
  sl.textContent = "Spent on";
  spent.appendChild(sl);
  for (let i = 0; i < 3; i += 1) {
    const ln = document.createElement("div");
    ln.className = "cs-mcg-write-line";
    spent.appendChild(ln);
  }
  p2.appendChild(spent);

  p2.appendChild(mcgSectionTitle("History & notes"));
  const histRaw = [data.notes, data.sheetNotesExtra].map((x) => String(x || "").trim()).filter(Boolean).join("\n\n");
  for (const line of sheetMultilineSixWriteLines(histRaw)) {
    const ln = document.createElement("div");
    ln.className = "cs-mcg-write-line cs-mcg-write-line--desc";
    ln.textContent = line;
    p2.appendChild(ln);
  }

  /* —— Page 3 — Knacks + Dragon Magic (spells) —— */
  const p3 = page();
  p3.appendChild(mcgSectionTitle("Knacks"));
  const knackRows = buildDragonKnackSheetRows();
  const nk = document.createElement("div");
  nk.className = "cs-mcg-knack-grid";
  for (let i = 0; i < 16; i += 1) {
    const blk = document.createElement("div");
    blk.className = "cs-mcg-knack-block";
    const r = knackRows[i];
    const head = document.createElement("div");
    head.className = "cs-mcg-knack-row-head";
    const t = document.createElement("span");
    t.className = "cs-mcg-knack-text";
    t.textContent = r ? r.title : "";
    head.appendChild(t);
    head.appendChild(mcgSheetTick());
    blk.appendChild(head);
    const note = document.createElement("div");
    note.className = "cs-mcg-knack-note";
    if (r) {
      const desc = (r.description || "").trim();
      const mech = (r.mechanicalEffects || "").trim();
      const bits = [desc, mech].filter(Boolean);
      note.textContent = bits.join(" ").slice(0, 320);
      const kid = String(r.knackId || "").trim();
      const kObj =
        bundle?.dragonCallingKnacks?.[kid] || bundle?.knacks?.[kid] || bundle?.dragonKnacks?.[kid] || null;
      if (kObj) applyGameDataHint(blk, kObj);
    }
    blk.appendChild(note);
    nk.appendChild(blk);
  }
  p3.appendChild(nk);

  const spellSlots = buildSpellSlots();
  if (spellSlots.length > 0) {
    p3.appendChild(mcgSectionTitle("Dragon Magic — Spells"));
    const spellStack = document.createElement("div");
    spellStack.className = "cs-dragon-spell-plate-stack";
    for (const slot of spellSlots) {
      const card = document.createElement("div");
      card.className = "cs-dragon-spell-plate-card";
      appendDragonSpellBoonStylePlate(card, slot.sp, slot.mag);
      spellStack.appendChild(card);
    }
    p3.appendChild(spellStack);
  }

  /* —— Page 4 — Conditions, Birthrights, Fatebinding (MCG tail) —— */
  const p4 = page();
  p4.appendChild(mcgSectionTitle("Conditions"));
  const cond = document.createElement("div");
  cond.className = "cs-mcg-cond-cols";
  for (let c = 0; c < 2; c += 1) {
    const col = document.createElement("div");
    for (let i = 0; i < 8; i += 1) {
      const ln = document.createElement("div");
      ln.className = "cs-mcg-write-line";
      col.appendChild(ln);
    }
    cond.appendChild(col);
  }
  p4.appendChild(cond);

  const brPicks = allBirthrightPicks();
  if (brPicks.length > 0) {
    p4.appendChild(mcgSectionTitle("Birthrights"));
    const brGrid = document.createElement("div");
    brGrid.className = "cs-mcg-br-grid";
    for (const pick of brPicks) {
      const bid = String(pick.id || "").trim();
      const br = bundle?.birthrights?.[bid];
      const blk = document.createElement("div");
      blk.className = "cs-mcg-br-block";
      const head = document.createElement("div");
      head.className = "cs-mcg-br-head";
      const nm = document.createElement("span");
      nm.textContent = br?.name || bid;
      head.appendChild(nm);
      head.appendChild(dotTrack(Math.min(5, Math.max(1, Math.round(Number(pick.dots) || 1)))));
      blk.appendChild(head);
      blk.appendChild(mcgLinedField("Type", (br?.birthrightType || "").trim()));
      const tagStr = br ? birthrightTagLabels(br, bundle).join(", ") : "";
      blk.appendChild(mcgLinedField("Tags", tagStr));
      blk.appendChild(mcgBrRuledBlock("Description", (br?.description || "").trim().slice(0, 900)));
      blk.appendChild(mcgBrRuledBlock("Mechanics", (br?.mechanicalEffects || "").trim().slice(0, 900)));
      const rd = br?.relicDetails;
      const pvHook = rd?.purviewId ? String(rd.purviewId) : "";
      blk.appendChild(
        mcgLinedField("Purview", pvHook ? purviewDisplayNameForPantheon(pvHook, bundle, "") : ""),
      );
      blk.appendChild(mcgLinedField("Motif", (rd?.motifsAndTags || "").toString().trim().slice(0, 220)));
      blk.appendChild(mcgLinedField("Enhancement", ""));
      if (br) applyGameDataHint(blk, br);
      brGrid.appendChild(blk);
    }
    p4.appendChild(brGrid);
  }

  const fbRows = nonEmptyFatebindingRowsForSheet(data.fatebindings);
  if (fbRows.length > 0) {
    p4.appendChild(mcgSectionTitle("Fatebinding"));
    const fbGrid = document.createElement("div");
    fbGrid.className = "cs-mcg-fb-grid";
    for (const fr of fbRows) {
      const blk = document.createElement("div");
      blk.className = "cs-mcg-fb-block";
      blk.appendChild(mcgLinedField("Name", fr.name));
      blk.appendChild(mcgLinedField("Strength", fr.strength));
      blk.appendChild(mcgBrRuledBlock("Story", (fr.story || "").trim().slice(0, 900)));
      blk.appendChild(mcgCheckboxRow(["Invoke", "Compel"]));
      fbGrid.appendChild(blk);
    }
    p4.appendChild(fbGrid);
  }

  p4.appendChild(mcgSectionTitle("Draconic profile"));
  const drac = document.createElement("div");
  drac.className = "cs-mcg-cond-cols";
  drac.setAttribute("aria-label", "Draconic profile — ruled lines for Feats of Scale, Transformation, and scale notes");
  for (let c = 0; c < 2; c += 1) {
    const col = document.createElement("div");
    for (let i = 0; i < 6; i += 1) {
      const ln = document.createElement("div");
      ln.className = "cs-mcg-write-line";
      col.appendChild(ln);
    }
    drac.appendChild(col);
  }
  p4.appendChild(drac);

  const fin = document.createElement("footer");
  fin.className = "cs-mcg-sheet-footer";
  fin.textContent =
    "Dragon Heir — MCG-layout four page sheet (Deity-style flow) with Heir data from the wizard. Full spell and Knack text in Scion: Dragon.";
  p4.appendChild(fin);
}
