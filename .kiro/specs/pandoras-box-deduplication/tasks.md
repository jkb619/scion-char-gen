# Implementation Plan: Pandora's Box Deduplication

## Overview

Extend `src/scripts/merge_engine.py` with deduplication logic that detects entries sharing the same `id` across Pandora's Box fragments and other source book fragments. When a duplicate is detected, the non-Pandora's Box entry is canonical and the `source` fields are merged. All changes are internal to `merge_engine.py` plus new test files; the public API is unchanged.

## Tasks

- [x] 1. Implement fragment classification and source merging helpers
  - [x] 1.1 Implement `_is_pandoras_box_fragment` function
    - Add a new internal function to `src/scripts/merge_engine.py` that determines if a fragment is from Pandora's Box
    - Return True if the filename contains "Pandoras_Box" (case-insensitive) OR `_meta.bookSlug` equals `"pandoras_box"`
    - Handle edge cases: None meta, malformed meta (not a dict), missing bookSlug key
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.2 Implement `_merge_source_fields` function
    - Add a new internal function to `src/scripts/merge_engine.py` that merges source fields from multiple entries
    - Non-PB sources appear first (in fragment sort order), PB sources last
    - Separator is `, ` (comma + space)
    - Handle missing `source` field by using empty string `""`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.3 Implement `_resolve_duplicates` function
    - Add a new internal function to `src/scripts/merge_engine.py` that resolves duplicate entries
    - For PB vs non-PB duplicates: select last non-PB entry as canonical, call `_merge_source_fields` for the source field
    - For non-PB vs non-PB duplicates: last-sorted fragment's entry wins (existing behavior)
    - For PB-only duplicates: last-sorted fragment's entry wins
    - Return tuple of (resolved entries dict, deduplicated IDs list)
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3_

- [x] 2. Modify `_merge_fragments` to use deduplication
  - [x] 2.1 Refactor `_merge_fragments` to collect entries with origin metadata
    - Replace direct dict merge with a two-pass approach
    - First pass: read all fragments, classify as PB/non-PB, collect entries into `entries_by_id: dict[str, list[tuple[dict, bool, str]]]`
    - Each entry is tagged with (entry_dict, is_pb, filename)
    - Preserve existing `_meta` accumulation and `frag_names` tracking
    - _Requirements: 1.1, 1.2, 4.1, 4.2, 4.3_

  - [x] 2.2 Integrate `_resolve_duplicates` into `_merge_fragments`
    - Second pass: call `_resolve_duplicates` on the accumulated entries
    - Use resolved entries dict to assemble the final sorted output
    - Add `deduplicatedCount` and `deduplicatedIds` (sorted) to the `_meta` block
    - Only add dedup stats when at least one deduplication occurred
    - Ensure non-duplicate PB entries are preserved unchanged
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.3, 7.1, 7.3_

- [x] 3. Checkpoint - Verify core logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Write unit tests for deduplication
  - [x] 4.1 Create `tests/test_parser_framework/test_dedup_merge.py` with unit tests
    - Test PB vs non-PB deduplication selects non-PB as canonical
    - Test source field merging with two sources
    - Test source field merging with three+ sources (multiple non-PB + PB)
    - Test non-PB vs non-PB last-wins behavior is preserved
    - Test unique PB entries (no duplicate) are preserved unchanged
    - Test empty/missing source field handling (empty string fallback)
    - Test fragment identification by filename pattern ("Pandoras_Box" case-insensitive)
    - Test fragment identification by `_meta.bookSlug` only (filename doesn't match)
    - Test `deduplicatedCount` and `deduplicatedIds` in output `_meta`
    - Test integration with `merge_boon_catalog` and `merge_table_fragments` public API
    - Test deterministic output: same input produces byte-identical result
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1, 6.2, 6.3, 7.1, 7.3_

- [x] 5. Write property-based tests for deduplication
  - [x] 5.1 Write property test for canonical entry field preservation
    - **Property 1: Canonical Entry Field Preservation**
    - Generate fragment sets with PB and non-PB fragments sharing entry IDs
    - Assert all fields (except `source`) match the last-sorted non-PB entry
    - **Validates: Requirements 1.3, 2.1, 2.2, 2.3**

  - [x] 5.2 Write property test for non-PB duplicate last-wins preserved
    - **Property 2: Non-PB Duplicate Last-Wins Preserved**
    - Generate fragment sets with only non-PB fragments sharing entry IDs
    - Assert merged entry matches last-sorted fragment's entry (all fields)
    - **Validates: Requirements 1.4**

  - [x] 5.3 Write property test for source field merging order
    - **Property 3: Source Field Merging Order**
    - Generate N fragments (at least one PB, at least one non-PB) sharing an entry ID
    - Assert merged source is comma-space separated with non-PB sources first, PB last
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 5.4 Write property test for Pandora's Box fragment classification
    - **Property 4: Pandora's Box Fragment Classification**
    - Generate filenames with/without "Pandoras_Box" and meta with/without bookSlug
    - Assert classification returns True iff filename matches OR bookSlug matches
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 5.5 Write property test for unique PB entry preservation
    - **Property 5: Unique Pandora's Box Entry Preservation**
    - Generate PB entries with unique IDs not present in other fragments
    - Assert those entries appear in output with all fields unchanged
    - **Validates: Requirements 5.1, 5.2**

  - [x] 5.6 Write property test for deterministic sorted output
    - **Property 6: Deterministic Sorted Output**
    - Generate arbitrary fragment sets, run merge twice
    - Assert byte-identical JSON output and sorted non-meta keys
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 5.7 Write property test for deduplication reporting accuracy
    - **Property 7: Deduplication Reporting Accuracy**
    - Generate fragment sets with known PB duplicates
    - Assert `_meta.deduplicatedCount` equals number of PB duplicates resolved
    - Assert `_meta.deduplicatedIds` contains exactly those IDs in sorted order
    - **Validates: Requirements 7.1, 7.3**

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All implementation is within `src/scripts/merge_engine.py` — no new modules needed
- Test file locations follow design spec: `tests/test_parser_framework/test_dedup_merge.py` (unit) and `tests/test_parser_framework/test_dedup_properties.py` (property)
- Property tests use Hypothesis (already a project dependency)
- The public API (`merge_boon_catalog`, `merge_table_fragments`) is unchanged
- Existing `tests/test_parser_framework/test_merge_engine.py` covers pre-existing behavior and should continue to pass

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"] }
  ]
}
```
