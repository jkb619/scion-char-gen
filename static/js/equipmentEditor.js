/**
 * Editor for `data/equipment.json` — uses master tags (tags.json, appliesTo includes equipment).
 */

import { appendTagChecklist, normalizeTagIdArray } from "./tagPicker.js";
import { apiUrl } from "./apiBase.js";

function clone(o) {
  return JSON.parse(JSON.stringify(o || {}));
}

function validEntryKey(id) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id);
}

function equipmentTypesFromDraft(draft) {
  const t = draft?._meta?.equipmentTypes;
  const raw = Array.isArray(t) && t.length ? [...t] : ["weapon", "armor", "tool", "accessory", "general"];
  return [...raw].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }));
}

function ensureEquipmentEntry(key, obj, draft) {
  const o = obj && typeof obj === "object" ? { ...obj } : {};
  o.id = key;
  if (!o.name) o.name = key;
  const types = equipmentTypesFromDraft(draft);
  o.equipmentType = typeof o.equipmentType === "string" && types.includes(o.equipmentType) ? o.equipmentType : types[0];
  delete o.quality;
  o.tagIds = normalizeTagIdArray(o.tagIds);
  if (typeof o.description !== "string") o.description = "";
  if (typeof o.mechanicalEffects !== "string") o.mechanicalEffects = "";
  if (typeof o.source !== "string") o.source = "";
  return o;
}

/** @param {HTMLElement} root @param {{ getBundle: () => any; reloadBundle: () => Promise<void> }} ctx */
export function mountEquipmentDataEditor(root, ctx) {
  const { getBundle, reloadBundle } = ctx;
  const draft = clone(getBundle()?.equipment);
  let selectedKey = null;
  let dirty = false;

  const wrap = document.createElement("div");
  wrap.className = "br-editor-root";
  wrap.innerHTML = `<div class="panel br-editor-intro"><h2>Equipment library</h2>
    <p class="help">Edits <code>data/equipment.json</code>. Assign <strong>tags</strong> from the master list (<code>tags.json</code>, appliesTo <strong>equipment</strong>), plus type, description, and mechanical notes.</p></div>`;

  const toolbar = document.createElement("div");
  toolbar.className = "br-editor-toolbar";
  const btnSave = document.createElement("button");
  btnSave.type = "button";
  btnSave.className = "btn primary";
  btnSave.textContent = "Save to equipment.json";
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
  listCol.innerHTML = "<h2>Items</h2>";
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
  formCol.innerHTML = "<h2>Edit item</h2>";
  const formBody = document.createElement("div");
  formBody.className = "br-editor-form-body";
  const btnRow = document.createElement("div");
  btnRow.className = "br-editor-form-actions";
  const btnNew = document.createElement("button");
  btnNew.type = "button";
  btnNew.className = "btn secondary";
  btnNew.textContent = "New item…";
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
      .sort((a, b) => (draft[a]?.name || a).localeCompare(draft[b]?.name || b));
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
      const hay = `${key} ${t?.name || ""} ${t?.equipmentType || ""}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "br-editor-list-btn" + (selectedKey === key ? " active" : "");
      b.innerHTML = `<span class="br-editor-list-id">${key}</span><span class="br-editor-list-name">${t?.name || "—"}</span><span class="br-editor-list-type">${t?.equipmentType || ""}</span>`;
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
      formBody.innerHTML = "<p class='help'>Select an item or add one.</p>";
      btnDel.disabled = true;
      return;
    }
    btnDel.disabled = false;
    const key = selectedKey;
    draft[key] = ensureEquipmentEntry(key, draft[key], draft);
    const e = draft[key];
    const bundle = getBundle();

    const idRow = document.createElement("div");
    idRow.className = "field";
    idRow.innerHTML = "<label>Item id</label>";
    const idInp = document.createElement("input");
    idInp.type = "text";
    idInp.value = key;
    idInp.addEventListener("change", () => {
      const newId = idInp.value.trim();
      if (!newId || newId === key) return;
      if (!validEntryKey(newId) || draft[newId]) {
        setStatus("Invalid or duplicate id.", true);
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

    const typeRow = document.createElement("div");
    typeRow.className = "field";
    typeRow.innerHTML = "<label>Equipment type</label>";
    const typeSel = document.createElement("select");
    for (const t of equipmentTypesFromDraft(draft)) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    }
    typeSel.value = e.equipmentType;
    typeSel.addEventListener("change", () => {
      e.equipmentType = typeSel.value;
      dirty = true;
      paintList();
    });
    typeRow.appendChild(typeSel);
    formBody.appendChild(typeRow);

    appendTagChecklist(formBody, {
      bundle,
      selectedIds: e.tagIds,
      roleFilter: ["equipment"],
      onChange: (ids) => {
        e.tagIds = ids;
        dirty = true;
      },
    });

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

    const mechRow = document.createElement("div");
    mechRow.className = "field";
    mechRow.innerHTML = "<label>Mechanical effects</label>";
    const mechTa = document.createElement("textarea");
    mechTa.rows = 2;
    mechTa.value = e.mechanicalEffects;
    mechTa.addEventListener("input", () => {
      e.mechanicalEffects = mechTa.value;
      dirty = true;
    });
    mechRow.appendChild(mechTa);
    formBody.appendChild(mechRow);

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
    const raw = window.prompt("New equipment id:", "");
    if (raw == null) return;
    const id = raw.trim();
    if (!id || !validEntryKey(id) || draft[id]) {
      setStatus("Invalid or duplicate id.", true);
      return;
    }
    draft[id] = ensureEquipmentEntry(
      id,
      {
        id,
        name: "New item",
        equipmentType: equipmentTypesFromDraft(draft)[0],
        tagIds: [],
        description: "",
        mechanicalEffects: "",
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
    if (!window.confirm(`Delete “${selectedKey}”?`)) return;
    delete draft[selectedKey];
    selectedKey = null;
    dirty = true;
    paintList();
    paintForm();
  });

  btnReload.addEventListener("click", async () => {
    if (dirty && !window.confirm("Discard?")) return;
    await reloadBundle();
    const fresh = clone(getBundle()?.equipment);
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
      draft[k] = ensureEquipmentEntry(k, draft[k], draft);
      draft[k].id = k;
    }
    try {
      const res = await fetch(apiUrl("api/data/equipment"), {
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
