"""Property-based tests for meta block structure invariant.

# Feature: unified-pdf-extractor, Property 11: Meta Block Structure Invariant

For any output JSON file produced by the extractor, the file SHALL contain a
`_meta` key whose value is an object containing at minimum `sourcePdf`
(non-empty string) and `slug` (non-empty string matching the book spec's slug).

**Validates: Requirements 8.2**
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from extractors.source_provenance import build_meta_block, validate_meta_block
from parser_framework.models import BookSpec
from parser_framework.output_writer import format_json, write_output


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_spec(
    book_id: str = "test_book",
    filenames: list[str] | None = None,
    book_slug: str | None = None,
    book_title: str | None = None,
) -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id=book_id,
        filenames=filenames or ["Test_Book.pdf"],
        output_path="src/data/_extracted/test_book.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract"],
        book_slug=book_slug,
        book_title=book_title,
    )


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy: non-empty PDF filenames (e.g., "Scion_Hero.pdf")
_pdf_filename = st.from_regex(r"[A-Z][A-Za-z0-9_]{2,20}\.pdf", fullmatch=True)

# Strategy: non-empty slug strings (lowercase with underscores)
_slug = st.from_regex(r"[a-z][a-z0-9_]{2,20}", fullmatch=True)

# Strategy: non-empty book titles (capitalized words)
_word = st.from_regex(r"[A-Z][a-z]{2,10}", fullmatch=True)
_book_title = st.lists(_word, min_size=1, max_size=4).map(lambda ws: " ".join(ws))

# Strategy: extra meta fields (optional keys like kind, note)
_kind = st.sampled_from(["storypath_nexus", "core", "supplement", "onyx_path", "other"])
_note = st.from_regex(r"[A-Za-z ]{5,40}", fullmatch=True)

# Strategy: random entry data to simulate extraction output
_entry_id = st.from_regex(r"[a-z][a-zA-Z0-9]{2,15}", fullmatch=True)
_entry_value = st.fixed_dictionaries({
    "id": _entry_id,
    "name": _word,
    "description": st.from_regex(r"[A-Z][a-z ]{5,40}\.", fullmatch=True),
    "source": st.builds(
        lambda f, p: f"{f} p.{p}",
        f=_pdf_filename,
        p=st.integers(min_value=1, max_value=500),
    ),
})


@st.composite
def meta_block_inputs(draw):
    """Generate random inputs for build_meta_block."""
    source_pdf = draw(_pdf_filename)
    slug = draw(_slug)
    title = draw(_book_title)

    # Optionally include extra fields
    extra: dict[str, Any] = {}
    if draw(st.booleans()):
        extra["kind"] = draw(_kind)
    if draw(st.booleans()):
        extra["note"] = draw(_note)

    return {
        "source_pdf": source_pdf,
        "slug": slug,
        "book_title": title,
        "extra": extra,
    }


@st.composite
def pipeline_output_data(draw):
    """Generate a complete output JSON payload as the pipeline would produce.

    Simulates what the unified_extractor writes: a dict with `_meta` as the
    first key, followed by extracted entries.
    """
    source_pdf = draw(_pdf_filename)
    slug = draw(_slug)
    title = draw(_book_title)

    # Build the _meta block using the production function
    extra: dict[str, Any] = {}
    if draw(st.booleans()):
        extra["kind"] = draw(_kind)
    if draw(st.booleans()):
        extra["note"] = draw(_note)

    meta = build_meta_block(source_pdf, slug, title, **extra)

    # Generate some extraction entries
    num_entries = draw(st.integers(min_value=0, max_value=5))
    entries: dict[str, Any] = {"_meta": meta}

    entry_ids = draw(
        st.lists(_entry_id, min_size=num_entries, max_size=num_entries, unique=True)
    )
    for eid in entry_ids:
        entries[eid] = draw(_entry_value)

    return {
        "output_data": entries,
        "expected_slug": slug,
        "expected_source_pdf": source_pdf,
        "spec": _make_spec(
            book_id=slug,
            filenames=[source_pdf],
            book_slug=slug,
            book_title=title,
        ),
    }


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 11: Meta Block Structure Invariant
# ---------------------------------------------------------------------------


class TestMetaBlockStructureInvariant:
    """Property 11: Meta Block Structure Invariant.

    For any output JSON file produced by the extractor, the file SHALL contain
    a `_meta` key whose value is an object containing at minimum `sourcePdf`
    (non-empty string) and `slug` (non-empty string matching the book spec's slug).

    **Validates: Requirements 8.2**
    """

    @given(inputs=meta_block_inputs())
    @settings(max_examples=100)
    def test_build_meta_block_always_contains_required_fields(
        self, inputs: dict
    ) -> None:
        """build_meta_block always produces a dict with non-empty sourcePdf and slug.

        **Validates: Requirements 8.2**
        """
        meta = build_meta_block(
            inputs["source_pdf"],
            inputs["slug"],
            inputs["book_title"],
            **inputs["extra"],
        )

        # Must be a dict
        assert isinstance(meta, dict), f"_meta must be a dict, got {type(meta)}"

        # Must contain sourcePdf as a non-empty string
        assert "sourcePdf" in meta, "_meta missing 'sourcePdf' key"
        assert isinstance(meta["sourcePdf"], str), "sourcePdf must be a string"
        assert len(meta["sourcePdf"]) > 0, "sourcePdf must be non-empty"

        # Must contain slug as a non-empty string
        assert "slug" in meta, "_meta missing 'slug' key"
        assert isinstance(meta["slug"], str), "slug must be a string"
        assert len(meta["slug"]) > 0, "slug must be non-empty"

        # slug must match what was passed in
        assert meta["slug"] == inputs["slug"], (
            f"_meta.slug '{meta['slug']}' does not match input slug '{inputs['slug']}'"
        )

        # sourcePdf must match what was passed in
        assert meta["sourcePdf"] == inputs["source_pdf"], (
            f"_meta.sourcePdf '{meta['sourcePdf']}' does not match input '{inputs['source_pdf']}'"
        )

    @given(inputs=meta_block_inputs())
    @settings(max_examples=100)
    def test_build_meta_block_passes_validation(self, inputs: dict) -> None:
        """Any meta block produced by build_meta_block passes validate_meta_block.

        **Validates: Requirements 8.2**
        """
        meta = build_meta_block(
            inputs["source_pdf"],
            inputs["slug"],
            inputs["book_title"],
            **inputs["extra"],
        )

        errors = validate_meta_block(meta)
        assert errors == [], (
            f"validate_meta_block reported errors for a valid meta block: {errors}"
        )

    @given(data=pipeline_output_data())
    @settings(max_examples=100)
    def test_pipeline_output_contains_valid_meta_block(self, data: dict) -> None:
        """Output data as produced by the pipeline always contains a valid _meta block.

        **Validates: Requirements 8.2**
        """
        output_data = data["output_data"]
        expected_slug = data["expected_slug"]
        expected_source_pdf = data["expected_source_pdf"]

        # The output must contain a _meta key
        assert "_meta" in output_data, "Output JSON must contain a '_meta' key"

        meta = output_data["_meta"]

        # Validate using the production validation function
        errors = validate_meta_block(meta)
        assert errors == [], (
            f"Output _meta block failed validation: {errors}"
        )

        # slug must match the book spec's slug
        assert meta["slug"] == expected_slug, (
            f"_meta.slug '{meta['slug']}' does not match spec slug '{expected_slug}'"
        )

        # sourcePdf must be non-empty
        assert meta["sourcePdf"] == expected_source_pdf, (
            f"_meta.sourcePdf '{meta['sourcePdf']}' does not match expected '{expected_source_pdf}'"
        )

    @given(data=pipeline_output_data())
    @settings(max_examples=100)
    def test_pipeline_output_written_to_file_preserves_meta(
        self, data: dict
    ) -> None:
        """Writing pipeline output to disk and reading back preserves valid _meta.

        **Validates: Requirements 8.2**
        """
        output_data = data["output_data"]
        expected_slug = data["expected_slug"]

        with tempfile.TemporaryDirectory() as tmpdir:
            # Write using the production output_writer
            output_file = Path(tmpdir) / f"{expected_slug}.json"
            write_output(output_data, output_file)

            # Read back
            written_text = output_file.read_text(encoding="utf-8")
            loaded = json.loads(written_text)

        # Verify _meta block survived serialization round-trip
        assert "_meta" in loaded, "Written JSON must contain '_meta' key"

        meta = loaded["_meta"]
        errors = validate_meta_block(meta)
        assert errors == [], (
            f"Written _meta block failed validation after round-trip: {errors}"
        )

        # slug must still match
        assert meta["slug"] == expected_slug, (
            f"After write/read, _meta.slug '{meta['slug']}' != expected '{expected_slug}'"
        )

        # sourcePdf must still be non-empty
        assert isinstance(meta["sourcePdf"], str) and len(meta["sourcePdf"]) > 0, (
            "After write/read, _meta.sourcePdf must be a non-empty string"
        )

    @given(inputs=meta_block_inputs())
    @settings(max_examples=100)
    def test_meta_block_slug_matches_spec_slug(self, inputs: dict) -> None:
        """The slug in _meta always matches the slug provided from the book spec.

        **Validates: Requirements 8.2**
        """
        spec = _make_spec(
            book_id=inputs["slug"],
            filenames=[inputs["source_pdf"]],
            book_slug=inputs["slug"],
            book_title=inputs["book_title"],
        )

        # Simulate what the pipeline does: build _meta using spec attributes
        slug = spec.book_slug or spec.book_id
        meta = build_meta_block(
            source_pdf=spec.filenames[0],
            slug=slug,
            book_title=spec.book_title or spec.book_id,
        )

        # The slug in _meta must match the spec's slug
        assert meta["slug"] == inputs["slug"], (
            f"_meta.slug '{meta['slug']}' does not match spec slug '{inputs['slug']}'"
        )

        # Must pass validation
        errors = validate_meta_block(meta)
        assert errors == [], f"Meta block from spec pipeline failed validation: {errors}"
