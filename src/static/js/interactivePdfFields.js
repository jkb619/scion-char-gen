/**
 * Build AcroForm field maps for the local community “interactive” PDFs
 * (Scion_2ndED_Complete_4-Page_Interactive.pdf / Scion_2ndED_Dragon_4-Page_Interactive.pdf).
 * Server applies these via POST /api/export/interactive-pdf.
 */

import { apiUrl } from "./apiBase.js";
import { boonTrackedMechanicalFields } from "./boonMechanicalParse.js";
import { boonDisplayLabel } from "./boonLabels.js";
import { boonIsPurviewInnateAutomaticGrant } from "./eligibility.js";
import { mergedPurviewIdsForSheet, purviewDisplayNameForPantheon } from "./purviewDisplayName.js";
import { applyFatebindingsToInteractivePdfFields } from "./fatebindingsSheet.js";

/** @param {Record<string, unknown> | null | undefined} sp */
function dragonSpellPdfEffectLine(sp) {
  if (!sp || typeof sp !== "object") return "";
  const t = boonTrackedMechanicalFields(sp);
  const bits = [];
  const summ = String(sp.summary || "").trim();
  if (summ) bits.push(`Summary: ${summ}`);
  if (t.cost) bits.push(`Cost: ${t.cost}`);
  if (t.duration) bits.push(`Duration: ${t.duration}`);
  if (t.subject) bits.push(`Target: ${t.subject}`);
  if (t.range) bits.push(`Range: ${t.range}`);
  if (t.action) bits.push(`Action: ${t.action}`);
  if (t.clash) bits.push(`Clash: ${t.clash}`);
  return bits.join(" · ").slice(0, 480);
}

const SKILL_ROW_IDS = [
  "academics",
  "athletics",
  "closeCombat",
  "culture",
  "empathy",
  "firearms",
  "integrity",
  "leadership",
  "medicine",
  "occult",
  "persuasion",
  "pilot",
  "science",
  "subterfuge",
  "survival",
  "technology",
];

/** Mental / Physical / Social × Power,Finesse,Resilience (matches interactive sheet attribute grid). */
const ATTR_PDF_ORDER = [
  "intellect",
  "cunning",
  "resolve",
  "might",
  "dexterity",
  "stamina",
  "presence",
  "manipulation",
  "composure",
];

/**
 * @param {string} text
 * @param {string[]} fieldKeys
 * @param {Record<string, string | boolean>} out
 */
function packLinesIntoFields(text, fieldKeys, out) {
  const lines = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  let li = 0;
  for (const key of fieldKeys) {
    if (li >= lines.length) break;
    out[key] = lines[li];
    li += 1;
  }
}

/**
 * @param {Record<string, unknown>} data
 * @param {Record<string, unknown>} bundle
 * @returns {Record<string, string | boolean>}
 */
export function buildScionInteractivePdfFields(data, bundle) {
  /** @type {Record<string, string | boolean>} */
  const f = {};
  const skills = data.skills && typeof data.skills === "object" ? data.skills : {};
  const specs = data.skillSpecialties && typeof data.skillSpecialties === "object" ? data.skillSpecialties : {};
  const finalA = data.attributesAfterFavored && typeof data.attributesAfterFavored === "object" ? data.attributesAfterFavored : {};
  const paths = data.paths && typeof data.paths === "object" ? data.paths : {};
  const ps = data.pathSkills && typeof data.pathSkills === "object" ? data.pathSkills : {};
  const skillName = (id) => (bundle.skills && bundle.skills[id] ? bundle.skills[id].name : id) || id;

  f.name = String(data.characterName ?? "").trim();
  f.player = "";
  f.patron = String(data.parentDeity ?? "").trim();
  f.concept = String(data.concept ?? "").trim();
  f.chronicle = String(data.tierName || "").trim();
  f.pantheon = String(data.pantheon ?? "").trim();

  const pr = data.pathPriority || data.pathRank || {};
  f.paths1 = String(paths.origin ?? "").trim();
  f.paths2 = (Array.isArray(ps.origin) ? ps.origin : []).map((id) => skillName(id)).join(", ");
  f.paths3 = "";
  f.paths4 = `Priority: ${pr.primary || "—"} · ${pr.secondary || "—"} · ${pr.tertiary || "—"}`;
  f.paths5 = String(paths.role ?? "").trim();
  f.paths6 = (Array.isArray(ps.role) ? ps.role : []).map((id) => skillName(id)).join(", ");
  f.paths7 = "";
  f.paths8 = "";
  f.paths9 = String(paths.society ?? "").trim();
  f.paths10 = (Array.isArray(ps.society) ? ps.society : []).map((id) => skillName(id)).join(", ");
  f.paths11 = "";
  f.paths12 = "";

  for (let i = 0; i < SKILL_ROW_IDS.length; i += 1) {
    const sid = SKILL_ROW_IDS[i];
    f[`skills${i + 1}`] = String(specs[sid] ?? "").trim();
  }

  for (let i = 0; i < ATTR_PDF_ORDER.length; i += 1) {
    const aid = ATTR_PDF_ORDER[i];
    const v = finalA[aid];
    f[`attributes${i + 1}`] = v != null && v !== "" ? String(Math.round(Number(v) || 1)) : "1";
  }

  const slots = Array.isArray(data.callingSlots) ? data.callingSlots.filter((s) => s && typeof s === "object") : [];
  if (slots.length) {
    for (let i = 0; i < 4; i += 1) {
      const slot = slots[i];
      const cid = String(slot?.id || "").trim();
      const nm = cid ? bundle.callings?.[cid]?.name || cid : "";
      const dots = Math.max(1, Math.min(5, Math.round(Number(slot?.dots) || 1)));
      f[`callings${i + 1}`] = nm ? `${nm} (${dots})` : "";
    }
  } else {
    f.callings1 = String(data.calling ?? "").trim();
    f.callings2 = String(Math.max(1, Math.min(5, Math.round(Number(data.callingDots) || 1))));
    f.callings3 = "";
    f.callings4 = "";
  }

  const deeds = data.deeds && typeof data.deeds === "object" ? data.deeds : {};
  const pantheonId = String(data.pantheonId || "").trim();
  f.deeds1 = String(deeds.short ?? "").trim();
  f.deeds2 = String(deeds.long ?? "").trim();
  f.deeds3 = String(deeds.band ?? "").trim();
  f.deeds4 = pantheonId === "mythos" ? String(deeds.mythos ?? "").trim() : "";
  for (let i = 1; i <= 4; i += 1) {
    f[`deedcheck${i}`] = false;
  }

  const leg = data.legendRating;
  f.legend1 = leg != null && leg !== "" && !Number.isNaN(Number(leg)) ? String(Math.round(Number(leg))) : "";

  const knackNames = [];
  const addKnackIds = (ids, suffix) => {
    for (const id of ids || []) {
      const k = bundle.knacks?.[id];
      const base = k?.name || id;
      knackNames.push(suffix ? `${base} (${suffix})` : base);
    }
  };
  if (Array.isArray(data.knackIds) && data.knackIds.length) addKnackIds(data.knackIds, "");
  const finIds = data.finishing?.finishingKnackIds;
  if (Array.isArray(finIds) && finIds.length) addKnackIds(finIds, "");
  if (!knackNames.length) {
    for (const name of data.knacks || []) if (name) knackNames.push(String(name));
    for (const name of data.finishingKnacks || []) if (name) knackNames.push(String(name));
  }
  for (let i = 0; i < 16; i += 1) f[`knacks${i + 1}`] = knackNames[i] || "";

  const pids = mergedPurviewIdsForSheet(data);
  for (let i = 0; i < 6; i += 1) {
    const p = pids[i];
    f[`purviews${i + 1}`] = p ? purviewDisplayNameForPantheon(p, bundle, pantheonId) : "";
  }
  for (let i = 7; i <= 30; i += 1) f[`purviews${i}`] = "";

  let bi = 0;
  for (const bid of data.boons || []) {
    if (bi >= 34) break;
    const bb = bundle.boons?.[bid];
    if (bb && boonIsPurviewInnateAutomaticGrant(bb, bundle)) continue;
    bi += 1;
    f[`boons${bi}`] = bb ? boonDisplayLabel(bb, bundle, pantheonId) : String(bid);
  }

  const brIds = (data.finishing?.birthrightPicks || []).filter(Boolean);
  for (let i = 0; i < 8; i += 1) {
    const bid = brIds[i];
    const br = bid ? bundle.birthrights?.[bid] : null;
    f[`birthrights${i + 1}`] = br ? `${br.name || bid} (${Math.min(5, Math.max(1, Math.round(Number(br.pointCost) || 1)))})` : bid || "";
  }

  applyFatebindingsToInteractivePdfFields(data.fatebindings, f);

  const eqRows = [];
  const eqBundle = bundle.equipment || {};
  const tagBundle = bundle.tags || {};
  for (const eid of data.sheetEquipmentIds || []) {
    if (!eid || String(eid).startsWith("_")) continue;
    const eq = eqBundle[eid];
    if (!eq) continue;
    const tagIds = Array.isArray(eq.tagIds) ? eq.tagIds : [];
    const tags = tagIds.map((tid) => tagBundle[tid]?.name || tid).filter(Boolean).join(", ");
    eqRows.push({ name: eq.name || eid, tags });
  }
  for (let i = 0; i < 6; i += 1) {
    const row = eqRows[i];
    f[`equip${i + 1}`] = row ? row.name : "";
    f[`equip${i + 7}`] = row ? row.tags : "";
  }

  f.combat1 = data.movementDice != null ? String(data.movementDice) : "";
  f.combat2 = data.defense != null ? String(data.defense) : "";
  f.combat3 = "";
  f.combat4 = "";

  packLinesIntoFields(
    String(data.sheetNotesExtra ?? "").trim(),
    Array.from({ length: 25 }, (_, i) => `notes${i + 1}`),
    f,
  );

  packLinesIntoFields(
    String(data.sheetDescription ?? "").trim(),
    Array.from({ length: 18 }, (_, i) => `description${i + 1}`),
    f,
  );

  return f;
}

/**
 * @param {Record<string, unknown>} data — merged export (includes `dragon` blob)
 * @param {Record<string, unknown>} bundle
 */
export function buildDragonInteractivePdfFields(data, bundle) {
  /** @type {Record<string, string | boolean>} */
  const f = {};
  const d = data.dragon && typeof data.dragon === "object" ? data.dragon : {};
  const skills = data.skills && typeof data.skills === "object" ? data.skills : {};
  const specs = data.skillSpecialties && typeof data.skillSpecialties === "object" ? data.skillSpecialties : {};
  const finalA = data.attributesAfterFavored && typeof data.attributesAfterFavored === "object" ? data.attributesAfterFavored : {};
  const paths = d.paths && typeof d.paths === "object" ? d.paths : {};
  const ps = d.pathSkills && typeof d.pathSkills === "object" ? d.pathSkills : {};
  const skillName = (id) => (bundle.skills && bundle.skills[id] ? bundle.skills[id].name : id) || id;

  f.name = String(data.characterName ?? "").trim();
  f.player = "";
  f.patron = String(data.flightName || data.flightId || "").trim();
  f.pantheon = String(data.concept ?? "").trim();

  f.paths1 = String(paths.origin ?? "").trim();
  f.paths2 = (Array.isArray(ps.origin) ? ps.origin : []).map((id) => skillName(id)).join(", ");
  f.paths3 = "";
  f.paths4 = "";
  f.paths5 = String(paths.role ?? "").trim();
  f.paths6 = (Array.isArray(ps.role) ? ps.role : []).map((id) => skillName(id)).join(", ");
  f.paths7 = "";
  f.paths8 = "";
  f.paths9 = String(paths.flight ?? "").trim();
  f.paths10 = (Array.isArray(ps.flight) ? ps.flight : []).map((id) => skillName(id)).join(", ");
  f.paths11 = "";
  f.paths12 = "";

  for (let i = 0; i < SKILL_ROW_IDS.length; i += 1) {
    const sid = SKILL_ROW_IDS[i];
    f[`skills${i + 1}`] = String(specs[sid] ?? "").trim();
  }

  for (let i = 0; i < ATTR_PDF_ORDER.length; i += 1) {
    const aid = ATTR_PDF_ORDER[i];
    const v = finalA[aid];
    f[`attributes${i + 1}`] = v != null && v !== "" ? String(Math.round(Number(v) || 1)) : "1";
  }

  const deeds = data.deeds && typeof data.deeds === "object" ? data.deeds : {};
  f.deeds1 = String(deeds.short ?? "").trim();
  f.deeds2 = String(deeds.long ?? "").trim();
  f.deeds3 = String(d.deedName ?? "").trim();

  const slots = Array.isArray(d.callingSlots) ? d.callingSlots : [];
  for (let i = 0; i < 3; i += 1) {
    const slot = slots[i];
    const cid = String(slot?.id || "").trim();
    const nm = cid ? bundle.callings?.[cid]?.name || cid : "";
    const dots = Math.max(1, Math.min(5, Math.round(Number(slot?.dots) || 1)));
    f[`calling${i + 2}`] = nm ? `${nm} (${dots})` : "";
  }

  f.movement = data.movementDice != null ? String(data.movementDice) : "";
  f.defense = data.defense != null ? String(data.defense) : "";
  f.initiativeroll = "";

  const eqRows = [];
  const eqBundle = bundle.equipment || {};
  const tagBundle = bundle.tags || {};
  for (const eid of data.sheetEquipmentIds || []) {
    if (!eid || String(eid).startsWith("_")) continue;
    const eq = eqBundle[eid];
    if (!eq) continue;
    const tagIds = Array.isArray(eq.tagIds) ? eq.tagIds : [];
    const tags = tagIds.map((tid) => tagBundle[tid]?.name || tid).filter(Boolean).join(", ");
    eqRows.push({ name: eq.name || eid, tags });
  }
  for (let i = 0; i < 6; i += 1) {
    const row = eqRows[i];
    f[`equip${i + 1}`] = row ? row.name : "";
    f[`equip${i + 7}`] = row ? row.tags : "";
  }

  const knackNames = [];
  const pushKn = (arr) => {
    for (const id of arr || []) {
      const kid = String(id || "").trim();
      if (!kid) continue;
      knackNames.push(
        bundle.dragonCallingKnacks?.[kid]?.name ||
          bundle.knacks?.[kid]?.name ||
          bundle.dragonKnacks?.[kid]?.name ||
          kid,
      );
    }
  };
  pushKn(d.callingKnackIds);
  pushKn(d.draconicKnackIds);
  pushKn(d.finishingCallingKnackIds);
  for (let i = 0; i < 86; i += 1) f[`knacks${i + 1}`] = knackNames[i] || "";

  const spellRows = [];
  const known = Array.isArray(d.knownMagics) ? d.knownMagics : [];
  const spellsBy = d.spellsByMagicId && typeof d.spellsByMagicId === "object" ? d.spellsByMagicId : {};
  for (const mid of known) {
    if (!mid) continue;
    const mag = bundle.dragonMagic?.[mid];
    const sid = String(spellsBy[mid] || "").trim();
    const sp = Array.isArray(mag?.spells) ? mag.spells.find((x) => x && x.id === sid) : null;
    spellRows.push({
      name: [mag?.name || mid, sp?.name].filter(Boolean).join(" — "),
      effect: dragonSpellPdfEffectLine(sp),
    });
  }
  const bm = String(d.bonusSpell?.magicId || "").trim();
  const bs = String(d.bonusSpell?.spellId || "").trim();
  if (bm && bs) {
    const mag = bundle.dragonMagic?.[bm];
    const sp = Array.isArray(mag?.spells) ? mag.spells.find((x) => x && x.id === bs) : null;
    spellRows.push({
      name: `Bonus — ${mag?.name || bm} — ${sp?.name || bs}`,
      effect: dragonSpellPdfEffectLine(sp),
    });
  }
  for (let i = 0; i < 10; i += 1) {
    const row = spellRows[i];
    f[`boons${i + 1}`] = row ? row.name : "";
    f[`booneffect${i + 1}`] = row ? row.effect : "";
  }

  const lt = [d.deedName, deeds.short, deeds.long, deeds.band].map((x) => String(x || "").trim());
  for (let i = 0; i < 4; i += 1) f[`LT${i + 1}`] = lt[i] || "";

  const picks = [...(d.birthrightPicks || []), ...(d.finishingBirthrightPicks || [])].filter(
    (p) => p && typeof p === "object" && String(p.id || "").trim(),
  );
  for (let i = 0; i < 56; i += 1) {
    const pick = picks[i];
    if (!pick) {
      f[`BR${i + 1}`] = "";
      continue;
    }
    const bid = String(pick.id || "").trim();
    const br = bundle.birthrights?.[bid];
    const dots = Math.min(5, Math.max(1, Math.round(Number(pick.dots) || 1)));
    f[`BR${i + 1}`] = br ? `${br.name || bid} (${dots})` : `${bid} (${dots})`;
  }

  packLinesIntoFields(
    [data.notes, data.sheetNotesExtra].map((x) => String(x || "").trim()).filter(Boolean).join("\n\n"),
    Array.from({ length: 24 }, (_, i) => `history${i + 1}`),
    f,
  );
  packLinesIntoFields(
    String(data.sheetDescription ?? "").trim(),
    Array.from({ length: 18 }, (_, i) => `description${i + 1}`),
    f,
  );
  packLinesIntoFields("", Array.from({ length: 11 }, (_, i) => `notes${i + 1}`), f);

  return f;
}

/**
 * @param {"scion"|"dragon"} lineage
 * @param {Record<string, string | boolean>} fields
 * @param {string} [downloadName]
 */
function pdfFilenameFromContentDisposition(cd, lineage) {
  let fn = lineage === "dragon" ? "character-dragon-interactive.pdf" : "character-scion-interactive.pdf";
  const m = cd && /filename="([^"]+)"/.exec(cd);
  if (m) fn = m[1];
  return fn;
}

/**
 * @param {Uint8Array} bytes
 * @param {string} fn
 */
function triggerPdfDownload(bytes, fn) {
  if (!bytes.byteLength) {
    throw new Error(
      "PDF data is empty after decode. In DevTools → Network, confirm api/export/interactive-pdf response size and Content-Type.",
    );
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fn;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export async function downloadInteractiveCharacterPdf(lineage, fields, downloadName) {
  const r = await fetch(apiUrl("api/export/interactive-pdf"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lineage,
      fields,
      characterName: downloadName,
      transfer: "base64",
    }),
    cache: "no-store",
  });
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const j = await r.json();
      if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      try {
        msg = await r.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg || `HTTP ${r.status}`);
  }

  const ct = (r.headers.get("content-type") || "").toLowerCase();
  let bytes;
  let fn = pdfFilenameFromContentDisposition(r.headers.get("Content-Disposition"), lineage);

  if (ct.includes("application/json")) {
    const j = await r.json();
    if (j && typeof j.filename === "string" && j.filename.trim()) fn = j.filename.trim();
    const b64 = j && typeof j.pdfBase64 === "string" ? j.pdfBase64 : "";
    if (!b64) {
      throw new Error("Server JSON did not include pdfBase64 (update the app server).");
    }
    try {
      const bin = atob(b64);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : String(e));
    }
    const expected = Number(j.byteLength);
    if (Number.isFinite(expected) && expected > 0 && bytes.byteLength !== expected) {
      throw new Error(`PDF size mismatch after decode (got ${bytes.byteLength}, expected ${expected}).`);
    }
  } else {
    const buf = await r.arrayBuffer();
    bytes = new Uint8Array(buf);
    if (!bytes.byteLength) {
      const cl = r.headers.get("content-length");
      const hint = cl ? ` Content-Length header was ${cl}.` : "";
      throw new Error(
        `Binary PDF response was empty (0 bytes).${hint} Try updating the server so it supports transfer=base64, or check for a proxy stripping the body.`,
      );
    }
    fn = pdfFilenameFromContentDisposition(r.headers.get("Content-Disposition"), lineage);
  }

  triggerPdfDownload(bytes, fn);
}
