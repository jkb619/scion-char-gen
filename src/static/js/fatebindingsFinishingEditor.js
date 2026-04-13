import {
  FATEBINDING_SHEET_SLOT_COUNT,
  coerceFatebindingsStoredList,
  persistFatebindingEditorRowFromDom,
} from "./fatebindingsSheet.js";

/**
 * Fatebindings block for Finishing (Scion, Sorcerer, Dragon Heir).
 * @param {HTMLElement} parent
 * @param {Record<string, unknown>} character
 * @param {{
 *   idPrefix: string;
 *   render: () => void;
 *   prepareState: () => void;
 *   trackHint?: string | null;
 * }} opts
 */
export function appendFatebindingsFinishingEditor(parent, character, opts) {
  const { idPrefix, render, prepareState, trackHint } = opts;
  character.finishing ||= {};
  prepareState();

  const fbSection = document.createElement("div");
  fbSection.className = "field fatebindings-editor";
  const fbHead = document.createElement("div");
  fbHead.className = "fatebindings-editor-head";
  const fbTitle = document.createElement("h2");
  fbTitle.className = "fatebindings-editor-title";
  fbTitle.textContent = "Fatebindings";
  const fbHelp = document.createElement("span");
  fbHelp.className = "help fatebindings-editor-help";
  fbHelp.textContent = `Up to ${FATEBINDING_SHEET_SLOT_COUNT} bindings.`;
  fbHead.appendChild(fbTitle);
  fbHead.appendChild(fbHelp);
  fbSection.appendChild(fbHead);
  if (trackHint) {
    const hint = document.createElement("p");
    hint.className = "help fatebindings-track-hint";
    hint.textContent = trackHint;
    fbSection.appendChild(hint);
  }

  const fbList = /** @type {{ name: string; strength: string; story: string }[]} */ (character.fatebindings);
  let fbIdx = Math.min(
    Math.max(0, Math.round(Number(/** @type {{ fatebindingEditorIndex?: number }} */ (character.finishing).fatebindingEditorIndex) || 0)),
    Math.max(0, fbList.length - 1),
  );
  if (!fbList.length) fbIdx = 0;
  character.finishing.fatebindingEditorIndex = fbIdx;

  const nav = document.createElement("div");
  nav.className = "fatebinding-editor-nav";
  const counter = document.createElement("span");
  counter.className = "fatebinding-editor-counter muted";
  counter.textContent = fbList.length ? `Binding ${fbIdx + 1} of ${fbList.length}` : "No bindings yet";
  const btnPrev = document.createElement("button");
  btnPrev.type = "button";
  btnPrev.className = "btn secondary";
  btnPrev.textContent = "Previous";
  btnPrev.disabled = fbList.length <= 1 || fbIdx <= 0;
  btnPrev.addEventListener("click", () => {
    persistFatebindingEditorRowFromDom(character, idPrefix);
    const i = character.finishing.fatebindingEditorIndex;
    character.finishing.fatebindingEditorIndex = Math.max(0, i - 1);
    render();
  });
  const btnNext = document.createElement("button");
  btnNext.type = "button";
  btnNext.className = "btn secondary";
  btnNext.textContent = "Next";
  btnNext.disabled = fbList.length <= 1 || fbIdx >= fbList.length - 1;
  btnNext.addEventListener("click", () => {
    persistFatebindingEditorRowFromDom(character, idPrefix);
    const i = character.finishing.fatebindingEditorIndex;
    character.finishing.fatebindingEditorIndex = Math.min(character.fatebindings.length - 1, i + 1);
    render();
  });
  const btnAdd = document.createElement("button");
  btnAdd.type = "button";
  btnAdd.className = "btn secondary";
  btnAdd.textContent = "Add";
  btnAdd.disabled = fbList.length >= FATEBINDING_SHEET_SLOT_COUNT;
  btnAdd.title =
    fbList.length >= FATEBINDING_SHEET_SLOT_COUNT
      ? `At most ${FATEBINDING_SHEET_SLOT_COUNT} fatebindings.`
      : fbList.length
        ? "Add another fatebinding"
        : "Add a fatebinding";
  btnAdd.addEventListener("click", () => {
    persistFatebindingEditorRowFromDom(character, idPrefix);
    if (character.fatebindings.length >= FATEBINDING_SHEET_SLOT_COUNT) return;
    character.fatebindings = coerceFatebindingsStoredList([
      ...character.fatebindings,
      { name: "", strength: "", story: "" },
    ]);
    character.finishing.fatebindingEditorIndex = character.fatebindings.length - 1;
    render();
  });
  const btnDel = document.createElement("button");
  btnDel.type = "button";
  btnDel.className = "btn secondary";
  btnDel.textContent = "Delete";
  btnDel.disabled = fbList.length === 0;
  btnDel.addEventListener("click", () => {
    persistFatebindingEditorRowFromDom(character, idPrefix);
    if (!character.fatebindings.length) return;
    const delIdx = Math.min(
      Math.max(0, Math.round(Number(character.finishing.fatebindingEditorIndex) || 0)),
      character.fatebindings.length - 1,
    );
    const next = character.fatebindings.slice();
    next.splice(delIdx, 1);
    character.fatebindings = coerceFatebindingsStoredList(next);
    character.finishing.fatebindingEditorIndex =
      character.fatebindings.length === 0 ? 0 : Math.min(delIdx, character.fatebindings.length - 1);
    render();
  });
  nav.appendChild(counter);
  if (fbList.length > 0) {
    nav.appendChild(btnPrev);
    nav.appendChild(btnNext);
  }
  nav.appendChild(btnAdd);
  if (fbList.length > 0) {
    nav.appendChild(btnDel);
  }
  fbSection.appendChild(nav);

  if (!fbList.length) {
    const emptyHint = document.createElement("p");
    emptyHint.className = "help fatebinding-empty-hint";
    emptyHint.textContent = "Click Add to create a fatebinding.";
    fbSection.appendChild(emptyHint);
    parent.appendChild(fbSection);
    return;
  }

  const idName = `${idPrefix}-name`;
  const idStr = `${idPrefix}-strength`;
  const idStory = `${idPrefix}-story`;

  const card = document.createElement("div");
  card.className = "fatebinding-single-card";
  const row = fbList[fbIdx];
  const nameLine = document.createElement("div");
  nameLine.className = "fatebinding-line fatebinding-line--inline";
  const nameLab = document.createElement("label");
  nameLab.htmlFor = idName;
  nameLab.textContent = "Name";
  const nameIn = document.createElement("input");
  nameIn.type = "text";
  nameIn.id = idName;
  nameIn.autocomplete = "off";
  nameIn.value = row.name;
  nameLine.appendChild(nameLab);
  nameLine.appendChild(nameIn);
  const strLine = document.createElement("div");
  strLine.className = "fatebinding-line fatebinding-line--strength";
  const strLab = document.createElement("label");
  strLab.htmlFor = idStr;
  strLab.textContent = "Strength";
  const strIn = document.createElement("input");
  strIn.type = "text";
  strIn.id = idStr;
  strIn.autocomplete = "off";
  strIn.placeholder = "e.g. 2";
  strIn.value = row.strength;
  strLine.appendChild(strLab);
  strLine.appendChild(strIn);
  const storyBlock = document.createElement("div");
  storyBlock.className = "field fatebinding-story-block";
  const storyLab = document.createElement("label");
  storyLab.htmlFor = idStory;
  storyLab.textContent = "Story";
  const storyTa = document.createElement("textarea");
  storyTa.id = idStory;
  storyTa.rows = 3;
  storyTa.placeholder = "Role, relationship, hooks…";
  storyTa.value = row.story;
  storyBlock.appendChild(storyLab);
  storyBlock.appendChild(storyTa);
  card.appendChild(nameLine);
  card.appendChild(strLine);
  card.appendChild(storyBlock);
  fbSection.appendChild(card);
  const syncFb = () => {
    prepareState();
    persistFatebindingEditorRowFromDom(character, idPrefix);
  };
  nameIn.addEventListener("input", syncFb);
  strIn.addEventListener("input", syncFb);
  storyTa.addEventListener("input", syncFb);
  parent.appendChild(fbSection);
}
