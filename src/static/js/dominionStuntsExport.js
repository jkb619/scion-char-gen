/**
 * Dominion Stunt reference rows for Review JSON / sheet (Demigod+).
 * Shown only after at least one Purview is marked with a Dominion Boon (`dominionBoonPurviewIds`).
 */

import { mergedPurviewIdsForSheet, purviewDisplayNameForPantheon } from "./purviewDisplayName.js";
import { formatGameDataSourceForDisplay } from "./sourceDisplayForUi.js";

export const DOMINION_STUNT_TIER_IDS = new Set(["demigod", "god", "sorcerer_demigod", "sorcerer_god"]);

/** @param {string | undefined} tierId */
export function tierSupportsDominionStunts(tierId) {
  const t = String(tierId ?? "")
    .trim()
    .toLowerCase();
  const norm = t === "origin" ? "mortal" : t;
  return DOMINION_STUNT_TIER_IDS.has(norm);
}

/**
 * @param {{ dominionStunts?: Record<string, Record<string, unknown>> }} bundle
 * @returns {Map<string, Record<string, unknown>[]>}
 */
export function dominionStuntsGroupedByPurview(bundle) {
  const map = new Map();
  for (const [sid, row] of Object.entries(bundle?.dominionStunts || {})) {
    if (sid.startsWith("_") || !row || typeof row !== "object") continue;
    const pv = String(row.purview || "_general").trim() || "_general";
    if (!map.has(pv)) map.set(pv, []);
    map.get(pv).push({ id: sid, ...row });
  }
  for (const rows of map.values()) {
    rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }
  return map;
}

/**
 * Purview keys whose Dominion Stunt lists appear (wizard + Review).
 * Requires at least one Dominion Boon mark; per-Purview lists only for marked ids.
 * @param {Record<string, unknown>} data — export slice or character fields
 * @param {{ purviews?: Record<string, { name?: string }> }} [bundle] — for display-name sort order
 */
export function dominionStuntPurviewKeysForExport(data, bundle) {
  if (!tierSupportsDominionStunts(String(data.tier ?? data.tierId ?? ""))) return [];
  const dominionMarked = new Set(
    (Array.isArray(data.dominionBoonPurviewIds) ? data.dominionBoonPurviewIds : []).filter(
      (id) => typeof id === "string" && id.trim(),
    ),
  );
  if (dominionMarked.size === 0) return [];
  const held = new Set(mergedPurviewIdsForSheet(data));
  const markedHeld = [...dominionMarked].filter((pid) => held.has(pid));
  if (markedHeld.length === 0) return [];
  if (bundle && typeof bundle === "object") {
    markedHeld.sort((a, b) =>
      purviewDisplayNameForPantheon(a, bundle, data.pantheonId).localeCompare(
        purviewDisplayNameForPantheon(b, bundle, data.pantheonId),
      ),
    );
  } else {
    markedHeld.sort();
  }
  return ["_general", ...markedHeld];
}

/**
 * @typedef {{ id: string; name: string; purviewId: string; purviewName: string; successCost: string; description: string; source: string }} DominionStuntExportRow
 * @typedef {{ purviewId: string; purviewName: string; stunts: DominionStuntExportRow[] }} DominionStuntExportGroup
 */

/**
 * @param {Record<string, unknown>} data
 * @param {{ dominionStunts?: Record<string, Record<string, unknown>>; purviews?: Record<string, { name?: string }> }} bundle
 * @returns {{ groups: DominionStuntExportGroup[]; flat: DominionStuntExportRow[] }}
 */
export function buildDominionStuntExportPayload(data, bundle) {
  const keys = dominionStuntPurviewKeysForExport(data, bundle);
  if (!keys.length) return { groups: [], flat: [] };
  const grouped = dominionStuntsGroupedByPurview(bundle);
  /** @type {DominionStuntExportGroup[]} */
  const groups = [];
  /** @type {DominionStuntExportRow[]} */
  const flat = [];
  for (const pvKey of keys) {
    const rows = grouped.get(pvKey);
    if (!rows || rows.length === 0) continue;
    const purviewName =
      pvKey === "_general"
        ? "General"
        : purviewDisplayNameForPantheon(pvKey, bundle, data.pantheonId);
    /** @type {DominionStuntExportRow[]} */
    const stunts = rows.map((r) => {
      const row = {
        id: String(r.id ?? "").trim(),
        name: String(r.name ?? r.id ?? "").trim(),
        purviewId: pvKey === "_general" ? "_general" : pvKey,
        purviewName,
        successCost: String(r.successCost ?? "").trim(),
        description: String(r.description ?? "").trim(),
        source: formatGameDataSourceForDisplay(String(r.source ?? "").trim()),
      };
      flat.push(row);
      return row;
    });
    groups.push({ purviewId: pvKey === "_general" ? "_general" : pvKey, purviewName, stunts });
  }
  return { groups, flat };
}

/**
 * @param {{ tier?: string; pantheonId?: string; purviewIds?: string[]; patronPurviewSlots?: string[]; dominionBoonPurviewIds?: string[] }} character
 * @param {{ dominionStunts?: Record<string, Record<string, unknown>>; purviews?: Record<string, { name?: string }> }} bundle
 */
export function buildDominionStuntExportFromCharacter(character, bundle) {
  return buildDominionStuntExportPayload(
    {
      tier: character.tier,
      tierId: character.tier,
      pantheonId: character.pantheonId,
      purviews: character.purviewIds,
      patronPurviewSlots: character.patronPurviewSlots,
      dominionBoonPurviewIds: character.dominionBoonPurviewIds,
    },
    bundle,
  );
}
