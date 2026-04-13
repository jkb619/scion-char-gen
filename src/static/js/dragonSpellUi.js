import { boonTrackedMechanicalFields } from "./boonMechanicalParse.js";
import { applyGameDataHint } from "./fieldHelp.js";

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

  const linesWrap = document.createElement("div");
  linesWrap.className = "cs-dragon-spell-plate-lines";
  linesWrap.appendChild(dragonSpellPlateLine("Name", spell.name || spell.id));
  linesWrap.appendChild(dragonSpellPlateLine("Magic", magicMeta?.name));
  linesWrap.appendChild(dragonSpellPlateLine("Cost", t.cost));
  linesWrap.appendChild(dragonSpellPlateLine("Duration", t.duration));
  linesWrap.appendChild(dragonSpellPlateLine("Subject", targetParts.join(" · ")));
  linesWrap.appendChild(dragonSpellPlateLine("Range", t.range));
  linesWrap.appendChild(dragonSpellPlateLine("Action", t.action));
  linesWrap.appendChild(dragonSpellPlateLine("Summary", spell.summary));
  blk.appendChild(linesWrap);

  const desc = String(spell.description || "").trim();
  const mech = String(spell.mechanicalEffects || "").trim();
  const summ = String(spell.summary || "").trim();
  const note = document.createElement("div");
  note.className = "cs-dragon-spell-plate-note";
  const parts = [];
  if (desc && desc !== summ) parts.push(desc);
  if (mech) parts.push(mech);
  note.textContent = parts.join("\n\n").slice(0, 1400);
  if (note.textContent) blk.appendChild(note);

  applyGameDataHint(blk, {
    name: String(spell.name || spell.id || ""),
    description: [summ, desc].filter(Boolean).join("\n\n").slice(0, 800),
    source: typeof magicMeta?.source === "string" ? magicMeta.source : "",
  });
  parent.appendChild(blk);
  return blk;
}
