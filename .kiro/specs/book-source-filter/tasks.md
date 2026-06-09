# Implementation Plan: Book Source Filter

## Overview

Implement per-sourcebook filtering for the Scion character creator. The feature spans the Python/FastAPI backend (source registry, tag resolver, bundle augmentation), character state persistence (allowedBooks array in JSON), and vanilla JS frontend (checkbox panel, filter function, conflict modal). Tasks are ordered so that backend data layers are built first, then frontend filtering logic, then UI integration and conflict handling.

## Tasks

- [x] 1. Implement SourceRegistry with auto-discovery
  - [x] 1.1 Create `src/app/services/source_registry.py` with `BookEntry` dataclass and `SourceRegistry` class
    - Define the `BookEntry` frozen dataclass with `slug`, `title`, and `pdf_patterns` fields
    - Implement hardcoded `CORE_BOOKS` list covering all 20+ core/legacy books per the design's Core Books table
    - Implement `__init__` that scans `src/data/books/*.json`, reads `_meta.slug` and `_meta.title`, and builds entries
    - Handle malformed files: skip and emit `warnings.warn()` without crashing
    - Expose `entries` property (slug → BookEntry dict), `slug_for_pdf()`, `slug_for_title_substring()`, and `titles_sorted()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Write property test for registry auto-discovery
    - **Property 1: Registry Auto-Discovery**
    - Test that for any valid book JSON dict with `_meta.slug` and `_meta.title`, the registry includes that slug after construction
    - Use Hypothesis strategies to generate random valid `_meta` dicts and write them to a temp directory
    - **Validates: Requirements 1.2**

  - [x] 1.3 Write unit tests for SourceRegistry
    - Test that all 20+ core books are present in the registry
    - Test that real `src/data/books/*.json` files are discovered
    - Test that malformed files are skipped with a warning
    - _Requirements: 1.1, 1.4_

- [x] 2. Implement SourceTagResolver
  - [x] 2.1 Create `src/app/services/source_tag_resolver.py` with `SourceTagResolver` class
    - Implement `resolve(source_tag: str) -> list[str]` that splits on semicolons and resolves each segment
    - Implement `resolve_single(segment: str) -> str | None` with priority: exact slug match → PDF filename extraction → longest substring title match
    - All comparisons case-insensitive
    - PDF filename extraction: strip trailing page refs like ` p.26`, match against `pdf_patterns`
    - Longest title match: when multiple titles are substrings, pick the longest one
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 2.2 Write property test for deterministic resolution
    - **Property 8: Deterministic Source Tag Resolution**
    - Test that calling `resolve_single` twice on the same input always produces the same result
    - Test that exact slug match takes priority over substring match
    - Test case-insensitivity and longest-match wins
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 2.3 Write property test for semicolon segment independence
    - **Property 9: Semicolon Segment Independence**
    - Test that `resolve("A;B")` equals `resolve_single("A") + resolve_single("B")` for any segments A, B
    - **Validates: Requirements 6.4**

  - [x] 2.4 Write property test for resolution bounds
    - **Property 10: Resolution Bounds**
    - Test that `resolve_single` returns at most one identifier for any input
    - Test that unresolvable segments return None
    - **Validates: Requirements 6.5, 6.6**

- [x] 3. Implement bundle augmentation with `_sourceBookId` stamping
  - [x] 3.1 Add `_augment_source_book_ids()` function in `src/app/services/game_data.py`
    - Iterate over AUGMENTABLE_TABLES (equipment, tags, birthrights, boons, knacks, purviews, callings, paths)
    - For entries with `sourceBook` slug matching registry: set `_sourceBookId` directly
    - For entries with `source` field but no valid `sourceBook`: resolve via SourceTagResolver
    - Set `_sourceBookId` as string (single match), array (multiple matches), or omit entirely (no match)
    - Call augmentation after all merges in `load_bundle()` are complete
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 3.2 Wire SourceRegistry and SourceTagResolver into `game_data.py` initialization
    - Instantiate `SourceRegistry` with the `src/data/books/` directory path
    - Instantiate `SourceTagResolver` with the registry
    - Call `_augment_source_book_ids(bundle, registry, resolver)` at end of `load_bundle()`
    - _Requirements: 7.6_

  - [x] 3.3 Write property test for bundle augmentation correctness
    - **Property 11: Bundle Augmentation Correctness**
    - Test all four cases: (a) valid sourceBook slug → _sourceBookId equals slug, (b) source resolves to one slug → _sourceBookId is that slug, (c) source resolves to multiple → _sourceBookId is array, (d) no resolution → field absent
    - Use Hypothesis to generate random entries with varying source/sourceBook fields
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [x] 4. Expose source registry via API
  - [x] 4.1 Add `_sourceRegistry` key to the `/api/bundle` response payload
    - Include `[{slug, title}, ...]` sorted alphabetically by title in the existing bundle endpoint response
    - Alternatively add a dedicated `/api/source-registry` GET endpoint if bundle size is a concern
    - _Requirements: 1.1, 1.3_

- [x] 5. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement frontend filter logic
  - [x] 6.1 Create `src/static/js/bookFilter.js` with `isEntryVisibleForBooks(entry, allowedBooks)` function
    - Return `true` if `_sourceBookId` is undefined/null (untagged entries always visible)
    - If `_sourceBookId` is an array, return `true` if any element is in allowedBooks set
    - If `_sourceBookId` is a string, return `true` if it's in allowedBooks set
    - Export as ES module function
    - _Requirements: 3.4, 3.5_

  - [x] 6.2 Write property test for filter visibility (Python model)
    - **Property 3: Filter Visibility**
    - Model the `isEntryVisibleForBooks` logic in Python
    - Test that visibility matches the three-case rule: no `_sourceBookId` → visible, string → member check, array → any-member check
    - **Validates: Requirements 3.1, 3.4, 3.5**

  - [x] 6.3 Create `src/static/js/bookConflictDetection.js` with `detectConflicts(bookSlug, characterState, bundle)` function
    - Scan all character selection arrays (boons, knacks, birthrights, equipment, purviews, paths, callings)
    - For each selected option, look up its `_sourceBookId` in the bundle
    - Return array of `{type, name, id, bookTitle}` objects for entries matching the removed book
    - _Requirements: 5.1, 5.3_

  - [x] 6.4 Write property test for conflict detection accuracy (Python model)
    - **Property 6: Conflict Detection Accuracy**
    - Model the conflict detection in Python
    - Test that detected conflicts exactly equal the subset of selections whose `_sourceBookId` matches the removed book
    - Test that an empty set is returned when no selections use that book
    - **Validates: Requirements 5.1, 5.3**

- [x] 7. Implement BookSourceFilterPanel UI
  - [x] 7.1 Create `src/static/js/bookSourceFilter.js` with panel rendering and toggle logic
    - Render a `<details>` collapsible element with one `<input type="checkbox">` per registry entry, sorted alphabetically by title
    - Implement `createBookSourceFilterPanel(registry, allowedBooks, onChange)` function
    - Implement `selectAll(panel, allowedBooks, onChange)` and `deselectAll(panel, allowedBooks, onChange)` helpers
    - Dispatch `book-filter-changed` custom event on `document` when toggles occur
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.9_

  - [x] 7.2 Write property test for toggle round-trip (Python model)
    - **Property 2: Toggle Round-Trip**
    - Model the toggle logic in Python: removing then re-adding a slug returns the set to its original state
    - **Validates: Requirements 2.3, 2.4**

  - [x] 7.3 Integrate panel into the chargen wizard toolbar
    - Mount the panel in the wizard layout so it's accessible from any step without navigation
    - Ensure toggling doesn't cause page reload or loss of unsaved form input
    - _Requirements: 2.7, 2.9_

- [x] 8. Wire filter to all pickers
  - [x] 8.1 Apply `isEntryVisibleForBooks` to all picker rendering paths
    - Listen for `book-filter-changed` event on `document`
    - Re-filter visible entries in purview, boon, knack, birthright, equipment, path, calling, and pantheon pickers
    - Ensure filtering completes within the same render cycle (no page rebuild)
    - Show disabled state with "no entries available" message when filter reduces picker to zero entries
    - _Requirements: 3.1, 3.2, 3.6_

  - [x] 8.2 Apply filter on wizard step navigation
    - When user navigates to a new step, apply current allowedBooks filter before pickers become interactive
    - Preserve scroll position when filter changes
    - _Requirements: 3.3_

- [x] 9. Implement conflict warning modal and state management
  - [x] 9.1 Create `src/static/js/bookConflictModal.js` with modal rendering
    - Display modal listing affected selections formatted as "Type: Name — Book Title" grouped by type
    - Include Confirm and Cancel buttons
    - Block wizard interaction while modal is displayed
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 9.2 Wire conflict flow into panel toggle logic
    - On uncheck: call `detectConflicts()` first
    - If conflicts exist: show modal, keep book in allowedBooks until user confirms
    - On Confirm: remove all conflicting selections from character state, then remove book from allowedBooks
    - On Cancel: re-check the checkbox, leave state unchanged
    - If no conflicts: immediately remove book from allowedBooks
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

  - [x] 9.3 Write property test for confirmed removal clears conflicts (Python model)
    - **Property 7: Confirmed Removal Clears Conflicts**
    - Model the confirm-removal flow in Python
    - Test that after confirmation, no selection with `_sourceBookId` equal to the removed book remains, and the book is not in allowedBooks
    - **Validates: Requirements 5.5**

- [x] 10. Implement character state persistence for allowedBooks
  - [x] 10.1 Add `allowedBooks` array to character state and JSON export/import
    - Store allowedBooks as array of slug strings alongside other wizard state
    - Include allowedBooks in JSON export payload
    - On import: restore allowedBooks from payload, discard unknown slugs, apply filter before render
    - If field absent on import: default all books enabled
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 10.2 Write property test for export/import round-trip (Python model)
    - **Property 4: Export/Import Round-Trip**
    - Test that for any allowedBooks subset of registry slugs, export then import restores the identical set
    - **Validates: Requirements 4.2, 4.3**

  - [x] 10.3 Write property test for unknown identifiers discarded on import (Python model)
    - **Property 5: Unknown Identifiers Discarded on Import**
    - Test that imported arrays with unknown slugs have those entries removed, keeping only valid ones
    - **Validates: Requirements 4.5**

- [x] 11. Initialize filter state on wizard load
  - [x] 11.1 Wire allowedBooks initialization into wizard startup
    - On load with existing character: read `allowedBooks` from state, populate panel checkboxes, apply filter
    - On load with new character (no `allowedBooks`): default all books enabled, all checkboxes checked
    - Handle default-all-enabled for characters with `allowedBooks: null` or missing field
    - _Requirements: 2.2, 4.4_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using Hypothesis (`@settings(max_examples=200)`)
- Python-side property tests model the frontend logic (filter visibility, toggle round-trip, conflict detection) since the frontend has no test runner
- Backend tasks (1–5) are independent of frontend tasks (6–11), but frontend depends on the `_sourceBookId` field being present in bundle data
- The `book-filter-changed` custom event decouples the panel from individual pickers

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["6.1", "6.3"] },
    { "id": 6, "tasks": ["6.2", "6.4", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "8.1", "9.1"] },
    { "id": 8, "tasks": ["8.2", "9.2", "10.1"] },
    { "id": 9, "tasks": ["9.3", "10.2", "10.3", "11.1"] }
  ]
}
```
