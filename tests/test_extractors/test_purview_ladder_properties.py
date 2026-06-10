"""Property-based tests for purview extraction ladder invariant.

# Feature: unified-pdf-extractor, Property 4: Purview Extraction Ladder Invariant

For any valid purview section text, the purview extractor SHALL produce entries
where `boonLadderNames` is an array of exactly length 12, each element is a
string (possibly empty), and `id` is a non-empty camelCase identifier.

**Validates: Requirements 3.3**
"""

from __future__ import annotations

import re

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from extractors.purview_extractor import PurviewExtractor
from parser_framework.models import BookSpec


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CAMEL_CASE_RE = re.compile(r"^[a-z][a-zA-Z0-9]*$")


def _make_spec(filenames: list[str]) -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id="test_book",
        filenames=filenames,
        output_path="src/data/_extracted/test_book.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract"],
    )


def _make_config() -> dict:
    """Create a standard purview category config."""
    return {
        "output_path": "src/data/purviews_test.json",
        "section_anchors": [{"pattern": "STANDARD PURVIEWS", "pattern_type": "literal"}],
    }


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy: generate valid PDF filenames
_pdf_filename = st.from_regex(r"[A-Z][A-Za-z0-9_]{2,20}\.pdf", fullmatch=True)

# Strategy: generate valid purview names (single or multi-word, ALL-CAPS for headings)
_purview_word = st.from_regex(r"[A-Z]{3,10}", fullmatch=True)
_purview_name = st.lists(_purview_word, min_size=1, max_size=3).map(lambda ws: " ".join(ws))

# Strategy: generate boon names (ALL-CAPS, multi-word)
_boon_word = st.from_regex(r"[A-Z]{3,10}", fullmatch=True)
_boon_name = st.lists(_boon_word, min_size=1, max_size=4).map(lambda ws: " ".join(ws))

# Strategy: generate page numbers
_page_number = st.integers(min_value=1, max_value=500)

# Strategy: cost text (appears after boon heading)
_cost_text = st.sampled_from([
    "Cost: Imbue 1 Legend",
    "Cost: Spend 1 Legend",
    "Cost: Imbue 2 Legend",
    "Cost: Spend 2 Legend",
])

# Strategy: boon description text
_description_line = st.from_regex(r"[A-Z][a-z ]{5,40}\.", fullmatch=True)


@st.composite
def purview_section_text(draw):
    """Generate valid purview section text with ALL-CAPS purview headings
    followed by boon entries (ALL-CAPS name + "Cost:" on next line).

    Produces text that contains:
    - A page marker (===== Page N / Total =====)
    - A "STANDARD PURVIEWS" section anchor
    - One or more purview headings (ALL-CAPS)
    - Under each purview, 1-12 boon entries (ALL-CAPS name + "Cost:" on next line)
    """
    page_num = draw(_page_number)
    total_pages = draw(st.integers(min_value=page_num, max_value=page_num + 200))
    filename = draw(_pdf_filename)

    # Generate 1-3 purview headings
    num_purviews = draw(st.integers(min_value=1, max_value=3))
    purview_names = draw(
        st.lists(
            _purview_name,
            min_size=num_purviews,
            max_size=num_purviews,
            unique=True,
        )
    )

    # Filter: purview names must not be in the skip list used by the extractor
    skip_headings = {
        "STANDARD PURVIEWS", "PURVIEWS", "BOONS", "TABLE OF CONTENTS",
        "DENIZEN SIGNATURE PURVIEWS", "PANTHEON SIGNATURE PURVIEWS",
        "DENIZEN PURVIEW", "PRIMEVAL PURVIEWS",
    }
    purview_names = [n for n in purview_names if n not in skip_headings]
    assume(len(purview_names) >= 1)

    # Filter: purview names must be at least 3 chars (extractor skips short ones)
    purview_names = [n for n in purview_names if len(n) >= 3]
    assume(len(purview_names) >= 1)

    # Build the section text
    lines = [
        f"===== Page {page_num} / {total_pages} =====",
        "STANDARD PURVIEWS",
    ]

    boon_counts = []
    for purview_name in purview_names:
        lines.append(purview_name)

        # Generate 1-12 boon entries for this purview
        num_boons = draw(st.integers(min_value=1, max_value=12))
        boon_names = draw(
            st.lists(
                _boon_name,
                min_size=num_boons,
                max_size=num_boons,
                unique=True,
            )
        )

        # Filter boon names that match the purview heading itself
        boon_names = [b for b in boon_names if b != purview_name]
        assume(len(boon_names) >= 1)

        boon_counts.append(len(boon_names))

        for boon_name in boon_names:
            lines.append(boon_name)
            cost = draw(_cost_text)
            lines.append(cost)
            desc = draw(_description_line)
            lines.append(desc)
            lines.append("")  # blank line separator

    text = "\n".join(lines)

    return {
        "text": text,
        "filename": filename,
        "purview_names": purview_names,
        "boon_counts": boon_counts,
        "page_num": page_num,
    }


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 4: Purview Extraction Ladder Invariant
# ---------------------------------------------------------------------------


class TestPurviewExtractionLadderInvariant:
    """Property 4: Purview Extraction Ladder Invariant.

    For any valid purview section text, the purview extractor SHALL produce
    entries where `boonLadderNames` is an array of exactly length 12, each
    element is a string (possibly empty), and `id` is a non-empty camelCase
    identifier.

    **Validates: Requirements 3.3**
    """

    @given(data=purview_section_text())
    @settings(max_examples=100)
    def test_boon_ladder_names_has_exactly_12_elements(self, data: dict) -> None:
        """Every extracted purview entry has boonLadderNames of exactly length 12."""
        # **Validates: Requirements 3.3**
        extractor = PurviewExtractor()
        spec = _make_spec(filenames=[data["filename"]])
        config = _make_config()

        result = extractor.extract(data["text"], spec, config)

        assert result.entry_count >= 1, (
            f"Expected at least 1 purview entry from valid text, got {result.entry_count}.\n"
            f"Text:\n{data['text']}"
        )

        for entry_id, entry in result.entries.items():
            ladder = entry["boonLadderNames"]
            assert len(ladder) == 12, (
                f"boonLadderNames length is {len(ladder)}, expected 12.\n"
                f"Entry id: {entry_id}\n"
                f"Ladder: {ladder}"
            )

    @given(data=purview_section_text())
    @settings(max_examples=100)
    def test_boon_ladder_names_all_elements_are_strings(self, data: dict) -> None:
        """Every element in boonLadderNames is a string (possibly empty)."""
        # **Validates: Requirements 3.3**
        extractor = PurviewExtractor()
        spec = _make_spec(filenames=[data["filename"]])
        config = _make_config()

        result = extractor.extract(data["text"], spec, config)

        assert result.entry_count >= 1, (
            f"Expected at least 1 purview entry from valid text, got {result.entry_count}.\n"
            f"Text:\n{data['text']}"
        )

        for entry_id, entry in result.entries.items():
            ladder = entry["boonLadderNames"]
            for i, elem in enumerate(ladder):
                assert isinstance(elem, str), (
                    f"boonLadderNames[{i}] is not a string. "
                    f"Got type {type(elem).__name__}: {elem!r}\n"
                    f"Entry id: {entry_id}"
                )

    @given(data=purview_section_text())
    @settings(max_examples=100)
    def test_id_is_non_empty_camel_case(self, data: dict) -> None:
        """Every extracted purview entry has a non-empty camelCase id."""
        # **Validates: Requirements 3.3**
        extractor = PurviewExtractor()
        spec = _make_spec(filenames=[data["filename"]])
        config = _make_config()

        result = extractor.extract(data["text"], spec, config)

        assert result.entry_count >= 1, (
            f"Expected at least 1 purview entry from valid text, got {result.entry_count}.\n"
            f"Text:\n{data['text']}"
        )

        for entry_id, entry in result.entries.items():
            purview_id = entry["id"]
            assert purview_id, (
                f"Entry has empty id. Entry: {entry}"
            )
            assert isinstance(purview_id, str), (
                f"Entry id is not a string. Got: {type(purview_id)}"
            )
            assert _CAMEL_CASE_RE.match(purview_id), (
                f"Entry id is not camelCase. Got: {purview_id!r}\n"
                f"Entry name: {entry['name']}"
            )
