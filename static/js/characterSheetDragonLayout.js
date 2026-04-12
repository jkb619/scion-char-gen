/**
 * Four-page Review sheet for Scion: Dragon Heir — aligned with the community “interactive”
 * Dragon four-pager (Mr. Gone / lnodiv lineage). Filled from `buildExportObject()` + `dragon` blob.
 */

import { applyGameDataHint } from "./fieldHelp.js";

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

/** Mental | Physical | Social columns; Power / Finesse / Resilience rows (Dragon sheet p.1). */
const ATTR_COLS = [
  { arena: "Mental", ids: ["intellect", "cunning", "resolve"], approaches: ["Power", "Finesse", "Resilience"] },
  { arena: "Physical", ids: ["might", "dexterity", "stamina"], approaches: ["Power", "Finesse", "Resilience"] },
  { arena: "Social", ids: ["presence", "manipulation", "composure"], approaches: ["Power", "Finesse", "Resilience"] },
];

/**
 * @param {HTMLElement} el
 * @param {{
 *   data: Record<string, unknown>;
 *   bundle: Record<string, unknown>;
 *   skillName: (id: string) => string;
 *   attrName: (id: string) => string;
 *   originHealthInjurySlots: (stamina: number) => { stamina: number; bruisedCount: number; slots: { tier: string; label: string }[] };
 * }} api
 */
export function fillDragonFourPageLayout(el, api) {
  const { data, bundle, skillName, attrName, originHealthInjurySlots } = api;
  const d = data.dragon && typeof data.dragon === "object" ? data.dragon : {};
  const finalA = /** @type {Record<string, number>} */ (data.attributesAfterFavored || {});
  const skillDots = /** @type {Record<string, number>} */ (data.skills && typeof data.skills === "object" ? data.skills : {});
  const specs = /** @type {Record<string, string>} */ (
    data.skillSpecialties && typeof data.skillSpecialties === "object" ? data.skillSpecialties : {}
  );

  function dotTrack(n) {
    const wrap = document.createElement("span");
    wrap.className = "cs-dot-track cs-dragon-dot-track";
    const v = Math.max(0, Math.min(5, Number(n) || 0));
    for (let i = 1; i <= 5; i += 1) {
      const dot = document.createElement("span");
      dot.className = "cs-dot" + (i <= v ? " on" : "");
      dot.setAttribute("aria-hidden", "true");
      wrap.appendChild(dot);
    }
    return wrap;
  }

  function remembranceTrack() {
    const wrap = document.createElement("span");
    wrap.className = "cs-dot-track cs-dragon-dot-track";
    const center = d.remembranceTrackCenter !== false;
    for (let i = 1; i <= 5; i += 1) {
      const dot = document.createElement("span");
      dot.className = "cs-dot" + (center && i === 3 ? " on" : "");
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

  function bandTitle(text) {
    const t = document.createElement("div");
    t.className = "cs-dragon-band";
    t.textContent = text;
    return t;
  }

  function lineField(label, value) {
    const w = document.createElement("div");
    w.className = "cs-dragon-line";
    const l = document.createElement("span");
    l.className = "cs-dragon-line-label";
    l.textContent = label;
    const v = document.createElement("div");
    v.className = "cs-dragon-line-value";
    v.textContent = value == null || value === "" ? "" : String(value);
    w.appendChild(l);
    w.appendChild(v);
    return w;
  }

  function checkbox() {
    const tick = document.createElement("span");
    tick.className = "cs-dragon-sheet-tick";
    tick.setAttribute("aria-hidden", "true");
    return tick;
  }

  function knackLabel(id) {
    const kid = String(id || "").trim();
    if (!kid) return "";
    return bundle?.knacks?.[kid]?.name || bundle?.dragonKnacks?.[kid]?.name || kid;
  }

  function buildKnackLines() {
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
    return ids.map((id) => knackLabel(id));
  }

  function buildEquipmentRows() {
    const out = /** @type {{ title: string; tags: string }[]} */ ([]);
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
      out.push({ title: eq.name || eid, tags });
    }
    return out;
  }

  function buildSpellRows() {
    const out = /** @type {{ name: string; effect: string }[]} */ ([]);
    const known = Array.isArray(d.knownMagics) ? d.knownMagics : [];
    const spellsBy = d.spellsByMagicId && typeof d.spellsByMagicId === "object" ? d.spellsByMagicId : {};
    for (const mid of known) {
      if (!mid) continue;
      const mag = bundle?.dragonMagic?.[mid];
      const sid = String(spellsBy[mid] || "").trim();
      const sp = Array.isArray(mag?.spells) ? mag.spells.find((x) => x && x.id === sid) : null;
      const namePart = [mag?.name || mid, sp?.name].filter(Boolean).join(" — ");
      out.push({ name: namePart, effect: String(sp?.summary || "").trim() });
    }
    const bm = String(d.bonusSpell?.magicId || "").trim();
    const bs = String(d.bonusSpell?.spellId || "").trim();
    if (bm && bs) {
      const mag = bundle?.dragonMagic?.[bm];
      const sp = Array.isArray(mag?.spells) ? mag.spells.find((x) => x && x.id === bs) : null;
      out.push({
        name: `Bonus — ${mag?.name || bm} — ${sp?.name || bs}`,
        effect: String(sp?.summary || "").trim(),
      });
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

  /* —— Page 1 —— */
  const p1 = page();
  const logo = document.createElement("div");
  logo.className = "cs-dragon-logo";
  logo.innerHTML =
    '<div class="cs-dragon-logo-scion" aria-hidden="true">Scion</div><div class="cs-dragon-logo-sub">Dragon</div>';
  p1.appendChild(logo);

  const idBlock = document.createElement("div");
  idBlock.className = "cs-dragon-id-block";
  idBlock.appendChild(lineField("Name", data.characterName));
  idBlock.appendChild(lineField("Flight / Dragon", data.flightName || data.flightId || ""));
  idBlock.appendChild(lineField("Player", ""));
  const chronicle = String(data.tierName || data.trackTierLabel || "").trim();
  idBlock.appendChild(lineField("Chronicle", chronicle));
  p1.appendChild(idBlock);

  p1.appendChild(bandTitle("Skills"));
  const skWrap = document.createElement("div");
  skWrap.className = "cs-dragon-skills-2col";
  const skL = document.createElement("div");
  const skR = document.createElement("div");
  skL.className = "cs-dragon-skill-col";
  skR.className = "cs-dragon-skill-col";
  const skillRow = (sid) => {
    const row = document.createElement("div");
    row.className = "cs-dragon-skill-row";
    row.appendChild(checkbox());
    const nm = document.createElement("span");
    nm.className = "cs-dragon-skill-name";
    nm.textContent = skillName(sid);
    row.appendChild(nm);
    const sp = document.createElement("span");
    sp.className = "cs-dragon-skill-spec";
    sp.textContent = specs[sid] || "";
    row.appendChild(sp);
    const n = Math.max(0, Math.min(5, Math.round(Number(skillDots[sid]) || 0)));
    row.appendChild(dotTrack(n));
    return row;
  };
  for (const sid of LEFT_SKILLS) skL.appendChild(skillRow(sid));
  for (const sid of RIGHT_SKILLS) skR.appendChild(skillRow(sid));
  skWrap.appendChild(skL);
  skWrap.appendChild(skR);
  p1.appendChild(skWrap);

  p1.appendChild(bandTitle("Attributes"));
  const ag = document.createElement("div");
  ag.className = "cs-dragon-attr-grid";
  const corner = document.createElement("div");
  corner.className = "cs-dragon-attr-corner";
  ag.appendChild(corner);
  for (const col of ATTR_COLS) {
    const h = document.createElement("div");
    h.className = "cs-dragon-attr-colhead";
    h.textContent = col.arena;
    ag.appendChild(h);
  }
  for (let r = 0; r < 3; r += 1) {
    const approach = document.createElement("div");
    approach.className = "cs-dragon-attr-approach";
    approach.textContent = ["Power", "Finesse", "Resilience"][r];
    ag.appendChild(approach);
    for (const col of ATTR_COLS) {
      const aid = col.ids[r];
      const cell = document.createElement("div");
      cell.className = "cs-dragon-attr-cell";
      const lab = document.createElement("div");
      lab.className = "cs-dragon-attr-cell-label";
      lab.textContent = `${attrName(aid)} (${col.approaches[r]})`;
      cell.appendChild(lab);
      cell.appendChild(dotTrack(finalA[aid] ?? 1));
      ag.appendChild(cell);
    }
  }
  p1.appendChild(ag);

  const mid = document.createElement("div");
  mid.className = "cs-dragon-p1-mid";
  const pathCol = document.createElement("div");
  pathCol.className = "cs-dragon-path-col";
  pathCol.appendChild(bandTitle("Paths / contacts"));
  const pathDefs = [
    { key: "origin", title: "Origin path" },
    { key: "role", title: "Role path" },
    { key: "flight", title: "Flight path" },
  ];
  for (const { key, title } of pathDefs) {
    const box = document.createElement("div");
    box.className = "cs-dragon-path-block";
    box.appendChild(lineField(title, paths[key] || ""));
    const skLab = document.createElement("div");
    skLab.className = "cs-dragon-subhead";
    skLab.textContent = "Skills";
    box.appendChild(skLab);
    const ids = Array.isArray(pathSkills[key]) ? pathSkills[key] : [];
    const skLine = document.createElement("div");
    skLine.className = "cs-dragon-path-skills-line";
    skLine.textContent = ids.length ? ids.map((id) => skillName(id)).join(", ") : "—";
    box.appendChild(skLine);
    box.appendChild(lineField("Contacts", ""));
    pathCol.appendChild(box);
  }
  mid.appendChild(pathCol);

  const deedsCol = document.createElement("div");
  deedsCol.className = "cs-dragon-deeds-col";
  deedsCol.appendChild(bandTitle("Deeds"));
  const deedRow = (lab, checked) => {
    const r = document.createElement("label");
    r.className = "cs-dragon-deed-row";
    const cb = checkbox();
    cb.checked = checked;
    r.appendChild(cb);
    r.appendChild(document.createTextNode(" " + lab));
    return r;
  };
  deedsCol.appendChild(deedRow("Worldly Short", Boolean(String(deeds.short || "").trim())));
  deedsCol.appendChild(deedRow("Worldly Long", Boolean(String(deeds.long || "").trim())));
  deedsCol.appendChild(deedRow("Draconic", Boolean(String(d.deedName || "").trim())));
  deedsCol.appendChild(document.createElement("div")).className = "cs-dragon-spacer";
  const remLab = document.createElement("div");
  remLab.className = "cs-dragon-subhead";
  remLab.textContent = "Remembrance";
  deedsCol.appendChild(remLab);
  deedsCol.appendChild(remembranceTrack());
  deedsCol.appendChild(bandTitle("Equipment"));
  const eqRows = buildEquipmentRows();
  const eqT = document.createElement("table");
  eqT.className = "cs-dragon-eq-table";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Item</th><th>Tags</th></tr>";
  eqT.appendChild(thead);
  const tb = document.createElement("tbody");
  for (let i = 0; i < 8; i += 1) {
    const tr = document.createElement("tr");
    const r = eqRows[i];
    const a = document.createElement("td");
    const b = document.createElement("td");
    if (r) {
      a.textContent = r.title;
      b.textContent = r.tags;
    }
    tr.appendChild(a);
    tr.appendChild(b);
    tb.appendChild(tr);
  }
  eqT.appendChild(tb);
  deedsCol.appendChild(eqT);
  mid.appendChild(deedsCol);
  p1.appendChild(mid);

  const bot = document.createElement("div");
  bot.className = "cs-dragon-p1-bot";
  const inhCol = document.createElement("div");
  inhCol.className = "cs-dragon-bot-col";
  inhCol.appendChild(bandTitle("Inheritance"));
  const inhNote = document.createElement("div");
  inhNote.className = "cs-dragon-inh-note";
  inhNote.textContent = [
    data.inheritance != null ? `Track: ${data.inheritance}` : "",
    data.inheritanceMilestone ? String(data.inheritanceMilestone) : "",
    data.inheritanceBand ? `(${String(data.inheritanceBand)})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  inhCol.appendChild(inhNote);
  const inhStacks = document.createElement("div");
  inhStacks.className = "cs-dragon-inh-stacks";
  const inhFill = Math.min(4, Math.max(0, Math.round(Number(data.inheritance) || 0)));
  for (let i = 0; i < 4; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cs-dragon-inh-stack";
    const dot = document.createElement("span");
    dot.className = "cs-dot" + (i < inhFill ? " on" : "");
    dot.setAttribute("aria-hidden", "true");
    cell.appendChild(dot);
    cell.appendChild(checkbox());
    inhStacks.appendChild(cell);
  }
  inhCol.appendChild(inhStacks);
  inhCol.appendChild(bandTitle("Callings"));
  const slots = Array.isArray(d.callingSlots) ? d.callingSlots : [];
  for (let i = 0; i < 3; i += 1) {
    const row = document.createElement("div");
    row.className = "cs-dragon-calling-row";
    const slot = slots[i];
    const nm = document.createElement("span");
    const cid = String(slot?.id || "").trim();
    nm.textContent = cid ? bundle?.callings?.[cid]?.name || cid : "—";
    row.appendChild(nm);
    row.appendChild(dotTrack(Math.max(1, Math.min(5, Math.round(Number(slot?.dots) || 1)))));
    inhCol.appendChild(row);
  }
  bot.appendChild(inhCol);

  const midBot = document.createElement("div");
  midBot.className = "cs-dragon-bot-col";
  midBot.appendChild(bandTitle("Momentum"));
  const mom = document.createElement("div");
  mom.className = "cs-dragon-square-row";
  for (let i = 0; i < 10; i += 1) {
    const s = document.createElement("span");
    s.className = "cs-dragon-sq";
    mom.appendChild(s);
  }
  midBot.appendChild(mom);
  midBot.appendChild(bandTitle("Experience"));
  midBot.appendChild(lineField("Total", ""));
  midBot.appendChild(lineField("Spent", ""));
  midBot.appendChild(lineField("Remaining", ""));
  const spent = document.createElement("div");
  spent.className = "cs-dragon-spent-on";
  const sl = document.createElement("div");
  sl.className = "cs-dragon-subhead";
  sl.textContent = "Spent on";
  spent.appendChild(sl);
  for (let i = 0; i < 4; i += 1) {
    const ln = document.createElement("div");
    ln.className = "cs-dragon-write-line";
    spent.appendChild(ln);
  }
  midBot.appendChild(spent);
  bot.appendChild(midBot);

  const healthCol = document.createElement("div");
  healthCol.className = "cs-dragon-bot-col";
  healthCol.appendChild(bandTitle("Health"));
  const hNote = document.createElement("p");
  hNote.className = "cs-health-note";
  hNote.textContent = `Stamina (after Favored): ${healthSpec.stamina}. Bruised slots: ${healthSpec.bruisedCount}.`;
  healthCol.appendChild(hNote);
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
  healthCol.appendChild(healthTrack);
  healthCol.appendChild(lineField("Movement dice", String(data.movementDice ?? "")));
  healthCol.appendChild(lineField("Defense roll", String(data.defense ?? "")));
  healthCol.appendChild(lineField("Initiative roll", ""));
  bot.appendChild(healthCol);
  p1.appendChild(bot);

  const foot = document.createElement("footer");
  foot.className = "cs-dragon-footer-legend";
  foot.textContent = "c — Complication · d — Difficulty · e — Enhancement";
  p1.appendChild(foot);

  /* —— Page 2 —— */
  const p2 = page();
  p2.appendChild(bandTitle("Deed names"));
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
    row.appendChild(checkbox());
    deedGrid.appendChild(row);
  }
  p2.appendChild(deedGrid);

  p2.appendChild(bandTitle("Birthrights"));
  const brGrid = document.createElement("div");
  brGrid.className = "cs-dragon-br-grid";
  for (const pick of allBirthrightPicks()) {
    const bid = String(pick.id || "").trim();
    const br = bundle?.birthrights?.[bid];
    const blk = document.createElement("div");
    blk.className = "cs-dragon-br-block";
    const head = document.createElement("div");
    head.className = "cs-dragon-br-head";
    const nm = document.createElement("span");
    nm.textContent = br?.name || bid;
    head.appendChild(nm);
    head.appendChild(dotTrack(Math.min(5, Math.max(1, Math.round(Number(pick.dots) || 1)))));
    blk.appendChild(head);
    const descLab = document.createElement("div");
    descLab.className = "cs-dragon-br-desc-label";
    descLab.textContent = "Description:";
    blk.appendChild(descLab);
    const desc = document.createElement("div");
    desc.className = "cs-dragon-br-desc";
    desc.textContent = String(br?.description || br?.mechanicalEffects || "").trim().slice(0, 600);
    blk.appendChild(desc);
    for (let j = 0; j < 4; j += 1) {
      const ln = document.createElement("div");
      ln.className = "cs-dragon-write-line";
      blk.appendChild(ln);
    }
    if (br) applyGameDataHint(blk, br);
    brGrid.appendChild(blk);
  }
  while (brGrid.children.length < 8) {
    const blk = document.createElement("div");
    blk.className = "cs-dragon-br-block";
    const head = document.createElement("div");
    head.className = "cs-dragon-br-head";
    head.appendChild(document.createElement("span"));
    head.appendChild(dotTrack(0));
    blk.appendChild(head);
    const dl = document.createElement("div");
    dl.className = "cs-dragon-br-desc-label";
    dl.textContent = "Description:";
    blk.appendChild(dl);
    const emptyDesc = document.createElement("div");
    emptyDesc.className = "cs-dragon-br-desc";
    blk.appendChild(emptyDesc);
    for (let j = 0; j < 4; j += 1) {
      const ln = document.createElement("div");
      ln.className = "cs-dragon-write-line";
      blk.appendChild(ln);
    }
    brGrid.appendChild(blk);
  }
  p2.appendChild(brGrid);

  /* —— Page 3 —— */
  const p3 = page();
  p3.appendChild(bandTitle("Knacks"));
  const knackLines = buildKnackLines();
  const rowsPerCol = 38;
  const nk = document.createElement("div");
  nk.className = "cs-dragon-knack-cols";
  for (let c = 0; c < 2; c += 1) {
    const col = document.createElement("div");
    col.className = "cs-dragon-knack-col";
    for (let r = 0; r < rowsPerCol; r += 1) {
      const line = document.createElement("div");
      line.className = "cs-dragon-knack-line";
      line.textContent = knackLines[c * rowsPerCol + r] || "";
      col.appendChild(line);
    }
    nk.appendChild(col);
  }
  p3.appendChild(nk);

  p3.appendChild(bandTitle("Spells / magic"));
  const spellRows = buildSpellRows();
  const spT = document.createElement("table");
  spT.className = "cs-dragon-spell-table";
  const spHead = document.createElement("thead");
  spHead.innerHTML = "<tr><th>Name</th><th>Effect</th></tr>";
  spT.appendChild(spHead);
  const spB = document.createElement("tbody");
  const maxSpells = 11;
  for (let i = 0; i < maxSpells; i += 1) {
    const tr = document.createElement("tr");
    const sr = spellRows[i];
    const a = document.createElement("td");
    const b = document.createElement("td");
    a.className = "cs-dragon-spell-name";
    b.className = "cs-dragon-spell-effect";
    if (sr) {
      a.textContent = sr.name;
      b.textContent = sr.effect;
    }
    tr.appendChild(a);
    tr.appendChild(b);
    spB.appendChild(tr);
  }
  spT.appendChild(spB);
  p3.appendChild(spT);

  /* —— Page 4 —— */
  const p4 = page();
  p4.appendChild(bandTitle("History"));
  const hist = document.createElement("div");
  hist.className = "cs-dragon-history";
  hist.textContent = [data.notes, data.sheetNotesExtra].map((x) => String(x || "").trim()).filter(Boolean).join("\n\n");
  p4.appendChild(hist);

  p4.appendChild(bandTitle("Description"));
  const descWrap = document.createElement("div");
  descWrap.className = "cs-dragon-desc-block";
  for (const lab of [
    "Age",
    "Date of birth",
    "Hair",
    "Eyes",
    "Race",
    "Nationality",
    "Height",
    "Weight",
    "Pronoun",
  ]) {
    descWrap.appendChild(lineField(lab, ""));
  }
  p4.appendChild(descWrap);

  p4.appendChild(bandTitle("Draconic form"));
  const drac = document.createElement("div");
  drac.className = "cs-dragon-draconic";
  const dHelp = document.createElement("div");
  dHelp.className = "cs-dragon-help";
  dHelp.textContent =
    "Use for scale, Feats of Scale, Transformation, and other draconic profile notes (Dragon).";
  drac.appendChild(dHelp);
  for (let i = 0; i < 15; i += 1) {
    const ln = document.createElement("div");
    ln.className = "cs-dragon-write-line";
    drac.appendChild(ln);
  }
  p4.appendChild(drac);

  const fate = String(data.fatebindings || "").trim();
  if (fate) {
    p4.appendChild(bandTitle("Notes (export)"));
    const fx = document.createElement("div");
    fx.className = "cs-dragon-fate";
    fx.textContent = fate;
    p4.appendChild(fx);
  }

  const fin = document.createElement("footer");
  fin.className = "cs-dragon-sheet-footer";
  fin.textContent =
    "Layout: four-page Scion: Dragon community sheet style. Rules and full spell text live in Scion: Dragon; this view summarizes wizard data.";
  p4.appendChild(fin);
}
