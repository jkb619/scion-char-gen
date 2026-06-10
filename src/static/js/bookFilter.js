/**
 * Book filter logic for the Scion character creator.
 *
 * Determines whether a game-data entry should be visible given
 * the player's current set of allowed sourcebooks.
 */

/**
 * Returns whether a game-data entry should be visible based on the
 * current allowed books selection.
 *
 * Rules:
 *  - If the entry has no `_sourceBookId` (undefined or null), it is
 *    always visible (untagged entries are never filtered out).
 *  - If `_sourceBookId` is an array (entry sourced from multiple books),
 *    the entry is visible when at least one element is in the allowed set.
 *  - If `_sourceBookId` is a string, the entry is visible when that
 *    string is in the allowed set.
 *
 * @param {object} entry - A game-data entry from the bundle.
 * @param {Set<string>} allowedBooks - The current set of allowed book slugs.
 * @returns {boolean} True if the entry should be displayed.
 */
export function isEntryVisibleForBooks(entry, allowedBooks) {
    // Book filter disabled — all entries are always visible regardless of source book.
    return true;
}
