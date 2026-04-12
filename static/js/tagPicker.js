/**
 * Shared UI helpers for `data/tags.json` — used by Birthright, Equipment, and Tags editors.
 */

/** @type {readonly string[]} */
export const TAG_APPLIES_ROLES = [
  "equipment",
  "relic",
  "creature",
  "follower",
  "guide",
  "cult",
  "general",
];

export function tagEntriesSorted(bundle) {
  const t = bundle?.tags || {};
  return Object.entries(t)
    .filter(([k]) => !k.startsWith("_"))
    .sort((a, b) => (a[1]?.name || a[0]).localeCompare(b[1]?.name || b[0]));
}

/**
 * Tag applies if it has no appliesTo / empty (global) or intersects roleFilter.
 * @param {any} tag
 * @param {string[]} roleFilter — e.g. ["relic"]
 */
export function tagMatchesRoles(tag, roleFilter) {
  if (!roleFilter || roleFilter.length === 0) return true;
  const a = tag?.appliesTo;
  if (!Array.isArray(a) || a.length === 0) return true;
  const set = new Set(a);
  return roleFilter.some((r) => set.has(r));
}

export function normalizeTagIdArray(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];
}

/**
 * @param {HTMLElement} parent
 * @param {{ bundle: any; selectedIds: string[]; roleFilter: string[]; onChange: (ids: string[]) => void }} opts
 */
export function appendTagChecklist(parent, opts) {
  const { bundle, selectedIds, roleFilter, onChange } = opts;
  const wrap = document.createElement("div");
  wrap.className = "tag-checklist field";
  const lab = document.createElement("label");
  lab.textContent = "Tags (master list)";
  wrap.appendChild(lab);
  const help = document.createElement("p");
  help.className = "help";
  help.textContent =
    "Choose tags from data/tags.json. Only tags whose appliesTo fits this editor are listed (or tags with no appliesTo, which are global).";
  wrap.appendChild(help);
  const grid = document.createElement("div");
  grid.className = "tag-checklist-grid";
  const sel = new Set(normalizeTagIdArray(selectedIds));
  const entries = tagEntriesSorted(bundle).filter(([, tag]) => tagMatchesRoles(tag, roleFilter));
  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "help";
    empty.textContent = "No tags match this filter — add tags in the Tags library tab or mark appliesTo as global.";
    wrap.appendChild(empty);
    parent.appendChild(wrap);
    return;
  }
  for (const [tid, tag] of entries) {
    const row = document.createElement("label");
    row.className = "tag-check-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = sel.has(tid);
    cb.addEventListener("change", () => {
      if (cb.checked) sel.add(tid);
      else sel.delete(tid);
      onChange(normalizeTagIdArray([...sel]));
    });
    const span = document.createElement("span");
    span.className = "tag-check-label";
    const cat = tag?.category ? ` · ${tag.category}` : "";
    span.textContent = `${tag?.name || tid}${cat}`;
    row.appendChild(cb);
    row.appendChild(span);
    grid.appendChild(row);
  }
  wrap.appendChild(grid);
  parent.appendChild(wrap);
}
