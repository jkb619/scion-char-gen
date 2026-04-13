/** Live substring filter on table rows using `data-filter-text` on each `<tr>`. */
export function wirePickerRowFilter(searchInput, tbody) {
  const apply = () => {
    const f = String(searchInput.value || "")
      .trim()
      .toLowerCase();
    for (const tr of tbody.querySelectorAll("tr")) {
      const key = (tr.getAttribute("data-filter-text") || "").toLowerCase();
      tr.style.display = !f || key.includes(f) ? "" : "none";
    }
  };
  searchInput.addEventListener("input", apply);
  searchInput.addEventListener("search", apply);
  apply();
}

/**
 * Click / Enter / Space on sortable headers reorders tbody rows. `columnSpecs[i]` null = not sortable.
 * @param {HTMLTableSectionElement} thead
 * @param {HTMLTableSectionElement} tbody
 * @param {(null | { get: (tr: HTMLTableRowElement) => string | number, numeric?: boolean })[]} columnSpecs
 */
export function wireSortableTableColumns(thead, tbody, columnSpecs) {
  const row = thead.querySelector("tr");
  if (!row) return;
  const ths = [...row.querySelectorAll("th")];
  if (ths.length === 0) return;
  const state = { idx: null, dir: 1 };

  const clearSortUi = () => {
    for (const th of ths) {
      th.removeAttribute("aria-sort");
      const ind = th.querySelector(".sort-indicator");
      if (ind) ind.textContent = "";
    }
  };

  columnSpecs.forEach((spec, idx) => {
    if (!spec || typeof spec.get !== "function") return;
    const th = ths[idx];
    if (!th) return;
    const orig = th.textContent.trim();
    th.textContent = "";
    const lab = document.createElement("span");
    lab.className = "sort-col-label";
    lab.textContent = orig || "\u00a0";
    const ind = document.createElement("span");
    ind.className = "sort-indicator";
    ind.setAttribute("aria-hidden", "true");
    th.appendChild(lab);
    th.appendChild(ind);
    th.classList.add("sortable-col-header");
    th.title = "Sort by this column; click again to reverse order.";

    const sortRows = () => {
      const rows = [...tbody.querySelectorAll("tr")];
      const mult = state.dir;
      const get = spec.get;
      const numeric = spec.numeric === true;
      rows.sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        if (numeric) {
          const na = Number(va);
          const nb = Number(vb);
          const naN = Number.isNaN(na);
          const nbN = Number.isNaN(nb);
          if (naN && nbN) return 0;
          if (naN) return 1 * mult;
          if (nbN) return -1 * mult;
          if (na !== nb) return mult * (na - nb);
          return 0;
        }
        const sa = String(va).toLowerCase();
        const sb = String(vb).toLowerCase();
        if (sa < sb) return -1 * mult;
        if (sa > sb) return 1 * mult;
        return 0;
      });
      rows.forEach((r) => tbody.appendChild(r));
    };

    const activate = () => {
      if (state.idx !== idx) {
        state.idx = idx;
        state.dir = 1;
      } else {
        state.dir *= -1;
      }
      clearSortUi();
      th.setAttribute("aria-sort", state.dir === 1 ? "ascending" : "descending");
      ind.textContent = state.dir === 1 ? " \u25b2" : " \u25bc";
      sortRows();
    };

    th.style.cursor = "pointer";
    th.tabIndex = 0;
    th.addEventListener("click", activate);
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });
}
