/** Browser-local character save (Review → Welcome load). */

export const CHARACTER_SAVE_STORAGE_KEY = "scion-character-creator-save-v1";

/**
 * @param {{ exportObj: Record<string, unknown>; stepIndex: number; allowedBooks: Iterable<string> }} opts
 * @returns {Record<string, unknown>}
 */
export function buildSavePayload({ exportObj, stepIndex, allowedBooks }) {
  return {
    saveVersion: 1,
    savedAt: new Date().toISOString(),
    stepIndex: Math.max(0, Math.round(Number(stepIndex) || 0)),
    allowedBooks: [...allowedBooks],
    character: exportObj,
  };
}

/**
 * Accepts a wrapped save payload or a raw export object.
 * @param {unknown} raw
 * @returns {{
 *   characterData: Record<string, unknown>;
 *   stepIndex: number;
 *   allowedBooks: string[] | null;
 *   savedAt: string | null;
 * }}
 */
export function parseSavePayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid save: expected a JSON object");
  }
  const obj = /** @type {Record<string, unknown>} */ (raw);
  if (obj.saveVersion === 1 && obj.character && typeof obj.character === "object") {
    return {
      characterData: /** @type {Record<string, unknown>} */ (obj.character),
      stepIndex: Math.max(0, Math.round(Number(obj.stepIndex) || 0)),
      allowedBooks: Array.isArray(obj.allowedBooks)
        ? obj.allowedBooks.filter((s) => typeof s === "string" && s.trim())
        : null,
      savedAt: typeof obj.savedAt === "string" && obj.savedAt.trim() ? obj.savedAt.trim() : null,
    };
  }
  return {
    characterData: obj,
    stepIndex: Math.max(0, Math.round(Number(obj.stepIndex) || 0)),
    allowedBooks: Array.isArray(obj.allowedBooks)
      ? obj.allowedBooks.filter((s) => typeof s === "string" && s.trim())
      : null,
    savedAt: typeof obj.savedAt === "string" && obj.savedAt.trim() ? obj.savedAt.trim() : null,
  };
}

/**
 * @param {string} json
 * @returns {boolean}
 */
export function saveCharacterJsonToLocalStorage(json) {
  try {
    localStorage.setItem(CHARACTER_SAVE_STORAGE_KEY, json);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

/**
 * @returns {string | null}
 */
export function loadCharacterJsonFromLocalStorage() {
  try {
    const raw = localStorage.getItem(CHARACTER_SAVE_STORAGE_KEY);
    return raw && raw.trim() ? raw : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {{ savedAt: string | null; characterName: string; tierLabel: string; stepIndex: number } | null}
 */
export function summarizeSavePayload(payload) {
  try {
    const parsed = parseSavePayload(payload);
    const data = parsed.characterData;
    const name = String(data.characterName ?? "").trim() || "Unnamed character";
    const tier =
      String(data.tierName ?? "").trim() ||
      String(data.tier ?? data.tierId ?? "").trim() ||
      "—";
    return {
      savedAt: parsed.savedAt,
      characterName: name,
      tierLabel: tier,
      stepIndex: parsed.stepIndex,
    };
  } catch {
    return null;
  }
}

/**
 * @returns {{ savedAt: string | null; characterName: string; tierLabel: string; stepIndex: number } | null}
 */
export function summarizeLocalSave() {
  const json = loadCharacterJsonFromLocalStorage();
  if (!json) return null;
  try {
    return summarizeSavePayload(JSON.parse(json));
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} [downloadBase]
 */
export function downloadCharacterSaveJson(payload, downloadBase = "scion-character") {
  const safe = String(downloadBase)
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe || "scion-character"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
