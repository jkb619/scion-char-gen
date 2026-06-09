/**
 * Conflict detection for the Book Source Filter feature.
 *
 * Identifies character selections that would become orphaned when a book
 * is removed from the Allowed_Books_Set.
 */

/** Selection tables to scan for conflicts. */
const SELECTION_TABLES = ["boons", "knacks", "birthrights", "equipment", "purviews", "paths", "callings"];

/** Map table key → display type label (capitalized). */
const TABLE_TYPE_LABELS = {
  boons: "Boon",
  knacks: "Knack",
  birthrights: "Birthright",
  equipment: "Equipment",
  purviews: "Purview",
  paths: "Path",
  callings: "Calling",
};

/**
 * Character state field names that hold the selected IDs for each table.
 * The value for each table may be an array of string IDs or an array of
 * objects with an `id` field — both forms are handled.
 */
const CHARACTER_STATE_KEYS = {
  boons: "boonIds",
  knacks: "knackIds",
  birthrights: "birthrightIds",
  equipment: "sheetEquipmentIds",
  purviews: "purviewIds",
  paths: null,
  callings: null,
};

/**
 * Detect character selections that conflict with removing a book from the allowed set.
 *
 * @param {string} bookSlug - the book being removed
 * @param {object} characterState - current character selections
 * @param {object} bundle - full game data bundle (with `_sourceBookId` fields and `_sourceRegistry`)
 * @returns {Array<{type: string, name: string, id: string, bookTitle: string}>}
 */
export function detectConflicts(bookSlug, characterState, bundle) {
  if (!bookSlug || !characterState || !bundle) return [];

  const bookTitle = lookupBookTitle(bookSlug, bundle);
  const conflicts = [];

  for (const table of SELECTION_TABLES) {
    const selectedIds = getSelectedIds(table, characterState);
    const bundleTable = bundle[table];
    if (!bundleTable || typeof bundleTable !== "object") continue;

    for (const id of selectedIds) {
      const entry = bundleTable[id];
      if (!entry || typeof entry !== "object") continue;

      if (entryMatchesBook(entry, bookSlug)) {
        conflicts.push({
          type: TABLE_TYPE_LABELS[table] || table,
          name: entry.name || id,
          id,
          bookTitle,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Extract the list of selected IDs for a given table from character state.
 * Handles both arrays of string IDs and arrays of objects with `id` fields.
 *
 * @param {string} table - table key (e.g. "boons", "callings")
 * @param {object} characterState
 * @returns {string[]}
 */
function getSelectedIds(table, characterState) {
  // Special cases: callings and paths are stored differently
  if (table === "callings") {
    const callingId = characterState.callingId;
    if (typeof callingId === "string" && callingId.trim()) {
      const ids = [callingId.trim()];
      // Also check callingSlots for Hero three-row mode
      const slots = characterState.callingSlots;
      if (Array.isArray(slots)) {
        for (const slot of slots) {
          const sid = typeof slot === "object" && slot ? String(slot.id || "").trim() : "";
          if (sid && !ids.includes(sid)) ids.push(sid);
        }
      }
      return ids;
    }
    return [];
  }

  if (table === "paths") {
    // Paths aren't stored as IDs to a paths bundle table in the same way;
    // they use pathRank which maps rank names to path keys (origin/role/society).
    // No path IDs to resolve against the bundle.
    return [];
  }

  const stateKey = CHARACTER_STATE_KEYS[table];
  if (!stateKey) return [];

  const raw = characterState[stateKey];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && typeof item.id === "string") return item.id.trim();
      return "";
    })
    .filter((id) => id && !id.startsWith("_"));
}

/**
 * Check whether an entry's `_sourceBookId` matches the given book slug.
 *
 * @param {object} entry - a bundle entry with optional `_sourceBookId`
 * @param {string} bookSlug - the slug to match against
 * @returns {boolean}
 */
function entryMatchesBook(entry, bookSlug) {
  const sourceId = entry._sourceBookId;
  if (sourceId === undefined || sourceId === null) return false;
  if (Array.isArray(sourceId)) return sourceId.includes(bookSlug);
  return sourceId === bookSlug;
}

/**
 * Look up the human-readable book title from the bundle's `_sourceRegistry`.
 *
 * @param {string} bookSlug
 * @param {object} bundle
 * @returns {string}
 */
function lookupBookTitle(bookSlug, bundle) {
  const registry = bundle._sourceRegistry;
  if (Array.isArray(registry)) {
    const entry = registry.find((r) => r && r.slug === bookSlug);
    if (entry) return entry.title || bookSlug;
  }
  return bookSlug;
}
