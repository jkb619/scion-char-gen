/**
 * Four-page Review sheet layout aligned with the common Scion 2e / Storypath
 * "interactive" four-page character sheet (Mr. Gone / lnodiv lineage — community layout).
 * Filled from `buildExportObject()`; empty lines remain for table play where the app has no field.
 */

/**
 * @param {HTMLElement} el — root `.character-sheet`
 * @param {object} api — helpers and data from `buildCharacterSheet`
 */
export function fillMcgFourPageLayout(el, api) {
  const {
    data,
    bundle,
    tierName,
    tierAka,
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
    legendDotTrackReadOnly,
    awarenessDotTrackReadOnly,
    buildVirtueSpectrumElement,
    buildKnackSheetRows,
    buildBoonSheetRows,
    buildEquipmentSheetRows,
    purviewDisplayNameForPantheon,
    purviewInnateBlocks,
    boonDisplayLabel,
    boonIsPurviewInnateAutomaticGrant,
    applyGameDataHint,
  } = api;

  const charName = String(data.characterName ?? "").trim();

  function page() {
    const p = document.createElement("div");
    p.className = "cs-page cs-page--mcg";
    el.appendChild(p);
    return p;
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
    r.className = "cs-mcg-check-row";
    for (const lab of labels) {
      const x = document.createElement("label");
      x.className = "cs-mcg-check";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.disabled = true;
      cb.setAttribute("aria-hidden", "true");
      x.appendChild(cb);
      x.appendChild(document.createTextNode(" " + lab));
      r.appendChild(x);
    }
    return r;
  }

  /** @param {"origin"|"role"|"society"} key */
  function pathColumn(key) {
    const col = document.createElement("div");
    col.className = "cs-mcg-path-col";
    const head = document.createElement("div");
    head.className = "cs-mcg-path-head";
    head.textContent = key === "society" ? "Pantheon path" : `${key.charAt(0).toUpperCase()}${key.slice(1)} path`;
    col.appendChild(head);
    col.appendChild(mcgLinedField("Path", (data.paths && data.paths[key]) || ""));
    const skLab = document.createElement("div");
    skLab.className = "cs-mcg-subhead";
    skLab.textContent = "Skills";
    col.appendChild(skLab);
    const ul = document.createElement("ul");
    ul.className = "cs-mcg-path-skills";
    const ids = Array.isArray(data.pathSkills?.[key]) ? data.pathSkills[key] : [];
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

  function skillRow(sid) {
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

  const arenaOrder = ["Mental", "Physical", "Social"];
  const ARENAS = {
    Mental: ["intellect", "cunning", "resolve"],
    Physical: ["might", "dexterity", "stamina"],
    Social: ["presence", "manipulation", "composure"],
  };
  const approachRow = { might: "Power", dexterity: "Finesse", stamina: "Resilience" };

  /* —— Page 1 —— */
  const p1 = page();
  const top = document.createElement("div");
  top.className = "cs-mcg-p1-top";
  const rowA = document.createElement("div");
  rowA.className = "cs-mcg-header-rows";
  rowA.appendChild(mcgLinedField("Name", charName || "—"));
  rowA.appendChild(mcgLinedField("Player", ""));
  rowA.appendChild(mcgLinedField("Patron", data.parentDeity || "—"));
  const rowB = document.createElement("div");
  rowB.className = "cs-mcg-header-rows";
  rowB.appendChild(mcgLinedField("Concept", data.concept || "—"));
  rowB.appendChild(mcgLinedField("Chronicle", (tierAka ? `${tierName} — ${tierAka}` : tierName) || tid || ""));
  rowB.appendChild(mcgLinedField("Pantheon", data.pantheon || "—"));
  top.appendChild(rowA);
  top.appendChild(rowB);
  p1.appendChild(top);

  p1.appendChild(mcgSectionTitle("Paths"));
  const pathsRow = document.createElement("div");
  pathsRow.className = "cs-mcg-paths-3";
  pathsRow.appendChild(pathColumn("origin"));
  pathsRow.appendChild(pathColumn("role"));
  pathsRow.appendChild(pathColumn("society"));
  p1.appendChild(pathsRow);

  const pr = data.pathPriority || {};
  const prio = document.createElement("p");
  prio.className = "cs-mcg-path-priority";
  prio.textContent = `Path priority — Primary: ${pr.primary || "—"} · Secondary: ${pr.secondary || "—"} · Tertiary: ${pr.tertiary || "—"}`;
  p1.appendChild(prio);

  p1.appendChild(mcgSectionTitle("Skills"));
  const skWrap = document.createElement("div");
  skWrap.className = "cs-mcg-skills-2col";
  const skL = document.createElement("div");
  skL.className = "cs-mcg-skill-col";
  const skR = document.createElement("div");
  skR.className = "cs-mcg-skill-col";
  for (const sid of LEFT_SKILLS) skL.appendChild(skillRow(sid));
  for (const sid of RIGHT_SKILLS) skR.appendChild(skillRow(sid));
  skWrap.appendChild(skL);
  skWrap.appendChild(skR);
  p1.appendChild(skWrap);

  p1.appendChild(mcgSectionTitle("Attributes"));
  const attrGrid = document.createElement("div");
  attrGrid.className = "cs-mcg-attr-grid";
  const corner = document.createElement("div");
  corner.className = "cs-mcg-attr-corner";
  attrGrid.appendChild(corner);
  const hPow = document.createElement("div");
  hPow.className = "cs-mcg-attr-colhead";
  hPow.textContent = "Power";
  const hFin = document.createElement("div");
  hFin.className = "cs-mcg-attr-colhead";
  hFin.textContent = "Finesse";
  const hRes = document.createElement("div");
  hRes.className = "cs-mcg-attr-colhead";
  hRes.textContent = "Resilience";
  attrGrid.appendChild(hPow);
  attrGrid.appendChild(hFin);
  attrGrid.appendChild(hRes);
  for (const arena of arenaOrder) {
    const rn = document.createElement("div");
    rn.className = "cs-mcg-attr-arena-label";
    rn.textContent = arena;
    attrGrid.appendChild(rn);
    for (const aid of ARENAS[arena]) {
      const cell = document.createElement("div");
      cell.className = "cs-mcg-attr-cell";
      const lab = document.createElement("div");
      lab.className = "cs-mcg-attr-cell-label";
      const approach = approachRow[aid];
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
  leftCol.appendChild(mcgSectionTitle("Callings"));
  const slotRows = Array.isArray(data.callingSlots) ? data.callingSlots.filter((s) => s && typeof s === "object") : [];
  const pushCallingRow = (label, dots) => {
    const row = document.createElement("div");
    row.className = "cs-mcg-calling-line";
    const nm = document.createElement("span");
    nm.textContent = label;
    row.appendChild(nm);
    row.appendChild(dotTrack(dots));
    leftCol.appendChild(row);
  };
  if (slotRows.length) {
    for (let i = 0; i < 3; i += 1) {
      const slot = slotRows[i];
      if (slot) {
        const cid = String(slot.id || "").trim();
        const label = cid ? bundle?.callings?.[cid]?.name || cid : "—";
        pushCallingRow(label, Math.max(1, Math.min(5, Math.round(Number(slot.dots) || 1))));
      } else {
        pushCallingRow("—", 1);
      }
    }
  } else {
    pushCallingRow(data.calling || "—", Math.max(1, Math.min(5, Math.round(Number(data.callingDots) || 1))));
    pushCallingRow("—", 1);
    pushCallingRow("—", 1);
  }
  leftCol.appendChild(mcgLinedField("Guide", ""));
  leftCol.appendChild(mcgSectionTitle("Deeds"));
  leftCol.appendChild(mcgCheckboxRow(["Short-term", "Long-term", "Band", "Mythos"]));
  const deedNote = document.createElement("div");
  deedNote.className = "cs-mcg-deed-note";
  const d = data.deeds || {};
  deedNote.textContent = [d.short, d.long, d.band].filter(Boolean).join(" · ") || "—";
  leftCol.appendChild(deedNote);

  const rightCol = document.createElement("div");
  rightCol.className = "cs-mcg-p1-right";
  const legRow = document.createElement("div");
  legRow.className = "cs-mcg-track-block";
  const legL = document.createElement("span");
  legL.className = "cs-mcg-track-label";
  legL.textContent = "Legend";
  const lv =
    data.legendRating != null && data.legendRating !== "" && !Number.isNaN(Number(data.legendRating))
      ? Number(data.legendRating)
      : 0;
  legRow.appendChild(legL);
  legRow.appendChild(legendDotTrackReadOnly(lv, legendMax));
  rightCol.appendChild(legRow);
  rightCol.appendChild(mcgLinedField("Omen", ""));
  const virt = buildVirtueSpectrumElement(
    { pantheonId: data.pantheonId, virtueSpectrum: data.virtueSpectrum },
    bundle,
    false,
  );
  if (virt) rightCol.appendChild(virt);
  if (String(data.pantheonId || "").trim() === "mythos") {
    const awRow = document.createElement("div");
    awRow.className = "cs-mcg-track-block";
    const awL = document.createElement("span");
    awL.className = "cs-mcg-track-label";
    awL.textContent = "Awareness";
    const awRaw = data.awarenessRating;
    const av = awRaw != null && awRaw !== "" && !Number.isNaN(Number(awRaw)) ? Number(awRaw) : 1;
    awRow.appendChild(awL);
    awRow.appendChild(awarenessDotTrackReadOnly(av));
    rightCol.appendChild(awRow);
  }
  const mom = document.createElement("div");
  mom.className = "cs-mcg-track-block";
  const momL = document.createElement("span");
  momL.className = "cs-mcg-track-label";
  momL.textContent = "Momentum (track at table)";
  mom.appendChild(momL);
  const momSq = document.createElement("span");
  momSq.className = "cs-mcg-square-track";
  for (let i = 0; i < 12; i += 1) {
    const s = document.createElement("span");
    s.className = "cs-mcg-sq";
    momSq.appendChild(s);
  }
  mom.appendChild(momSq);
  rightCol.appendChild(mom);
  const divn = document.createElement("div");
  divn.className = "cs-mcg-track-block";
  const divL = document.createElement("span");
  divL.className = "cs-mcg-track-label";
  divL.textContent = "Divinity dice (higher tiers)";
  divn.appendChild(divL);
  const divSq = document.createElement("span");
  divSq.className = "cs-mcg-square-track cs-mcg-square-track--10";
  for (let i = 0; i < 10; i += 1) {
    const s = document.createElement("span");
    s.className = "cs-mcg-sq";
    divSq.appendChild(s);
  }
  divn.appendChild(divSq);
  rightCol.appendChild(divn);

  p1Bot.appendChild(leftCol);
  p1Bot.appendChild(rightCol);
  p1.appendChild(p1Bot);

  const foot = document.createElement("footer");
  foot.className = "cs-mcg-sheet-footer";
  foot.textContent =
    "Layout: four-page Scion 2e / Storypath community sheet style (e.g. Mr. Gone / lnodiv). Rules text lives in your books; this view summarizes wizard data only.";
  p1.appendChild(foot);

  /* —— Page 2 —— */
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
  const eqRows = buildEquipmentSheetRows();
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
      td2.textContent = r.description || r.source || "";
    }
    tr.appendChild(td1);
    tr.appendChild(td2);
    eqB.appendChild(tr);
  }
  eqT.appendChild(eqB);
  p2.appendChild(eqT);

  const p2mid = document.createElement("div");
  p2mid.className = "cs-mcg-p2-mid";
  const descCol = document.createElement("div");
  descCol.appendChild(mcgSectionTitle("Description"));
  for (const lab of ["Age", "Date of birth", "Hair", "Eyes", "Height", "Weight", "Race / kin", "Nationality", "Gender"]) {
    descCol.appendChild(mcgLinedField(lab, ""));
  }
  const combCol = document.createElement("div");
  combCol.appendChild(mcgSectionTitle("Combat"));
  combCol.appendChild(mcgLinedField("Movement", String(moveDice)));
  combCol.appendChild(mcgLinedField("Defense", String(defRating)));
  combCol.appendChild(mcgLinedField("Initiative", ""));
  combCol.appendChild(mcgLinedField("Soft armor", ""));
  combCol.appendChild(mcgCheckboxRow(["Hard armor", "Hard armor"]));
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
  const injuryPenalty = { bruised: "+1d", injured: "+2d", maimed: "+4d" };
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
  const hist = document.createElement("div");
  hist.className = "cs-mcg-history";
  hist.textContent = (data.sheetNotesExtra || data.notes || "").trim() || "";
  p2.appendChild(hist);

  /* —— Page 3 —— */
  const p3 = page();
  p3.appendChild(mcgSectionTitle("Knacks"));
  const knackRows = buildKnackSheetRows();
  const nk = document.createElement("div");
  nk.className = "cs-mcg-knack-grid";
  for (let i = 0; i < 16; i += 1) {
    const row = document.createElement("div");
    row.className = "cs-mcg-knack-row";
    const r = knackRows[i];
    const t = document.createElement("span");
    t.className = "cs-mcg-knack-text";
    t.textContent = r ? r.title : "";
    row.appendChild(t);
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.disabled = true;
    row.appendChild(cb);
    nk.appendChild(row);
  }
  p3.appendChild(nk);

  p3.appendChild(mcgSectionTitle("Purviews"));
  const pvWrap = document.createElement("div");
  pvWrap.className = "cs-mcg-purview-grid";
  const purIds = (data.purviews || []).filter(Boolean);
  const nameFor = (pid) => purviewDisplayNameForPantheon(pid, bundle, data.pantheonId);
  const mythosSheet = String(data.pantheonId || "").trim() === "mythos";
  const titanicSheet = tierKeyNorm === "titanic";
  for (let i = 0; i < 6; i += 1) {
    const blk = document.createElement("div");
    blk.className = "cs-mcg-purview-block";
    const pid = purIds[i];
    blk.appendChild(mcgLinedField("Name", pid ? nameFor(pid) : ""));
    blk.appendChild(mcgLinedField("Source", pid ? (bundle.purviews?.[pid]?.source || "").trim().slice(0, 120) : ""));
    blk.appendChild(mcgCheckboxRow(["Dominion"]));
    const inn = document.createElement("div");
    inn.className = "cs-mcg-innate";
    if (pid) {
      const blocks = purviewInnateBlocks(bundle, pid, { mythosPantheon: mythosSheet, titanicTier: titanicSheet });
      inn.textContent = blocks.map((b) => `${b.label}: ${b.body}`).join("\n");
    }
    blk.appendChild(inn);
    pvWrap.appendChild(blk);
  }
  p3.appendChild(pvWrap);

  p3.appendChild(mcgSectionTitle("Boons"));
  const boonWrap = document.createElement("div");
  boonWrap.className = "cs-mcg-boon-grid";
  const boonIds = (data.boons || []).filter(Boolean);
  let bi = 0;
  for (const bid of boonIds) {
    if (bi >= 12) break;
    const bb = bundle.boons?.[bid];
    if (bb && boonIsPurviewInnateAutomaticGrant(bb, bundle)) continue;
    const blk = document.createElement("div");
    blk.className = "cs-mcg-boon-block";
    const title = bb ? boonDisplayLabel(bb, bundle, data.pantheonId) : String(bid);
    blk.appendChild(mcgLinedField("Name", title));
    const pvId = bb?.purviewId ? String(bb.purviewId) : "";
    blk.appendChild(mcgLinedField("Purview", pvId ? purviewDisplayNameForPantheon(pvId, bundle, data.pantheonId) : ""));
    blk.appendChild(mcgLinedField("Cost", bb?.cost != null ? String(bb.cost) : ""));
    blk.appendChild(mcgLinedField("Duration", (bb?.duration || "").trim()));
    blk.appendChild(mcgLinedField("Subject", ""));
    const row2 = document.createElement("div");
    row2.className = "cs-mcg-boon-mini-row";
    row2.appendChild(mcgLinedField("Range", (bb?.range || "").trim()));
    row2.appendChild(mcgLinedField("Action", (bb?.action || "").trim()));
    blk.appendChild(row2);
    const note = document.createElement("div");
    note.className = "cs-mcg-boon-note";
    note.textContent = (bb?.description || "").trim().slice(0, 220);
    blk.appendChild(note);
    if (bb) applyGameDataHint(blk, bb);
    boonWrap.appendChild(blk);
    bi += 1;
  }
  while (boonWrap.children.length < 12) {
    const blk = document.createElement("div");
    blk.className = "cs-mcg-boon-block";
    blk.appendChild(mcgLinedField("Name", ""));
    blk.appendChild(mcgLinedField("Purview", ""));
    blk.appendChild(mcgLinedField("Cost", ""));
    blk.appendChild(mcgLinedField("Duration", ""));
    blk.appendChild(mcgLinedField("Subject", ""));
    const row2 = document.createElement("div");
    row2.className = "cs-mcg-boon-mini-row";
    row2.appendChild(mcgLinedField("Range", ""));
    row2.appendChild(mcgLinedField("Action", ""));
    blk.appendChild(row2);
    const emptyNote = document.createElement("div");
    emptyNote.className = "cs-mcg-boon-note";
    blk.appendChild(emptyNote);
    boonWrap.appendChild(blk);
  }
  p3.appendChild(boonWrap);

  /* —— Page 4 —— */
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

  p4.appendChild(mcgSectionTitle("Birthrights"));
  const brIds = (data.finishing?.birthrightPicks || []).filter(Boolean);
  const brGrid = document.createElement("div");
  brGrid.className = "cs-mcg-br-grid";
  for (let i = 0; i < 8; i += 1) {
    const bid = brIds[i];
    const br = bid ? bundle.birthrights?.[bid] : null;
    const blk = document.createElement("div");
    blk.className = "cs-mcg-br-block";
    const head = document.createElement("div");
    head.className = "cs-mcg-br-head";
    const nm = document.createElement("span");
    nm.textContent = br?.name || bid || "";
    head.appendChild(nm);
    head.appendChild(dotTrack(br?.pointCost != null ? Math.min(5, Math.max(1, Math.round(Number(br.pointCost)))) : 1));
    blk.appendChild(head);
    blk.appendChild(mcgLinedField("Type", (br?.birthrightType || "").trim()));
    blk.appendChild(mcgLinedField("En", ""));
    const rd = br?.relicDetails;
    const pvHook = rd?.purviewId ? String(rd.purviewId) : "";
    blk.appendChild(
      mcgLinedField(
        "Purview",
        pvHook ? purviewDisplayNameForPantheon(pvHook, bundle, data.pantheonId) : "",
      ),
    );
    blk.appendChild(mcgLinedField("Motif", (rd?.motifsAndTags || br?.mechanicalEffects || "").toString().trim().slice(0, 160)));
    blk.appendChild(mcgLinedField("Tags", ""));
    for (let j = 0; j < 2; j += 1) {
      const ln = document.createElement("div");
      ln.className = "cs-mcg-write-line";
      blk.appendChild(ln);
    }
    if (br) applyGameDataHint(blk, br);
    brGrid.appendChild(blk);
  }
  p4.appendChild(brGrid);

  p4.appendChild(mcgSectionTitle("Fatebinding"));
  const fbLines = String(data.fatebindings || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const fbGrid = document.createElement("div");
  fbGrid.className = "cs-mcg-fb-grid";
  for (let i = 0; i < 14; i += 1) {
    const blk = document.createElement("div");
    blk.className = "cs-mcg-fb-block";
    blk.appendChild(mcgLinedField("Name", fbLines[i] || ""));
    blk.appendChild(mcgLinedField("Strength", ""));
    blk.appendChild(mcgCheckboxRow(["Invoke", "Compel"]));
    fbGrid.appendChild(blk);
  }
  p4.appendChild(fbGrid);

  const fin = data.finishing || {};
  const finBits = [];
  if (fin.extraSkillDots != null && fin.extraSkillDots !== "")
    finBits.push(`Extra skill dots (budget): ${fin.extraSkillDots}`);
  if (fin.extraAttributeDots != null && fin.extraAttributeDots !== "")
    finBits.push(`Extra attribute dots (budget): ${fin.extraAttributeDots}`);
  finBits.push(
    `Focus: ${fin.knackOrBirthright === "birthrights" ? "Birthright points" : "Extra Knacks"}`,
  );
  if (Array.isArray(fin.finishingKnacksNamed) && fin.finishingKnacksNamed.length) {
    finBits.push(`Finishing knacks: ${fin.finishingKnacksNamed.join("; ")}`);
  }
  if (Array.isArray(fin.birthrightsNamed) && fin.birthrightsNamed.length) {
    finBits.push(`Birthrights: ${fin.birthrightsNamed.join("; ")}`);
  }
  if (data.heroBirthrightDotsUnusedFromSeven != null) {
    finBits.push(`Hero Birthright points unused (of 7): ${data.heroBirthrightDotsUnusedFromSeven}`);
  }
  if (finBits.length) {
    const fx = document.createElement("div");
    fx.className = "cs-mcg-finishing-strip";
    fx.textContent = finBits.join(" · ");
    p4.appendChild(fx);
  }
}
