"""Property-based tests for bundle augmentation correctness.

# Feature: book-source-filter, Property 11: Bundle Augmentation Correctness

Tests that _augment_source_book_ids correctly stamps entries:
  (a) valid sourceBook slug → _sourceBookId equals slug
  (b) source resolves to one slug → _sourceBookId is that slug
  (c) source resolves to multiple → _sourceBookId is array
  (d) no resolution → field absent
  (e) no source field at all → field absent

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
"""

from __future__ import annotations

from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from app.services.game_data import _augment_source_book_ids
from app.services.source_registry import BookEntry, SourceRegistry
from app.services.source_tag_resolver import SourceTagResolver

# ---------------------------------------------------------------------------
# Setup: Use the real books directory for the registry
# ---------------------------------------------------------------------------

_REAL_BOOKS_DIR = Path(__file__).resolve().parents[2] / "src" / "data" / "books"
_registry = SourceRegistry(books_dir=_REAL_BOOKS_DIR)
_resolver = SourceTagResolver(registry=_registry)

# Collect valid slugs and entries with PDF patterns for strategy generation
_valid_slugs = list(_registry.entries.keys())
_entries_with_pdfs = [
    entry for entry in _registry.entries.values() if entry.pdf_patterns
]

# Known multi-book source patterns (semicolon-separated references to distinct books)
_MULTI_BOOK_SOURCES = [
    "7711-Divine_Arenas.pdf p.6; Scion_Hero_(Final_Download).pdf p.142",
    "Scion_Dragon_(Final_Download).pdf p.10; Scion_Dragon_Companion_(Final_Download).pdf p.20",
    "7711-Divine_Armory.pdf p.3; 255389-RECONDITIONED_2.pdf p.1",
]

# Augmentable table names (same as the function under test)
_AUGMENTABLE_TABLES = (
    "equipment", "tags", "birthrights", "boons",
    "knacks", "purviews", "callings", "paths",
)

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy: a valid slug from the registry
_valid_slug_strategy = st.sampled_from(_valid_slugs)

# Strategy: a table name from augmentable tables
_table_name_strategy = st.sampled_from(list(_AUGMENTABLE_TABLES))

# Strategy: a valid entry key (non-underscore-prefixed identifier)
_entry_key_strategy = st.from_regex(r"[a-zA-Z][a-zA-Z0-9_]{0,30}", fullmatch=True)

# Strategy: random extra fields for an entry (non-interfering)
_extra_fields = st.fixed_dictionaries({}, optional={
    "name": st.text(min_size=1, max_size=30),
    "description": st.text(min_size=0, max_size=50),
    "dots": st.integers(min_value=1, max_value=5),
})


def _build_bundle(table_name: str, key: str, entry: dict) -> dict:
    """Wrap an entry into a bundle structure for testing."""
    return {table_name: {key: entry}}


# ---------------------------------------------------------------------------
# Property 11: Bundle Augmentation Correctness
# ---------------------------------------------------------------------------


class TestBundleAugmentationCorrectness:
    """Property 11: Bundle Augmentation Correctness.

    For any entry in an augmentable table:
      (a) if sourceBook is a valid registry slug, _sourceBookId SHALL equal that slug
      (b) if sourceBook is absent but source resolves to one slug, _sourceBookId SHALL be that slug
      (c) if source resolves to multiple slugs, _sourceBookId SHALL be an array
      (d) if neither field resolves, _sourceBookId SHALL not be present

    **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
    """

    # Feature: book-source-filter, Property 11: Bundle Augmentation Correctness
    @given(
        slug=_valid_slug_strategy,
        table_name=_table_name_strategy,
        key=_entry_key_strategy,
        extra=_extra_fields,
    )
    @settings(max_examples=200)
    def test_valid_sourcebook_slug_sets_source_book_id(
        self, slug: str, table_name: str, key: str, extra: dict
    ) -> None:
        """(a) When entry has sourceBook set to a valid registry slug,
        _sourceBookId should equal that slug.

        **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
        """
        entry = {**extra, "sourceBook": slug}
        bundle = _build_bundle(table_name, key, entry)

        _augment_source_book_ids(bundle, _registry, _resolver)

        augmented_entry = bundle[table_name][key]
        assert "_sourceBookId" in augmented_entry, (
            f"Entry with valid sourceBook={slug!r} should have _sourceBookId set.\n"
            f"  table={table_name!r}, key={key!r}, entry={augmented_entry!r}"
        )
        assert augmented_entry["_sourceBookId"] == slug, (
            f"_sourceBookId should equal the sourceBook slug.\n"
            f"  Expected: {slug!r}\n"
            f"  Got: {augmented_entry['_sourceBookId']!r}"
        )

    # Feature: book-source-filter, Property 11: Bundle Augmentation Correctness
    @given(
        table_name=_table_name_strategy,
        key=_entry_key_strategy,
        extra=_extra_fields,
        pdf_entry=st.sampled_from(_entries_with_pdfs),
    )
    @settings(max_examples=200)
    def test_source_resolves_to_one_slug(
        self, table_name: str, key: str, extra: dict, pdf_entry: BookEntry
    ) -> None:
        """(b) When entry has no sourceBook but a source field that resolves to
        exactly one slug, _sourceBookId should be that slug string.

        **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
        """
        # Use a PDF pattern from a known entry (e.g., "7711-Divine_Arenas.pdf p.6")
        pdf_filename = pdf_entry.pdf_patterns[0]
        source_str = f"{pdf_filename} p.6"

        entry = {**extra, "source": source_str}
        # Ensure no sourceBook field
        entry.pop("sourceBook", None)
        bundle = _build_bundle(table_name, key, entry)

        _augment_source_book_ids(bundle, _registry, _resolver)

        augmented_entry = bundle[table_name][key]
        assert "_sourceBookId" in augmented_entry, (
            f"Entry with resolvable source={source_str!r} should have _sourceBookId.\n"
            f"  table={table_name!r}, key={key!r}"
        )
        assert augmented_entry["_sourceBookId"] == pdf_entry.slug, (
            f"_sourceBookId should be the resolved slug.\n"
            f"  source: {source_str!r}\n"
            f"  Expected: {pdf_entry.slug!r}\n"
            f"  Got: {augmented_entry['_sourceBookId']!r}"
        )

    # Feature: book-source-filter, Property 11: Bundle Augmentation Correctness
    @given(
        table_name=_table_name_strategy,
        key=_entry_key_strategy,
        extra=_extra_fields,
        multi_source=st.sampled_from(_MULTI_BOOK_SOURCES),
    )
    @settings(max_examples=200)
    def test_source_resolves_to_multiple_slugs(
        self, table_name: str, key: str, extra: dict, multi_source: str
    ) -> None:
        """(c) When entry source resolves to multiple slugs (semicolon-separated),
        _sourceBookId should be an array of those slugs.

        **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
        """
        entry = {**extra, "source": multi_source}
        entry.pop("sourceBook", None)
        bundle = _build_bundle(table_name, key, entry)

        _augment_source_book_ids(bundle, _registry, _resolver)

        augmented_entry = bundle[table_name][key]
        assert "_sourceBookId" in augmented_entry, (
            f"Entry with multi-resolve source should have _sourceBookId.\n"
            f"  source: {multi_source!r}"
        )
        result = augmented_entry["_sourceBookId"]
        assert isinstance(result, list), (
            f"_sourceBookId should be a list for multi-book source.\n"
            f"  source: {multi_source!r}\n"
            f"  Got type: {type(result).__name__}, value: {result!r}"
        )
        assert len(result) > 1, (
            f"_sourceBookId array should have more than one element.\n"
            f"  source: {multi_source!r}\n"
            f"  Got: {result!r}"
        )
        # All elements should be valid registry slugs
        for s in result:
            assert s in _registry.entries, (
                f"Array element {s!r} is not a valid registry slug.\n"
                f"  source: {multi_source!r}"
            )

    # Feature: book-source-filter, Property 11: Bundle Augmentation Correctness
    @given(
        table_name=_table_name_strategy,
        key=_entry_key_strategy,
        extra=_extra_fields,
        gibberish=st.from_regex(r"99999_ZZXQ_[0-9]{3,10}", fullmatch=True),
    )
    @settings(max_examples=200)
    def test_no_resolution_field_absent(
        self, table_name: str, key: str, extra: dict, gibberish: str
    ) -> None:
        """(d) When entry has source that doesn't match anything,
        _sourceBookId should NOT be present on the entry.

        **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
        """
        entry = {**extra, "source": gibberish}
        entry.pop("sourceBook", None)
        bundle = _build_bundle(table_name, key, entry)

        _augment_source_book_ids(bundle, _registry, _resolver)

        augmented_entry = bundle[table_name][key]
        assert "_sourceBookId" not in augmented_entry, (
            f"Entry with unresolvable source should NOT have _sourceBookId.\n"
            f"  source: {gibberish!r}\n"
            f"  Got: {augmented_entry.get('_sourceBookId')!r}"
        )

    # Feature: book-source-filter, Property 11: Bundle Augmentation Correctness
    @given(
        table_name=_table_name_strategy,
        key=_entry_key_strategy,
        extra=_extra_fields,
    )
    @settings(max_examples=200)
    def test_no_source_field_absent(
        self, table_name: str, key: str, extra: dict
    ) -> None:
        """(e) When entry has neither sourceBook nor source,
        _sourceBookId should NOT be present on the entry.

        **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**
        """
        entry = {**extra}
        # Ensure neither field is present
        entry.pop("sourceBook", None)
        entry.pop("source", None)
        bundle = _build_bundle(table_name, key, entry)

        _augment_source_book_ids(bundle, _registry, _resolver)

        augmented_entry = bundle[table_name][key]
        assert "_sourceBookId" not in augmented_entry, (
            f"Entry with no source/sourceBook should NOT have _sourceBookId.\n"
            f"  entry: {augmented_entry!r}"
        )
