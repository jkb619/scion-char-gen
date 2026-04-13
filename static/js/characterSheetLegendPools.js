/** Legend row on Review sheets: fixed dot + pool checkbox columns (community four-pager style). */
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
 * Legend (always 15 columns) or Mythos Awareness (tier cap).
 * @param {HTMLElement} cell
 * @param {number|string|undefined} filled
 * @param {number} cap — used for Awareness only
 * @param {"Legend" | "Awareness"} kind
 * @param {{
 *   sheetHooks: object | null | undefined;
 *   legendDotTrackReadOnly: (n: number, max: number) => HTMLElement;
 *   awarenessDotTrackReadOnly: (n: number, max: number) => HTMLElement;
 * }} ctx
 */
export function appendLegendAwarenessDotsWithPools(cell, filled, cap, kind, ctx) {
  const { sheetHooks, legendDotTrackReadOnly, awarenessDotTrackReadOnly } = ctx;
  const c =
    kind === "Legend"
      ? LEGEND_SHEET_DOT_COUNT
      : Math.max(1, Math.min(20, Math.round(Number(cap) || 1)));
  const hooks = isFullSheetHooks(sheetHooks) ? sheetHooks : null;

  if (!hooks) {
    if (kind === "Legend") {
      const v = Math.max(0, Math.min(c, Math.round(Number(filled) || 0)));
      const track = document.createElement("div");
      track.className = "cs-mcg-legend-pool-track cs-mcg-legend-pool-track--dense";
      for (let i = 1; i <= c; i += 1) {
        const col = document.createElement("div");
        col.className = "cs-mcg-legend-pool-col";
        const dot = document.createElement("span");
        dot.className = "cs-dot" + (i <= v ? " on" : "");
        dot.setAttribute("aria-hidden", "true");
        col.appendChild(dot);
        const lab = document.createElement("label");
        lab.className = "cs-mcg-pool-check cs-mcg-pool-check--under-dot";
        lab.setAttribute("aria-label", `Legend pool from dot ${i} spent`);
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
    const av = Math.max(1, Math.min(c, Math.round(Number(filled) || 1)));
    cell.appendChild(awarenessDotTrackReadOnly(av, c));
    return;
  }

  const v =
    kind === "Legend"
      ? Math.max(0, Math.min(c, Math.round(Number(filled) || 0)))
      : Math.max(1, Math.min(c, Math.round(Number(filled) || 1)));
  const track = document.createElement("div");
  track.className = "cs-mcg-legend-pool-track" + (c > 6 ? " cs-mcg-legend-pool-track--dense" : "");
  for (let i = 1; i <= c; i += 1) {
    const col = document.createElement("div");
    col.className = "cs-mcg-legend-pool-col";
    const dot = document.createElement("span");
    dot.className = "cs-dot" + (i <= v ? " on" : "");
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
