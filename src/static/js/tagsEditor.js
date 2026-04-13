/**
 * Editor for `data/tags.json` (master tag list).
 */

import { TAG_APPLIES_ROLES } from "./tagPicker.js";
import { apiUrl } from "./apiBase.js";

function clone(o) {
  return JSON.parse(JSON.stringify(o || {}));
}

function validEntryKey(id) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id);
}

function categoriesFromMeta(draft) {
  const c = draft?._meta?.categories;
  return Array.isArray(c) && c.length ? [...c] : ["combat", "protection", "utility", "narrative", "general"];
}

function tagTypesFromMeta(draft) {
  const t = draft?._meta?.tagTypes;
  return Array.isArray(t) && t.length
    ? [...t]
    : ["weapon", "armor", "tool", "accessory", "vehicle", "general", "other"];
}

function bookCategoriesFromMeta(draft) {
  const c = draft?._meta?.bookCategories;
  return Array.isArray(c) && c.length ? [...c] : ["", "Weapon", "Armor", "Follower"];
}

/** Duplicated from tagPicker so this module loads even if an older cached tagPicker lacks this helper. */
function formatTagPointCostLine(e) {
  if (e?.pointCost === null) return "null";
  const pc = e?.pointCost;
  if (pc === undefined) return "";
  if (typeof pc !== "number" || !Number.isFinite(pc)) return "";
  const alt = e?.pointCostAlt;
  const u = "\u2212";
  const core = pc < 0 ? `${u}${Math.abs(pc)}` : String(pc);
  if (typeof alt === "number" && Number.isFinite(alt)) return `${core} / ${alt}`;
  return core;
}

function ensureTagEntry(key, obj, draft) {
  const o = obj && typeof obj === "object" ? { ...obj } : {};
  o.id = key;
  if (!o.name) o.name = key;
  const cats = categoriesFromMeta(draft);
  o.category = typeof o.category === "string" && cats.includes(o.category) ? o.category : cats[0];
  const types = tagTypesFromMeta(draft);
  o.tagType = typeof o.tagType === "string" && types.includes(o.tagType) ? o.tagType : "general";
  const a = Array.isArray(o.appliesTo) ? o.appliesTo.map((x) => String(x)) : [];
  o.appliesTo = [...new Set(a.filter((x) => TAG_APPLIES_ROLES.includes(x)))];
  if (typeof o.description !== "string") o.description = "";
  if (typeof o.source !== "string") o.source = "";
  const bcs = bookCategoriesFromMeta(draft);
  if (typeof o.bookCategory !== "string") o.bookCategory = "";
  else {
    const t = o.bookCategory.trim();
    o.bookCategory = bcs.includes(t) ? t : t.slice(0, 48);
  }
  if (o.pointCost === null || o.pointCost === "null") {
    o.pointCost = null;
  } else if (o.pointCost === "" || o.pointCost === undefined) {
    delete o.pointCost;
  } else {
    const n = Number(o.pointCost);
    o.pointCost = Number.isFinite(n) ? Math.trunc(n) : null;
  }
  if (o.pointCostAlt === "" || o.pointCostAlt === undefined) {
    delete o.pointCostAlt;
  } else {
    const n = Number(o.pointCostAlt);
    if (Number.isFinite(n)) o.pointCostAlt = Math.trunc(n);
    else delete o.pointCostAlt;
  }
  if (typeof o.pointCostNote !== "string") o.pointCostNote = "";
  return o;
}

/** @param {HTMLElement} root @param {{ getBundle: () => any; reloadBundle: () => Promise<void> }} ctx */
export function mountTagsDataEditor(root, ctx) {
  const { getBundle, reloadBundle } = ctx;
  const draft = clone(getBundle()?.tags);
  let selectedKey = null;
  let dirty = false;

  const wrap = document.createElement("div");
  wrap.className = "br-editor-root tags-data-editor";

  wrap.innerHTML = `<div class="panel br-editor-intro"><h2>Tags library</h2>
    <p class="help">Edits <code>data/tags.json</code>. Tags are reused when building <strong>equipment</strong>, <strong>Relics</strong>, <strong>Creatures</strong>, and other entries. The list shows <strong>type</strong>, <strong>category</strong>, optional <strong>Storypath tag cost</strong> (Origin/Hero tables), and <strong>name</strong>; hover a row for its <strong>id</strong>. <strong>Book category</strong> (Weapon, Armor, Follower) matches the core tables; <strong>point cost</strong> uses negative numbers for flaw credits. Use <strong>appliesTo</strong> to limit pick-lists (empty means every editor). Run <code>scripts/scan_data_tag_ids.py</code> to verify <code>tagIds</code> under <code>data/</code>.</p></div>`;

  const toolbar = document.createElement("div");
  toolbar.className = "br-editor-toolbar";
  const btnSave = document.createElement("button");
  btnSave.type = "button";
  btnSave.className = "btn primary";
  btnSave.textContent = "Save to tags.json";
  const btnReload = document.createElement("button");
  btnReload.type = "button";
  btnReload.className = "btn secondary";
  btnReload.textContent = "Reload (discard)";
  const status = document.createElement("span");
  status.className = "help br-editor-status";
  toolbar.appendChild(btnSave);
  toolbar.appendChild(btnReload);
  toolbar.appendChild(status);
  wrap.appendChild(toolbar);

  const layout = document.createElement("div");
  layout.className = "br-editor-layout";
  const listCol = document.createElement("div");
  listCol.className = "br-editor-list panel";
  listCol.innerHTML = "<h2>Tags</h2>";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "br-editor-search";
  search.placeholder = "Filter…";
  const listUl = document.createElement("ul");
  listUl.className = "br-editor-list-ul";
  listCol.appendChild(search);
  listCol.appendChild(listUl);

  const formCol = document.createElement("div");
  formCol.className = "br-editor-form panel";
  formCol.innerHTML = "<h2>Edit tag</h2>";
  const formBody = document.createElement("div");
  formBody.className = "br-editor-form-body";
  const btnRow = document.createElement("div");
  btnRow.className = "br-editor-form-actions";
  const btnNew = document.createElement("button");
  btnNew.type = "button";
  btnNew.className = "btn secondary";
  btnNew.textContent = "New tag…";
  const btnDel = document.createElement("button");
  btnDel.type = "button";
  btnDel.className = "btn secondary";
  btnDel.style.borderColor = "var(--danger)";
  btnDel.textContent = "Delete";
  btnRow.appendChild(btnNew);
  btnRow.appendChild(btnDel);
  formCol.appendChild(formBody);
  formCol.appendChild(btnRow);
  layout.appendChild(listCol);
  layout.appendChild(formCol);
  wrap.appendChild(layout);
  root.appendChild(wrap);

  /** Normalize every tag row so list + bundle stay aligned (tagType, category, appliesTo). */
  function hydrateAllDraftTags() {
    for (const k of Object.keys(draft)) {
      if (k.startsWith("_")) continue;
      draft[k] = ensureTagEntry(k, draft[k], draft);
    }
  }

  function listKeysSorted() {
    hydrateAllDraftTags();
    return Object.keys(draft)
      .filter((k) => !k.startsWith("_"))
      .sort((a, b) => {
        const ca = String(draft[a]?.category || "").toLowerCase();
        const cb = String(draft[b]?.category || "").toLowerCase();
        if (ca !== cb) return ca.localeCompare(cb, undefined, { sensitivity: "base" });
        const na = String(draft[a]?.name || a).toLowerCase();
        const nb = String(draft[b]?.name || b).toLowerCase();
        if (na !== nb) return na.localeCompare(nb, undefined, { sensitivity: "base" });
        return a.localeCompare(b);
      });
  }

  function listKeys() {
    return listKeysSorted();
  }

  function setStatus(msg, err) {
    status.textContent = msg;
    status.style.color = err ? "var(--danger)" : "var(--muted)";
  }

  function paintList() {
    const q = search.value.trim().toLowerCase();
    listUl.innerHTML = "";
    for (const key of listKeysSorted()) {
      const t = draft[key];
      const types = tagTypesFromMeta(draft);
      const typ =
        typeof t?.tagType === "string" && types.includes(t.tagType) ? t.tagType : "general";
      const cat = typeof t?.category === "string" && t.category.trim() ? t.category.trim() : "—";
      const costLine = formatTagPointCostLine(t);
      const bc = typeof t?.bookCategory === "string" && t.bookCategory.trim() ? t.bookCategory.trim() : "";
      const hay = `${key} ${t?.name || ""} ${typ} ${cat} ${bc} ${costLine}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "br-editor-list-btn tags-lib-list-btn" + (selectedKey === key ? " active" : "");
      b.title = `Internal id: ${key}`;
      const meta = document.createElement("div");
      meta.className = "tags-lib-list-meta";
      const tySp = document.createElement("span");
      tySp.className = "tags-lib-type";
      tySp.textContent = typ;
      meta.appendChild(tySp);
      meta.appendChild(document.createTextNode(" · "));
      const caSp = document.createElement("span");
      caSp.className = "tags-lib-category";
      caSp.textContent = cat;
      meta.appendChild(caSp);
      if (bc) {
        meta.appendChild(document.createTextNode(" · "));
        const bcSp = document.createElement("span");
        bcSp.className = "tags-lib-bookcat";
        bcSp.textContent = bc;
        meta.appendChild(bcSp);
      }
      if (costLine) {
        meta.appendChild(document.createTextNode(" · "));
        const pcSp = document.createElement("span");
        pcSp.className = "tags-lib-pointcost";
        pcSp.textContent = costLine === "null" ? "cost: —" : `cost: ${costLine}`;
        meta.appendChild(pcSp);
      }
      const nm = document.createElement("span");
      nm.className = "tags-lib-list-name";
      nm.textContent = t?.name || "—";
      b.appendChild(meta);
      b.appendChild(nm);
      b.addEventListener("click", () => {
        selectedKey = key;
        paintList();
        paintForm();
      });
      li.appendChild(b);
      listUl.appendChild(li);
    }
  }

  function paintForm() {
    formBody.innerHTML = "";
    if (!selectedKey || !draft[selectedKey]) {
      formBody.innerHTML = "<p class='help'>Select a tag or create one.</p>";
      btnDel.disabled = true;
      return;
    }
    btnDel.disabled = false;
    const key = selectedKey;
    draft[key] = ensureTagEntry(key, draft[key], draft);
    const e = draft[key];

    const idRow = document.createElement("div");
    idRow.className = "field";
    idRow.innerHTML = "<label>Tag id</label>";
    const idInp = document.createElement("input");
    idInp.type = "text";
    idInp.value = key;
    idInp.addEventListener("change", () => {
      const newId = idInp.value.trim();
      if (!newId || newId === key) return;
      if (!validEntryKey(newId)) {
        setStatus("Invalid id.", true);
        idInp.value = key;
        return;
      }
      if (draft[newId]) {
        setStatus("Id exists.", true);
        idInp.value = key;
        return;
      }
      draft[newId] = { ...draft[key], id: newId };
      delete draft[key];
      selectedKey = newId;
      dirty = true;
      paintList();
      paintForm();
    });
    idRow.appendChild(idInp);
    formBody.appendChild(idRow);

    const nameRow = document.createElement("div");
    nameRow.className = "field";
    nameRow.innerHTML = "<label>Name</label>";
    const nameInp = document.createElement("input");
    nameInp.type = "text";
    nameInp.value = e.name;
    nameInp.addEventListener("input", () => {
      e.name = nameInp.value;
      dirty = true;
      paintList();
    });
    nameRow.appendChild(nameInp);
    formBody.appendChild(nameRow);

    const catRow = document.createElement("div");
    catRow.className = "field";
    catRow.innerHTML = "<label>Category</label>";
    const catSel = document.createElement("select");
    for (const c of [...categoriesFromMeta(draft)].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { sensitivity: "base" }),
    )) {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      catSel.appendChild(o);
    }
    catSel.value = e.category;
    catSel.addEventListener("change", () => {
      e.category = catSel.value;
      dirty = true;
    });
    catRow.appendChild(catSel);
    formBody.appendChild(catRow);

    const typeRow = document.createElement("div");
    typeRow.className = "field";
    typeRow.innerHTML = "<label>Tag type (gear / kind)</label>";
    const typeSel = document.createElement("select");
    for (const tt of [...tagTypesFromMeta(draft)].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { sensitivity: "base" }),
    )) {
      const o = document.createElement("option");
      o.value = tt;
      o.textContent = tt;
      typeSel.appendChild(o);
    }
    typeSel.value = e.tagType;
    typeSel.addEventListener("change", () => {
      e.tagType = typeSel.value;
      dirty = true;
      paintList();
    });
    typeRow.appendChild(typeSel);
    formBody.appendChild(typeRow);

    const bcRow = document.createElement("div");
    bcRow.className = "field";
    bcRow.innerHTML = "<label>Book category (Weapon / Armor / Follower)</label>";
    const bcSel = document.createElement("select");
    const knownBc = bookCategoriesFromMeta(draft);
    const extraBc = e.bookCategory && !knownBc.includes(e.bookCategory) ? e.bookCategory : null;
    for (const bc of knownBc) {
      const o = document.createElement("option");
      o.value = bc;
      o.textContent = bc === "" ? "(none)" : bc;
      bcSel.appendChild(o);
    }
    if (extraBc) {
      const o = document.createElement("option");
      o.value = extraBc;
      o.textContent = extraBc;
      bcSel.appendChild(o);
    }
    bcSel.value = knownBc.includes(e.bookCategory) || extraBc ? e.bookCategory : "";
    bcSel.addEventListener("change", () => {
      e.bookCategory = bcSel.value;
      dirty = true;
      paintList();
    });
    bcRow.appendChild(bcSel);
    formBody.appendChild(bcRow);

    const pcRow = document.createElement("div");
    pcRow.className = "field";
    pcRow.innerHTML = "<label>Tag point cost (Origin/Hero tables)</label>";
    const pcWrap = document.createElement("div");
    pcWrap.className = "tags-pointcost-row";
    const pcNull = document.createElement("label");
    pcNull.className = "tag-check-item";
    const pcNullCb = document.createElement("input");
    pcNullCb.type = "checkbox";
    pcNullCb.checked = e.pointCost === null;
    const pcNum = document.createElement("input");
    pcNum.type = "number";
    pcNum.step = "1";
    pcNum.className = "tags-pointcost-num";
    pcNum.disabled = e.pointCost === null;
    if (e.pointCost !== null && e.pointCost !== undefined) pcNum.value = String(e.pointCost);
    else pcNum.value = "";
    pcNullCb.addEventListener("change", () => {
      if (pcNullCb.checked) {
        e.pointCost = null;
        pcNum.value = "";
        pcNum.disabled = true;
      } else {
        pcNum.disabled = false;
        const n = Math.trunc(Number(pcNum.value));
        if (pcNum.value !== "" && Number.isFinite(n)) e.pointCost = n;
        else delete e.pointCost;
      }
      dirty = true;
      paintList();
    });
    pcNum.addEventListener("input", () => {
      if (e.pointCost === null) return;
      const n = Math.trunc(Number(pcNum.value));
      if (pcNum.value === "" || !Number.isFinite(n)) delete e.pointCost;
      else e.pointCost = n;
      dirty = true;
      paintList();
    });
    const spNull = document.createElement("span");
    spNull.textContent = "Unpriced on table (store null)";
    pcNull.appendChild(pcNullCb);
    pcNull.appendChild(spNull);
    pcWrap.appendChild(pcNull);
    pcWrap.appendChild(pcNum);
    const pcHelp = document.createElement("p");
    pcHelp.className = "help";
    pcHelp.textContent =
      "Integer dot cost from the weapon, armor, or follower tag lists; negative values are flaws. Leave the number empty and unchecked to omit a cost (narrative tags).";
    pcRow.appendChild(pcWrap);
    pcRow.appendChild(pcHelp);
    formBody.appendChild(pcRow);

    const pcaRow = document.createElement("div");
    pcaRow.className = "field";
    pcaRow.innerHTML = "<label>Alternate point cost (optional tier, e.g. Hard armor)</label>";
    const pcaInp = document.createElement("input");
    pcaInp.type = "number";
    pcaInp.step = "1";
    pcaInp.value =
      typeof e.pointCostAlt === "number" && Number.isFinite(e.pointCostAlt) ? String(e.pointCostAlt) : "";
    pcaInp.addEventListener("input", () => {
      const n = Math.trunc(Number(pcaInp.value));
      if (pcaInp.value === "" || !Number.isFinite(n)) delete e.pointCostAlt;
      else e.pointCostAlt = n;
      dirty = true;
      paintList();
    });
    pcaRow.appendChild(pcaInp);
    formBody.appendChild(pcaRow);

    const pcNoteRow = document.createElement("div");
    pcNoteRow.className = "field";
    pcNoteRow.innerHTML = "<label>Point cost note</label>";
    const pcNoteTa = document.createElement("textarea");
    pcNoteTa.rows = 2;
    pcNoteTa.value = e.pointCostNote || "";
    pcNoteTa.addEventListener("input", () => {
      e.pointCostNote = pcNoteTa.value;
      dirty = true;
    });
    pcNoteRow.appendChild(pcNoteTa);
    formBody.appendChild(pcNoteRow);

    const appRow = document.createElement("div");
    appRow.className = "field";
    appRow.innerHTML = "<label>Applies to (empty = all editors)</label>";
    const appGrid = document.createElement("div");
    appGrid.className = "tag-applies-grid";
    for (const role of TAG_APPLIES_ROLES) {
      const lab = document.createElement("label");
      lab.className = "tag-check-item";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = e.appliesTo.includes(role);
      cb.addEventListener("change", () => {
        const set = new Set(e.appliesTo);
        if (cb.checked) set.add(role);
        else set.delete(role);
        e.appliesTo = [...set];
        dirty = true;
      });
      const sp = document.createElement("span");
      sp.textContent = role;
      lab.appendChild(cb);
      lab.appendChild(sp);
      appGrid.appendChild(lab);
    }
    appRow.appendChild(appGrid);
    formBody.appendChild(appRow);

    const descRow = document.createElement("div");
    descRow.className = "field";
    descRow.innerHTML = "<label>Description</label>";
    const descTa = document.createElement("textarea");
    descTa.rows = 3;
    descTa.value = e.description;
    descTa.addEventListener("input", () => {
      e.description = descTa.value;
      dirty = true;
    });
    descRow.appendChild(descTa);
    formBody.appendChild(descRow);

    const srcRow = document.createElement("div");
    srcRow.className = "field";
    srcRow.innerHTML = "<label>Source</label>";
    const srcTa = document.createElement("textarea");
    srcTa.rows = 2;
    srcTa.value = e.source;
    srcTa.addEventListener("input", () => {
      e.source = srcTa.value;
      dirty = true;
    });
    srcRow.appendChild(srcTa);
    formBody.appendChild(srcRow);
  }

  search.addEventListener("input", paintList);

  btnNew.addEventListener("click", () => {
    const raw = window.prompt("New tag id:", "");
    if (raw == null) return;
    const id = raw.trim();
    if (!id || !validEntryKey(id) || draft[id]) {
      setStatus("Invalid or duplicate id.", true);
      return;
    }
    draft[id] = ensureTagEntry(
      id,
      {
        id,
        name: id,
        tagType: "general",
        category: categoriesFromMeta(draft)[0],
        appliesTo: [],
        description: "",
        source: "",
      },
      draft,
    );
    selectedKey = id;
    dirty = true;
    paintList();
    paintForm();
  });

  btnDel.addEventListener("click", () => {
    if (!selectedKey) return;
    if (!window.confirm(`Delete tag “${selectedKey}”?`)) return;
    delete draft[selectedKey];
    selectedKey = null;
    dirty = true;
    paintList();
    paintForm();
  });

  btnReload.addEventListener("click", async () => {
    if (dirty && !window.confirm("Discard changes?")) return;
    await reloadBundle();
    const fresh = clone(getBundle()?.tags);
    for (const k of Object.keys(draft)) delete draft[k];
    for (const k of Object.keys(fresh)) draft[k] = fresh[k];
    selectedKey = null;
    dirty = false;
    paintList();
    paintForm();
    setStatus("Reloaded.", false);
  });

  btnSave.addEventListener("click", async () => {
    if (!draft._meta || typeof draft._meta !== "object") {
      setStatus("Missing _meta", true);
      return;
    }
    hydrateAllDraftTags();
    for (const k of Object.keys(draft).filter((x) => !x.startsWith("_"))) {
      if (!validEntryKey(k)) {
        setStatus(`Bad key: ${k}`, true);
        return;
      }
      draft[k] = ensureTagEntry(k, draft[k], draft);
      draft[k].id = k;
    }
    try {
      const res = await fetch(apiUrl("api/data/tags"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      await reloadBundle();
      dirty = false;
      setStatus("Saved.", false);
    } catch (err) {
      setStatus(String(err.message || err), true);
    }
  });

  hydrateAllDraftTags();
  const lk = listKeysSorted();
  if (!selectedKey && lk.length) selectedKey = lk[0];
  paintList();
  paintForm();
}
