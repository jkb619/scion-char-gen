/** Legend row on Review sheets: fixed dot + pool checkbox columns (community four-pager style). Legend *rating* is not filled on the bubbles (pencil at table); pool-spent checkboxes still track play. */
export const LEGEND_SHEET_DOT_COUNT = 15;

/**
 * @param {unknown} h
 * @returns {h is {
 *   getLegendPoolSpentAt: (idx: number) => boolean;
 *   setLegendPoolSpentAt: (idx: number, v: boolean) => void;
 *   getAwarenessPoolSpentAt: (idx: number) => boolean;
 *   setAwarenessPoolSpentAt: (idx: number, v: boolean) => void;
 *   onLegendDotClick?: (dotIndex1Based: number) => void;
 * }}
 */
function isFullSheetHooks(h) {
  return (
    h &&
    typeof h === "object" &&
    typeof h.getLegendPoolSpentAt === "function" &&
    typeof h.setLegendPoolSpentAt === "function" &&
    typeof h.getAwarenessPoolSpentAt === "function" &&
    typeof h.setAwarenessPoolSpentAt === "function"
  );
}

/**
 * Legend and Mythos Awareness: **15** pool columns on the four-pager (same as community sheet); rating not filled on dots (table/pencil).
 * @param {HTMLElement} cell
 * @param {number|string|undefined} filled — ignored for dot fill on sheet (Legend + Awareness); pool hooks still receive indices 0..14
 * @param {number} cap — unused for column count for Legend/Awareness (always {@link LEGEND_SHEET_DOT_COUNT})
 * @param {"Legend" | "Awareness"} kind
 * @param {{
 *   sheetHooks: object | null | undefined;
 *   legendDotTrackReadOnly: (n: number, max: number) => HTMLElement;
 *   awarenessDotTrackReadOnly?: (n: number, max: number) => HTMLElement;
 * }} ctx
 */
export function appendLegendAwarenessDotsWithPools(cell, filled, cap, kind, ctx) {
  void filled;
  void cap;
  const { sheetHooks } = ctx;
  /* This helper is only used for four-pager Legend + Mythos Awareness rows; both use 15 sheet columns (community PDF). */
  const c = LEGEND_SHEET_DOT_COUNT;
  const hooks = isFullSheetHooks(sheetHooks) ? sheetHooks : null;

  if (!hooks) {
    const track = document.createElement("div");
    track.className = "cs-mcg-legend-pool-track cs-mcg-legend-pool-track--dense";
    for (let i = 1; i <= c; i += 1) {
      const col = document.createElement("div");
      col.className = "cs-mcg-legend-pool-col";
      const dot = document.createElement("span");
      dot.className = "cs-dot";
      dot.setAttribute("aria-hidden", "true");
      col.appendChild(dot);
      const lab = document.createElement("label");
      lab.className = "cs-mcg-pool-check cs-mcg-pool-check--under-dot";
      lab.setAttribute(
        "aria-label",
        kind === "Legend" ? `Legend pool from dot ${i} spent` : `Awareness pool from dot ${i} spent`,
      );
      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.disabled = true;
      inp.className = "cs-mcg-pool-check-input";
      lab.appendChild(inp);
      col.appendChild(lab);
      track.appendChild(col);
    }
    cell.appendChild(track);
    return;
  }

  /* Same as Legend row: empty rating bubbles; pool spent at table via checkboxes (+ pencil for rating). */
  const track = document.createElement("div");
  track.className = "cs-mcg-legend-pool-track cs-mcg-legend-pool-track--dense";
  for (let i = 1; i <= c; i += 1) {
    const col = document.createElement("div");
    col.className = "cs-mcg-legend-pool-col";
    const dot = document.createElement("span");
    dot.className = "cs-dot";
    dot.setAttribute("aria-hidden", "true");
    if (kind === "Legend" && typeof hooks.onLegendDotClick === "function") {
      dot.tabIndex = 0;
      dot.style.cursor = "pointer";
      dot.addEventListener("click", (e) => {
        e.preventDefault();
        hooks.onLegendDotClick(i);
      });
    }
    col.appendChild(dot);
    const idx = i - 1;
    const lab = document.createElement("label");
    lab.className = "cs-mcg-pool-check cs-mcg-pool-check--under-dot";
    lab.setAttribute(
      "aria-label",
      kind === "Legend" ? `Legend pool from dot ${i} spent` : `Awareness pool from dot ${i} spent`,
    );
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.className = "cs-mcg-pool-check-input";
    if (kind === "Legend") {
      inp.checked = !!hooks.getLegendPoolSpentAt(idx);
      inp.addEventListener("change", () => hooks.setLegendPoolSpentAt(idx, inp.checked));
    } else {
      inp.checked = !!hooks.getAwarenessPoolSpentAt(idx);
      inp.addEventListener("change", () => hooks.setAwarenessPoolSpentAt(idx, inp.checked));
    }
    lab.appendChild(inp);
    col.appendChild(lab);
    track.appendChild(col);
  }
  cell.appendChild(track);
}
