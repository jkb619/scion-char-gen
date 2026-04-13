/**
 * Six `cs-mcg-write-line` rows (Legendary titles count). Splits on newlines;
 * overflow past line 5 is joined into the sixth row.
 * @param {unknown} text
 * @returns {string[]}
 */
export function sheetMultilineSixWriteLines(text) {
  const raw = String(text ?? "").replace(/\r\n/g, "\n").trimEnd();
  const max = 6;
  if (!raw) return Array.from({ length: max }, () => "");
  const parts = raw.split("\n");
  const slots = [];
  for (let i = 0; i < max - 1; i += 1) {
    slots.push(parts[i] != null ? String(parts[i]).slice(0, 2400) : "");
  }
  const tail =
    parts.length > max - 1 ? parts.slice(max - 1).join("\n") : parts[max - 1] != null ? String(parts[max - 1]) : "";
  slots.push(tail.slice(0, 2400));
  return slots;
}

/** @param {unknown} sheetDescription */
export function sheetDescriptionLinesForDisplay(sheetDescription) {
  return sheetMultilineSixWriteLines(sheetDescription);
}
