/**
 * Extended sheet notes for Finishing — title row + textarea (shared across chargen lines).
 * @param {HTMLElement} parent
 * @param {Record<string, unknown>} character
 * @param {{ textareaId: string; onInput?: () => void }} opts
 */
export function appendFinishingExtendedNotesPanel(parent, character, opts) {
  const { textareaId, onInput } = opts;
  if (character.sheetNotesExtra == null) character.sheetNotesExtra = "";

  const wrap = document.createElement("div");
  wrap.className = "field fatebindings-editor finishing-extended-notes-editor";
  const head = document.createElement("div");
  head.className = "fatebindings-editor-head";
  const title = document.createElement("h2");
  title.className = "fatebindings-editor-title";
  title.textContent = "Extended session / chronicle notes";
  head.appendChild(title);
  wrap.appendChild(head);

  const ta = document.createElement("textarea");
  ta.id = textareaId;
  ta.className = "finishing-extended-notes-textarea";
  ta.rows = 8;
  ta.placeholder = "Session recap, chronicle details, table-facing extras…";
  ta.autocomplete = "off";
  ta.setAttribute("aria-label", "Extended session / chronicle notes");
  ta.value = String(character.sheetNotesExtra || "");
  ta.addEventListener("input", () => {
    character.sheetNotesExtra = ta.value;
    if (typeof onInput === "function") onInput();
  });
  wrap.appendChild(ta);
  parent.appendChild(wrap);
}
