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

function ensureTagEntry(key, obj, draft) {
  const o = obj && typeof obj === "object" ? { ...obj } : {};
  o.id = key;
  if (!o.name) o.name = key;
  const cats = categoriesFromMeta(draft);
  o.category = typeof o.category === "string" && cats.includes(o.category) ? o.category : cats[0];
  const a = Array.isArray(o.appliesTo) ? o.appliesTo.map((x) => String(x)) : [];
  o.appliesTo = [...new Set(a.filter((x) => TAG_APPLIES_ROLES.includes(x)))];
  if (typeof o.description !== "string") o.description = "";
  if (typeof o.source !== "string") o.source = "";
  return o;
}

/** @param {HTMLElement} root @param {{ getBundle: () => any; reloadBundle: () => Promise<void> }} ctx */
export function mountTagsDataEditor(root, ctx) {
  const { getBundle, reloadBundle } = ctx;
  const draft = clone(getBundle()?.tags);
  let selectedKey = null;
  let dirty = false;

  const wrap = document.createElement("div");
  wrap.className = "br-editor-root";

  wrap.innerHTML = `<div class="panel br-editor-intro"><h2>Tags library</h2>
    <p class="help">Edits <code>data/tags.json</code>. Tags are reused when building <strong>equipment</strong>, <strong>Relics</strong>, <strong>Creatures</strong>, and other entries. Use <strong>appliesTo</strong> to limit where a tag appears in pick-lists (empty means every editor).</p></div>`;

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

  function listKeys() {
    return Object.keys(draft)
      .filter((k) => !k.startsWith("_"))
      .sort();
  }

  function setStatus(msg, err) {
    status.textContent = msg;
    status.style.color = err ? "var(--danger)" : "var(--muted)";
  }

  function paintList() {
    const q = search.value.trim().toLowerCase();
    listUl.innerHTML = "";
    for (const key of listKeys()) {
      const t = draft[key];
      const hay = `${key} ${t?.name || ""}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "br-editor-list-btn" + (selectedKey === key ? " active" : "");
      b.innerHTML = `<span class="br-editor-list-id">${key}</span><span class="br-editor-list-name">${t?.name || "—"}</span>`;
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
    for (const k of listKeys()) {
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

  if (!selectedKey && listKeys().length) selectedKey = listKeys()[0];
  paintList();
  paintForm();
}
