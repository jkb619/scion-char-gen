import { boonTrackedMechanicalFields } from "./boonMechanicalParse.js";
import { applyGameDataHint } from "./fieldHelp.js";

const TAG_LINE_RE = /^(Cost|Duration|Subject|Range|Action|Clash)\s*:/i;

/**
 * Mechanical text with only the tagged stat lines stripped (what is already shown on the plate).
 * @param {unknown} mechRaw
 */
export function dragonSpellMechanicalBeyondTrackedTags(mechRaw) {
  const mech = String(mechRaw ?? "").trim();
  if (!mech) return "";
  const lines = mech.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.filter((l) => !TAG_LINE_RE.test(l)).join("\n\n").trim();
}

/**
 * One-line prose for sheet “Summary” and PDF/hover when `summary` is empty or duplicates Cost.
 * @param {Record<string, unknown>} spell
 * @param {Record<string, unknown> | null | undefined} magicMeta
 */
export function dragonSpellSummaryForDisplay(spell, magicMeta) {
  if (!spell || typeof spell !== "object") return "";
  const t = boonTrackedMechanicalFields(spell);
  const cost = String(t.cost ?? "").trim();
  const summ = String(spell.summary ?? "").trim();
  if (summ && summ.toLowerCase() !== cost.toLowerCase()) return summ;
  const desc = String(spell.description ?? "").trim();
  if (desc) return desc;
  const extra = dragonSpellMechanicalBeyondTrackedTags(spell.mechanicalEffects);
  if (extra) return extra;
  const magDesc =
    magicMeta && typeof magicMeta === "object" ? String(/** @type {{ description?: unknown }} */ (magicMeta).description ?? "").trim() : "";
  if (magDesc) return magDesc.slice(0, 500);
  return "";
}

/**
 * Tooltip payload for a spell chip (wizard Magic step).
 * @param {Record<string, unknown>} sp
 * @param {Record<string, unknown> | null | undefined} mag
 */
export function dragonSpellChipHintEntity(sp, mag) {
  const spell = sp && typeof sp === "object" ? sp : {};
  const magicName = mag && typeof mag === "object" && typeof mag.name === "string" ? mag.name.trim() : "";
  const t = boonTrackedMechanicalFields(spell);
  const statLines = [];
  if (t.cost) statLines.push(`Cost: ${t.cost}`);
  if (t.duration) statLines.push(`Duration: ${t.duration}`);
  if (t.subject) statLines.push(`Subject: ${t.subject}`);
  if (t.range) statLines.push(`Range: ${t.range}`);
  if (t.action) statLines.push(`Action: ${t.action}`);
  const prose = dragonSpellSummaryForDisplay(spell, mag);
  const mechExtra = dragonSpellMechanicalBeyondTrackedTags(spell.mechanicalEffects);
  const bits = [];
  const pre = String(spell.prerequisite ?? "").trim();
  if (pre) bits.push(`Prerequisite: ${pre}`);
  if (prose) bits.push(prose);
  if (mechExtra && mechExtra !== prose) bits.push(mechExtra);
  if (statLines.length) bits.push(statLines.join("\n"));
  return {
    name: magicName ? `${String(spell.name || spell.id)} — ${magicName}` : String(spell.name || spell.id),
    description: bits.join("\n\n").trim(),
    mechanicalEffects: String(spell.mechanicalEffects ?? "").trim(),
    source: typeof mag?.source === "string" ? mag.source : "",
  };
}

/**
 * Single-line effect text for interactive Dragon PDF rows.
 * @param {Record<string, unknown> | null | undefined} sp
 */
export function dragonSpellPdfEffectLine(sp) {
  if (!sp || typeof sp !== "object") return "";
  const t = boonTrackedMechanicalFields(sp);
  const bits = [];
  const prose = dragonSpellSummaryForDisplay(sp, null);
  if (prose) bits.push(prose);
  if (t.cost) bits.push(`Cost: ${t.cost}`);
  if (t.duration) bits.push(`Duration: ${t.duration}`);
  if (t.subject) bits.push(`Target: ${t.subject}`);
  if (t.range) bits.push(`Range: ${t.range}`);
  if (t.action) bits.push(`Action: ${t.action}`);
  if (t.clash) bits.push(`Clash: ${t.clash}`);
  return bits.join(" · ").slice(0, 480);
}

/**
 * One labeled row (same idea as MCG `mcgLinedField` for Boons).
 * @param {string} label
 * @param {unknown} value
 */
function dragonSpellPlateLine(label, value) {
  const row = document.createElement("div");
  row.className = "cs-dragon-spell-plate-line";
  const l = document.createElement("span");
  l.className = "cs-dragon-spell-plate-label";
  l.textContent = label;
  const v = document.createElement("div");
  v.className = "cs-dragon-spell-plate-value";
  const s = value == null || value === "" ? "" : String(value).trim();
  v.textContent = s || "—";
  row.appendChild(l);
  row.appendChild(v);
  return row;
}

/**
 * Boon-style stat plate for a Dragon Spell (uses the same Cost/Duration/Subject/… extraction as `boons.json`).
 * @param {HTMLElement} parent
 * @param {Record<string, unknown> | null | undefined} spell
 * @param {Record<string, unknown> | null | undefined} magicMeta
 * @param {{ emptyMessage?: string; sheetBlank?: boolean }} [opts] Pass `emptyMessage: ""` for no placeholder text.
 */
export function appendDragonSpellBoonStylePlate(parent, spell, magicMeta, opts = {}) {
  const blk = document.createElement("div");
  blk.className = "cs-dragon-spell-plate";
  if (opts.sheetBlank) {
    blk.classList.add("cs-dragon-spell-plate--blank");
    parent.appendChild(blk);
    return blk;
  }
  if (!spell || typeof spell !== "object") {
    const raw = opts.emptyMessage;
    const emptyMsg = raw === "" ? null : raw ?? "Pick a Spell above.";
    if (emptyMsg) {
      const p = document.createElement("p");
      p.className = "help cs-dragon-spell-plate-empty";
      p.textContent = emptyMsg;
      blk.appendChild(p);
    } else {
      blk.classList.add("cs-dragon-spell-plate--empty-silent");
    }
    parent.appendChild(blk);
    return blk;
  }

  const t = boonTrackedMechanicalFields(spell);
  const clashPart = t.clash ? `Clash: ${t.clash}` : "";
  const targetParts = [t.subject, clashPart].filter(Boolean);
  const summaryLine = dragonSpellSummaryForDisplay(spell, magicMeta);

  const linesWrap = document.createElement("div");
  linesWrap.className = "cs-dragon-spell-plate-lines";
  linesWrap.appendChild(dragonSpellPlateLine("Name", spell.name || spell.id));
  linesWrap.appendChild(dragonSpellPlateLine("Magic", magicMeta?.name));
  linesWrap.appendChild(dragonSpellPlateLine("Cost", t.cost));
  linesWrap.appendChild(dragonSpellPlateLine("Duration", t.duration));
  linesWrap.appendChild(dragonSpellPlateLine("Subject", targetParts.join(" · ")));
  linesWrap.appendChild(dragonSpellPlateLine("Range", t.range));
  linesWrap.appendChild(dragonSpellPlateLine("Action", t.action));
  if (summaryLine) linesWrap.appendChild(dragonSpellPlateLine("Summary", summaryLine));
  blk.appendChild(linesWrap);

  const desc = String(spell.description || "").trim();
  const mechBeyond = dragonSpellMechanicalBeyondTrackedTags(spell.mechanicalEffects);
  const note = document.createElement("div");
  note.className = "cs-dragon-spell-plate-note";
  const parts = [];
  if (desc && desc !== summaryLine) parts.push(desc);
  if (mechBeyond && mechBeyond !== summaryLine && mechBeyond !== desc) parts.push(mechBeyond);
  note.textContent = parts.join("\n\n").slice(0, 1400);
  if (note.textContent) blk.appendChild(note);

  applyGameDataHint(blk, {
    name: String(spell.name || spell.id || ""),
    description: [summaryLine, desc].filter(Boolean).join("\n\n").slice(0, 800),
    source: typeof magicMeta?.source === "string" ? magicMeta.source : "",
  });
  parent.appendChild(blk);
  return blk;
}
