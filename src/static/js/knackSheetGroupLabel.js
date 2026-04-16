import { purviewDisplayNameForPantheon } from "./purviewDisplayName.js";

/**
 * Short label for the character sheet: where the Knack is grouped in the books.
 * Uses game Purview display names when `purviewAnyOf` gates the Knack; otherwise
 * Calling display name(s); `"general"` for any-Calling / undifferentiated lists
 * (e.g. Pandora’s Box general Heroic Knacks).
 *
 * @param {Record<string, unknown> | null | undefined} k
 * @param {{ callings?: Record<string, Record<string, unknown>>; purviews?: Record<string, unknown> }} bundle
 * @param {string} [pantheonId]
 * @returns {string}
 */
export function knackSheetGroupLabel(k, bundle, pantheonId) {
  if (!k || typeof k !== "object") return "general";
  const pant = String(pantheonId ?? "").trim();

  const pvAny = k.purviewAnyOf;
  if (Array.isArray(pvAny) && pvAny.length) {
    const names = [];
    const seen = new Set();
    for (const raw of pvAny) {
      if (typeof raw !== "string") continue;
      const id = raw.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const lab = purviewDisplayNameForPantheon(id, bundle, pant);
      if (lab) names.push(lab);
    }
    if (names.length) return names.join(", ");
  }

  if (k.callingsAny === true || k.calling === "any") return "general";

  const list = Array.isArray(k.callings) ? k.callings : null;
  const callings =
    list && list.length
      ? list.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim())
      : typeof k.calling === "string" && k.calling.trim() && k.calling.trim() !== "any"
        ? [k.calling.trim()]
        : [];

  if (callings.length === 0) return "general";
  if (callings.length === 1) {
    const cid = callings[0];
    const row = bundle?.callings?.[cid];
    const nm = row && typeof row === "object" && typeof row.name === "string" ? row.name.trim() : "";
    return nm || cid;
  }
  return callings
    .map((cid) => {
      const row = bundle?.callings?.[cid];
      const nm = row && typeof row === "object" && typeof row.name === "string" ? row.name.trim() : "";
      return nm || cid;
    })
    .join(", ");
}
