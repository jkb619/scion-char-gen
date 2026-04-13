/** Fatebinding rows for the MCG-style sheet (14 slots) and interactive PDF packing. */

export const FATEBINDING_SHEET_SLOT_COUNT = 14;

/**
 * @typedef {{ name: string, strength: string, story: string }} FatebindingRow
 */

/**
 * @param {unknown} raw
 * @returns {FatebindingRow[]}
 */
function parseFatebindingRows(raw) {
  /** @type {FatebindingRow[]} */
  let rows = [];
  if (raw == null) {
    rows = [];
  } else if (typeof raw === "string") {
    const lines = String(raw)
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    rows = lines.map((name) => ({ name, strength: "", story: "" }));
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === "object") {
        rows.push({
          name: String(/** @type {{ name?: unknown }} */ (item).name ?? "").trim(),
          strength: String(/** @type {{ strength?: unknown }} */ (item).strength ?? "").trim(),
          story: String(/** @type {{ story?: unknown }} */ (item).story ?? "").trim(),
        });
      }
    }
  }
  return rows;
}

/** @param {FatebindingRow} r */
function rowIsEmpty(r) {
  return !r.name && !r.strength && !r.story;
}

/**
 * Fatebinding rows with any field set — Review HTML sheet omits empty boxes.
 * @param {unknown} raw
 * @returns {FatebindingRow[]}
 */
export function nonEmptyFatebindingRowsForSheet(raw) {
  return parseFatebindingRows(raw).filter((r) => !rowIsEmpty(r));
}

/**
 * Parsed list, trailing empty rows removed, max 14 (import cleanup / export trim).
 * @param {unknown} raw
 * @returns {FatebindingRow[]}
 */
export function sanitizeFatebindingsForEditor(raw) {
  const rows = parseFatebindingRows(raw);
  while (rows.length && rowIsEmpty(rows[rows.length - 1])) {
    rows.pop();
  }
  return rows.slice(0, FATEBINDING_SHEET_SLOT_COUNT);
}

/**
 * Wizard storage: parse and cap at 14; keep in-progress empty rows (do not trim trailing).
 * @param {unknown} raw
 * @returns {FatebindingRow[]}
 */
export function coerceFatebindingsStoredList(raw) {
  return parseFatebindingRows(raw).slice(0, FATEBINDING_SHEET_SLOT_COUNT);
}

/**
 * Pad to 14 rows for sheet layout and PDF helpers.
 * @param {unknown} raw
 * @returns {FatebindingRow[]}
 */
export function normalizeFatebindingsList(raw) {
  const rows = parseFatebindingRows(raw);
  while (rows.length < FATEBINDING_SHEET_SLOT_COUNT) {
    rows.push({ name: "", strength: "", story: "" });
  }
  return rows.slice(0, FATEBINDING_SHEET_SLOT_COUNT);
}

/**
 * @param {unknown} raw
 * @returns {FatebindingRow[]}
 */
export function trimTrailingEmptyFatebindings(raw) {
  return sanitizeFatebindingsForEditor(raw);
}

/**
 * Pack interactive PDF `fatebinding1`…`fatebinding28`: per row emit name, strength, then story lines; cap at 28.
 * @param {unknown} raw
 * @param {Record<string, string | boolean>} f
 */
export function applyFatebindingsToInteractivePdfFields(raw, f) {
  const keys = Array.from({ length: 28 }, (_, i) => `fatebinding${i + 1}`);
  /** @type {string[]} */
  const lines = [];
  for (const row of normalizeFatebindingsList(raw)) {
    if (lines.length >= 28) break;
    lines.push(row.name);
    if (lines.length >= 28) break;
    lines.push(row.strength);
    const storyLines = String(row.story || "").replace(/\r\n/g, "\n").split("\n");
    for (const sl of storyLines) {
      if (lines.length >= 28) break;
      lines.push(sl);
    }
  }
  for (let i = 0; i < 28; i += 1) {
    f[keys[i]] = lines[i] != null ? String(lines[i]) : "";
  }
}

/**
 * Read single-row Finishing form `${idPrefix}-name`, `-strength`, `-story`.
 * @param {string} idPrefix e.g. `fin-fb` or `d-fin-fb`
 * @returns {FatebindingRow}
 */
export function readSingleFatebindingForm(idPrefix) {
  const nameEl = document.getElementById(`${idPrefix}-name`);
  const strEl = document.getElementById(`${idPrefix}-strength`);
  const storyEl = document.getElementById(`${idPrefix}-story`);
  return {
    name: nameEl && "value" in nameEl ? String(nameEl.value) : "",
    strength: strEl && "value" in strEl ? String(strEl.value) : "",
    story: storyEl && "value" in storyEl ? String(storyEl.value) : "",
  };
}

/**
 * Merge the visible row into `character.fatebindings` at `character.finishing.fatebindingEditorIndex`.
 * @param {Record<string, unknown>} character
 * @param {string} idPrefix
 */
export function persistFatebindingEditorRowFromDom(character, idPrefix) {
  let list = coerceFatebindingsStoredList(character.fatebindings);
  character.fatebindings = list;
  const fin = /** @type {{ fatebindingEditorIndex?: number }} */ (character.finishing ||= {});
  if (!list.length) {
    fin.fatebindingEditorIndex = 0;
    return;
  }
  let idx = Math.max(0, Math.min(list.length - 1, Math.round(Number(fin.fatebindingEditorIndex) || 0)));
  const row = readSingleFatebindingForm(idPrefix);
  const next = list.slice();
  next[idx] = row;
  list = coerceFatebindingsStoredList(next);
  character.fatebindings = list;
  fin.fatebindingEditorIndex = Math.min(idx, Math.max(0, list.length - 1));
}
