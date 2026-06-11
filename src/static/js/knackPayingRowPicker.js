import {
  callingRowDotCap,
  callingRowsThatCanPayForKnack,
  isGeneralCallingKnack,
  isKnackLocked,
  knackCallingSlotCost,
  knackPointCost,
  rowKnackPointsUsed,
  syncHeroKnackSlotAssignments,
} from "./eligibility.js";

/**
 * @param {number} rowIdx
 * @param {{ callingSlots?: { id?: string; dots?: number }[]; knackIds?: string[]; knackSlotById?: Record<string, number> }} character
 * @param {{ callings?: Record<string, { name?: string }> }} bundle
 * @param {string[]} knackIds
 * @param {Record<string, number>} slotMap
 */
export function callingRowBudgetLine(rowIdx, character, bundle, knackIds, slotMap) {
  const cap = callingRowDotCap(character, rowIdx);
  const used = rowKnackPointsUsed(rowIdx, knackIds, slotMap, bundle, character);
  const rowId = String(character.callingSlots?.[rowIdx]?.id ?? "").trim();
  const name = (rowId && bundle?.callings?.[rowId]?.name) || rowId || `Calling ${rowIdx + 1}`;
  return `${name}: ${used}/${cap} knack points`;
}

/**
 * Modal picker: which Calling row pays for a General (or multi-row) Knack.
 * @param {object} opts
 * @param {{ callingSlots?: { id?: string; dots?: number }[]; knackIds?: string[]; knackSlotById?: Record<string, number> }} opts.character
 * @param {{ callings?: Record<string, { name?: string }>; knacks?: Record<string, unknown> }} opts.bundle
 * @param {Record<string, unknown>} opts.knack
 * @param {number[]} opts.candidateRows
 * @param {string[]} opts.proposedKnackIds
 * @param {Record<string, number>} opts.slotMap
 * @returns {Promise<number | null>}
 */
export function pickKnackPayingCallingRow(opts) {
  const { character, bundle, knack, candidateRows, proposedKnackIds, slotMap } = opts;
  const rows = Array.isArray(candidateRows) ? candidateRows : [];
  if (rows.length === 0) return Promise.resolve(null);
  if (rows.length === 1) return Promise.resolve(rows[0]);

  const kName = String(knack?.name || knack?.id || "Knack");
  const cost = knackCallingSlotCost(knack, character);
  const costLabel = cost === 2 ? "2 knack points (Immortal)" : "1 knack point (Heroic)";

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "knack-pay-picker-backdrop";
    backdrop.setAttribute("role", "presentation");
    const panel = document.createElement("div");
    panel.className = "knack-pay-picker panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "knack-pay-picker-title");

    const title = document.createElement("h3");
    title.id = "knack-pay-picker-title";
    title.textContent = "Pay from which Calling?";
    panel.appendChild(title);

    const intro = document.createElement("p");
    intro.className = "help";
    intro.textContent = `${kName} costs ${costLabel}. Choose the Calling whose knack budget pays for it.`;
    panel.appendChild(intro);

    const list = document.createElement("div");
    list.className = "knack-pay-picker-options";
    const finish = (/** @type {number | null} */ rowIdx) => {
      backdrop.remove();
      resolve(rowIdx);
    };
    for (const ri of rows) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip knack-pay-picker-option";
      btn.textContent = callingRowBudgetLine(ri, character, bundle, proposedKnackIds, slotMap);
      btn.addEventListener("click", () => finish(ri));
      list.appendChild(btn);
    }
    panel.appendChild(list);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "secondary knack-pay-picker-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => finish(null));
    panel.appendChild(cancel);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(null);
    });
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    list.querySelector("button")?.focus();
  });
}

/**
 * @param {Record<string, unknown>} knack
 * @returns {string}
 */
export function knackPointCostLabel(knack) {
  return knackPointCost(knack) === 2 ? "2 pts" : "1 pt";
}

/**
 * Toggle a main-list Knack on/off with per-Calling row payment (Hero three-row mode).
 * @param {Record<string, unknown>} character
 * @param {{ knacks?: Record<string, unknown> }} bundle
 * @param {string} kid
 * @param {Record<string, unknown>} k
 * @param {{ preferredRowIdx?: number | null }} [opts]
 * @returns {Promise<boolean>} true if state changed
 */
export async function toggleHeroKnackWithRowPayment(character, bundle, kid, k, opts = {}) {
  if (!character.knackSlotById || typeof character.knackSlotById !== "object") character.knackSlotById = {};
  const set = new Set(Array.isArray(character.knackIds) ? character.knackIds : []);
  const preferredRowIdx = opts.preferredRowIdx;

  if (set.has(kid)) {
    if (isKnackLocked(character, kid)) return false;
    set.delete(kid);
    delete character.knackSlotById[kid];
    if (Array.isArray(character.experienceKnackIds)) {
      character.experienceKnackIds = character.experienceKnackIds.filter((x) => x !== kid);
    }
    character.knackIds = [...set];
    syncHeroKnackSlotAssignments(character, bundle);
    return true;
  }

  const next = [...set, kid];
  const map = character.knackSlotById;
  const rows = callingRowsThatCanPayForKnack(k, character, bundle, next, map);
  if (!rows.length) return false;

  let payRow = null;
  const pref = preferredRowIdx != null ? Number(preferredRowIdx) : null;
  if (pref != null && Number.isFinite(pref) && rows.includes(pref)) {
    payRow = pref;
  } else if (isGeneralCallingKnack(k) || rows.length > 1) {
    payRow = await pickKnackPayingCallingRow({
      character,
      bundle,
      knack: k,
      candidateRows: rows,
      proposedKnackIds: next,
      slotMap: map,
    });
  } else {
    payRow = rows[0];
  }
  if (payRow == null) return false;

  map[kid] = payRow;
  character.knackIds = next;
  syncHeroKnackSlotAssignments(character, bundle);
  return true;
}
