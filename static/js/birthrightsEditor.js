/**
 * Data editor for `data/birthrights.json` — Relic-focused fields follow Scion: Hero + Pandora’s Box
 * (Relic dots, linked Purview access, Evocation, Tags & Motifs). Saves via PUT /api/data/birthrights.
 */

import { appendTagChecklist, normalizeTagIdArray } from "./tagPicker.js";
import { apiUrl } from "./apiBase.js";

const BIRTHRIGHT_TYPES = ["relic", "guide", "follower", "creature", "cult"];

function cloneBirthrights(br) {
  return JSON.parse(JSON.stringify(br || {}));
}

function defaultRelicDetails() {
  return {
    rating: 1,
    tagIds: [],
    purviewId: "",
    purviewRating: 1,
    evocation: "",
    motifsAndTags: "",
  };
}

function defaultCreatureDetails() {
  return { tagIds: [] };
}

function ensureEntryShape(key, obj) {
  const o = obj && typeof obj === "object" ? { ...obj } : {};
  o.id = key;
  if (!o.name) o.name = key;
  if (!BIRTHRIGHT_TYPES.includes(o.birthrightType)) o.birthrightType = "relic";
  o.pointCost = Math.max(1, Math.min(5, Math.round(Number(o.pointCost) || 1)));
  if (typeof o.description !== "string") o.description = "";
  if (typeof o.mechanicalEffects !== "string") o.mechanicalEffects = "";
  if (typeof o.source !== "string") o.source = "";
  if (o.birthrightType === "relic") {
    const rd = o.relicDetails && typeof o.relicDetails === "object" ? { ...o.relicDetails } : defaultRelicDetails();
    rd.rating = Math.max(1, Math.min(5, Math.round(Number(rd.rating) || 1)));
    rd.tagIds = normalizeTagIdArray(rd.tagIds);
    rd.purviewId = typeof rd.purviewId === "string" ? rd.purviewId : "";
    rd.purviewRating = Math.max(1, Math.min(5, Math.round(Number(rd.purviewRating) || 1)));
    if (typeof rd.evocation !== "string") rd.evocation = "";
    if (typeof rd.motifsAndTags !== "string") rd.motifsAndTags = "";
    o.relicDetails = rd;
    delete o.creatureDetails;
  } else if (o.birthrightType === "creature") {
    const cd = o.creatureDetails && typeof o.creatureDetails === "object" ? { ...o.creatureDetails } : defaultCreatureDetails();
    cd.tagIds = normalizeTagIdArray(cd.tagIds);
    o.creatureDetails = cd;
    delete o.relicDetails;
  } else {
    delete o.relicDetails;
    delete o.creatureDetails;
  }
  return o;
}

function validEntryKey(id) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id);
}

/** @param {HTMLElement} parent @param {string} label @param {number} value @param {{ min: number; max: number; ariaLabel: string; onPick: (n: number) => void }} opts */
function appendRatingDots(parent, label, value, opts) {
  const row = document.createElement("div");
  row.className = "dot-row br-editor-dot-row";
  const lab = document.createElement("div");
  lab.className = "label";
  lab.textContent = label;
  const dots = document.createElement("div");
  dots.className = "dots";
  const v = Math.max(opts.min, Math.min(opts.max, Math.round(Number(value) || opts.min)));
  for (let i = opts.min; i <= opts.max; i += 1) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dot" + (i <= v ? " filled" : "");
    b.setAttribute("aria-label", `${opts.ariaLabel} ${i}`);
    b.addEventListener("click", () => opts.onPick(i));
    dots.appendChild(b);
  }
  row.appendChild(lab);
  row.appendChild(dots);
  parent.appendChild(row);
}

/**
 * @param {HTMLElement} root
 * @param {{ getBundle: () => any; reloadBundle: () => Promise<void> }} ctx
 */
export function mountBirthrightsDataEditor(root, ctx) {
  const { getBundle, reloadBundle } = ctx;
  const draft = cloneBirthrights(getBundle()?.birthrights);
  let selectedKey = null;
  let dirty = false;
  const purviewOptions = () =>
    Object.entries(getBundle()?.purviews || {})
      .filter(([k]) => !k.startsWith("_"))
      .sort((a, b) => (a[1]?.name || a[0]).localeCompare(b[1]?.name || b[0]));

  const wrap = document.createElement("div");
  wrap.className = "br-editor-root";

  const intro = document.createElement("div");
  intro.className = "panel br-editor-intro";
  intro.innerHTML = `<h2>Birthright library (data file)</h2>
    <p class="help">Edits <code>data/birthrights.json</code> on the server. <strong>Relics</strong> (Pandora’s Box / Hero): <strong>Relic dots</strong> (rating), <strong>master tags</strong> from <code>tags.json</code>, optional <strong>linked Purview</strong> + <strong>access dots</strong>, <strong>Evocation</strong>, and free <strong>Tags &amp; Motifs</strong> notes. <strong>Creatures</strong> use the same master list (creature-applicable tags). Define tags in the <strong>Tags library</strong> tab. Chargen <strong>point cost</strong> is separate from Relic rating unless your table ties them.</p>
    <p class="help">Confirm exact costs, Purview/Boon binding, and Evocation wording with your books (e.g. <cite>SCION_Pandoras_Box_(Revised_Download).pdf</cite>, <cite>Scion_Hero_(Final_Download).pdf</cite>).</p>`;
  wrap.appendChild(intro);

  const toolbar = document.createElement("div");
  toolbar.className = "br-editor-toolbar";
  const btnSave = document.createElement("button");
  btnSave.type = "button";
  btnSave.className = "btn primary";
  btnSave.textContent = "Save to birthrights.json";
  const btnReload = document.createElement("button");
  btnReload.type = "button";
  btnReload.className = "btn secondary";
  btnReload.textContent = "Reload from server (discard)";
  const status = document.createElement("span");
  status.className = "help br-editor-status";
  status.textContent = "";
  toolbar.appendChild(btnSave);
  toolbar.appendChild(btnReload);
  toolbar.appendChild(status);
  wrap.appendChild(toolbar);

  const layout = document.createElement("div");
  layout.className = "br-editor-layout";

  const listCol = document.createElement("div");
  listCol.className = "br-editor-list panel";
  const listHead = document.createElement("h2");
  listHead.textContent = "Entries";
  listCol.appendChild(listHead);
  const listSearch = document.createElement("input");
  listSearch.type = "search";
  listSearch.className = "br-editor-search";
  listSearch.placeholder = "Filter…";
  listCol.appendChild(listSearch);
  const listUl = document.createElement("ul");
  listUl.className = "br-editor-list-ul";
  listCol.appendChild(listUl);

  const formCol = document.createElement("div");
  formCol.className = "br-editor-form panel";
  const formHead = document.createElement("h2");
  formHead.textContent = "Edit entry";
  formCol.appendChild(formHead);
  const formBody = document.createElement("div");
  formBody.className = "br-editor-form-body";
  formCol.appendChild(formBody);

  const btnRow = document.createElement("div");
  btnRow.className = "br-editor-form-actions";
  const btnNew = document.createElement("button");
  btnNew.type = "button";
  btnNew.className = "btn secondary";
  btnNew.textContent = "New entry…";
  const btnDel = document.createElement("button");
  btnDel.type = "button";
  btnDel.className = "btn secondary";
  btnDel.style.borderColor = "var(--danger)";
  btnDel.textContent = "Delete entry";
  btnRow.appendChild(btnNew);
  btnRow.appendChild(btnDel);
  formCol.appendChild(btnRow);

  layout.appendChild(listCol);
  layout.appendChild(formCol);
  wrap.appendChild(layout);
  root.appendChild(wrap);

  function listKeys() {
    return Object.keys(draft)
      .filter((k) => !k.startsWith("_"))
      .sort((a, b) => a.localeCompare(b));
  }

  function setStatus(msg, isErr) {
    status.textContent = msg;
    status.style.color = isErr ? "var(--danger)" : "var(--muted)";
  }

  function paintList() {
    const q = listSearch.value.trim().toLowerCase();
    listUl.innerHTML = "";
    for (const key of listKeys()) {
      const entry = draft[key];
      const hay = `${key} ${entry?.name || ""} ${entry?.birthrightType || ""}`.toLowerCase();
      if (q && !hay.includes(q)) continue;
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "br-editor-list-btn" + (selectedKey === key ? " active" : "");
      b.innerHTML = `<span class="br-editor-list-id">${key}</span><span class="br-editor-list-name">${entry?.name || "—"}</span><span class="br-editor-list-type">${entry?.birthrightType || ""}</span>`;
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
      formBody.innerHTML = "<p class='help'>Select an entry from the list, or create a new one.</p>";
      btnDel.disabled = true;
      return;
    }
    btnDel.disabled = false;
    const key = selectedKey;
    draft[key] = ensureEntryShape(key, draft[key]);
    const e = draft[key];

    const idRow = document.createElement("div");
    idRow.className = "field";
    idRow.innerHTML = "<label>Entry id (JSON key)</label>";
    const idInp = document.createElement("input");
    idInp.type = "text";
    idInp.value = key;
    idInp.spellcheck = false;
    idInp.autocomplete = "off";
    idRow.appendChild(idInp);
    formBody.appendChild(idRow);

    const nameRow = document.createElement("div");
    nameRow.className = "field";
    nameRow.innerHTML = "<label>Display name</label>";
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
    typeRow.innerHTML = "<label>Birthright type</label>";
    const typeSel = document.createElement("select");
    for (const t of [...BIRTHRIGHT_TYPES].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" }))) {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      typeSel.appendChild(o);
    }
    typeSel.value = e.birthrightType;
    typeSel.addEventListener("change", () => {
      e.birthrightType = typeSel.value;
      if (e.birthrightType === "relic") e.relicDetails = ensureEntryShape(key, e).relicDetails || defaultRelicDetails();
      else delete e.relicDetails;
      dirty = true;
      paintList();
      paintForm();
    });
    typeRow.appendChild(typeSel);
    formBody.appendChild(typeRow);

    appendRatingDots(formBody, "Point cost (chargen)", e.pointCost, {
      min: 1,
      max: 5,
      ariaLabel: "Point cost",
      onPick: (n) => {
        e.pointCost = n;
        dirty = true;
        paintList();
        paintForm();
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
    mechRow.innerHTML = "<label>Mechanical effects (summary)</label>";
    const mechTa = document.createElement("textarea");
    mechTa.rows = 3;
    mechTa.value = e.mechanicalEffects;
    mechTa.addEventListener("input", () => {
      e.mechanicalEffects = mechTa.value;
      dirty = true;
    });
    mechRow.appendChild(mechTa);
    formBody.appendChild(mechRow);

    const srcRow = document.createElement("div");
    srcRow.className = "field";
    srcRow.innerHTML = "<label>Source (book / PDF)</label>";
    const srcTa = document.createElement("textarea");
    srcTa.rows = 2;
    srcTa.value = e.source;
    srcTa.addEventListener("input", () => {
      e.source = srcTa.value;
      dirty = true;
    });
    srcRow.appendChild(srcTa);
    formBody.appendChild(srcRow);

    if (e.birthrightType === "relic") {
      const rd = (e.relicDetails = e.relicDetails || defaultRelicDetails());
      const relicPanel = document.createElement("div");
      relicPanel.className = "br-editor-relic-panel";
      relicPanel.innerHTML =
        "<h3 class='br-editor-subhead'>Relic (Pandora’s Box)</h3><p class='help'>Relic <strong>rating</strong> is the object’s dot rating; optional <strong>Purview</strong> fields describe an innate or bound Purview hook for the table — verify Imbue / Boons with the book.</p>";

      appendRatingDots(relicPanel, "Relic rating (dots)", rd.rating, {
        min: 1,
        max: 5,
        ariaLabel: "Relic rating",
        onPick: (n) => {
          rd.rating = n;
          dirty = true;
          paintForm();
        },
      });

      appendTagChecklist(relicPanel, {
        bundle: getBundle(),
        selectedIds: rd.tagIds,
        roleFilter: ["relic"],
        onChange: (ids) => {
          rd.tagIds = ids;
          dirty = true;
        },
      });

      const pvRow = document.createElement("div");
      pvRow.className = "field";
      pvRow.innerHTML = "<label>Linked Purview (optional)</label>";
      const pvSel = document.createElement("select");
      const z = document.createElement("option");
      z.value = "";
      z.textContent = "— None —";
      pvSel.appendChild(z);
      for (const [pid, p] of purviewOptions()) {
        const o = document.createElement("option");
        o.value = pid;
        o.textContent = p?.name || pid;
        pvSel.appendChild(o);
      }
      pvSel.value = rd.purviewId || "";
      pvSel.addEventListener("change", () => {
        rd.purviewId = pvSel.value;
        dirty = true;
        paintForm();
      });
      pvRow.appendChild(pvSel);
      relicPanel.appendChild(pvRow);

      if (rd.purviewId) {
        appendRatingDots(relicPanel, "Purview access dots (on this Relic)", rd.purviewRating, {
          min: 1,
          max: 5,
          ariaLabel: "Purview access dots",
          onPick: (n) => {
            rd.purviewRating = n;
            dirty = true;
            paintForm();
          },
        });
      }

      const evoRow = document.createElement("div");
      evoRow.className = "field";
      evoRow.innerHTML = "<label>Evocation (traits / triggers)</label>";
      const evoTa = document.createElement("textarea");
      evoTa.rows = 2;
      evoTa.placeholder = "e.g. When you invoke the storm motif…";
      evoTa.value = rd.evocation;
      evoTa.addEventListener("input", () => {
        rd.evocation = evoTa.value;
        dirty = true;
      });
      evoRow.appendChild(evoTa);
      relicPanel.appendChild(evoRow);

      const tagRow = document.createElement("div");
      tagRow.className = "field";
      tagRow.innerHTML = "<label>Tags &amp; Motifs (notes)</label>";
      const tagTa = document.createElement("textarea");
      tagTa.rows = 2;
      tagTa.placeholder = "Narrative tags, Motifs, Enhancements…";
      tagTa.value = rd.motifsAndTags;
      tagTa.addEventListener("input", () => {
        rd.motifsAndTags = tagTa.value;
        dirty = true;
      });
      tagRow.appendChild(tagTa);
      relicPanel.appendChild(tagRow);

      formBody.appendChild(relicPanel);
    }

    if (e.birthrightType === "creature") {
      const cd = (e.creatureDetails = e.creatureDetails || defaultCreatureDetails());
      const crePanel = document.createElement("div");
      crePanel.className = "br-editor-relic-panel";
      crePanel.innerHTML =
        "<h3 class='br-editor-subhead'>Creature tags</h3><p class='help'>Pick tags from the master list that apply to companions / mounts (Pandora’s Box Flairs and fiction).</p>";
      appendTagChecklist(crePanel, {
        bundle: getBundle(),
        selectedIds: cd.tagIds,
        roleFilter: ["creature"],
        onChange: (ids) => {
          cd.tagIds = ids;
          dirty = true;
        },
      });
      formBody.appendChild(crePanel);
    }

    idInp.addEventListener("change", () => {
      const newId = idInp.value.trim();
      if (!newId || newId === key) return;
      if (!validEntryKey(newId)) {
        setStatus("Id must be letters, numbers, underscore; start with a letter or _.", true);
        idInp.value = key;
        return;
      }
      if (draft[newId]) {
        setStatus("That id already exists.", true);
        idInp.value = key;
        return;
      }
      draft[newId] = { ...draft[key], id: newId };
      delete draft[key];
      selectedKey = newId;
      dirty = true;
      setStatus("Renamed entry id — save to persist.", false);
      paintList();
      paintForm();
    });
  }

  listSearch.addEventListener("input", paintList);

  btnNew.addEventListener("click", () => {
    const raw = window.prompt("New entry id (e.g. myStormRelic):", "");
    if (raw == null) return;
    const id = raw.trim();
    if (!id || !validEntryKey(id)) {
      setStatus("Invalid id.", true);
      return;
    }
    if (draft[id]) {
      setStatus("Id already exists.", true);
      return;
    }
    draft[id] = ensureEntryShape(id, {
      id,
      name: "New birthright",
      birthrightType: "relic",
      pointCost: 1,
      description: "",
      mechanicalEffects: "",
      source: "SCION_Pandoras_Box_(Revised_Download).pdf",
      relicDetails: defaultRelicDetails(),
    });
    selectedKey = id;
    dirty = true;
    paintList();
    paintForm();
    setStatus("New entry — save to write file.", false);
  });

  btnDel.addEventListener("click", () => {
    if (!selectedKey) return;
    if (!window.confirm(`Delete birthright “${selectedKey}” from the draft (and file on save)?`)) return;
    delete draft[selectedKey];
    selectedKey = null;
    dirty = true;
    paintList();
    paintForm();
    setStatus("Entry removed from draft — save to persist.", false);
  });

  btnReload.addEventListener("click", async () => {
    if (dirty && !window.confirm("Discard unsaved changes and reload from server?")) return;
    await reloadBundle();
    const fresh = cloneBirthrights(getBundle()?.birthrights);
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
      setStatus("Missing _meta — refusing to save.", true);
      return;
    }
    for (const k of listKeys()) {
      draft[k] = ensureEntryShape(k, draft[k]);
      draft[k].id = k;
    }
    for (const k of Object.keys(draft)) {
      if (k.startsWith("_")) continue;
      if (!validEntryKey(k)) {
        setStatus(`Invalid key: ${k}`, true);
        return;
      }
    }
    try {
      const res = await fetch(apiUrl("api/data/birthrights"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
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
