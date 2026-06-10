"""Property-based tests for KnackExtractor schema conformance.

# Feature: unified-pdf-extractor, Property 2: Knack Extraction Schema Conformance

For any valid knack section text containing calling-organized bullet entries,
the knack extractor SHALL produce entries where each entry has non-empty `id`,
`name`, at least one element in `callings`, a `source` matching the pattern
`<filename> p.<N>`, and a `knackKind` of either "mortal" or "immortal".

**Validates: Requirements 3.1, 8.1**
"""

from __future__ import annotations

import re

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from extractors.knack_extractor import KnackExtractor
from parser_framework.models import BookSpec


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SOURCE_PATTERN = re.compile(r"^.+ p\.\d+$")


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


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy: generate valid PDF filenames
_pdf_filename = st.from_regex(r"[A-Z][A-Za-z0-9_]{2,20}\.pdf", fullmatch=True)

# Strategy: generate valid knack names (capitalized words, 1-4 words)
_word = st.from_regex(r"[A-Z][a-z]{2,10}", fullmatch=True)
_knack_name = st.lists(_word, min_size=1, max_size=4).map(lambda ws: " ".join(ws))

# Strategy: generate calling names (used in calling_map keys)
_calling_names = st.sampled_from([
    "Guardian", "Creator", "Healer", "Hunter",
    "Judge", "Liminal", "Lover", "Sage", "Trickster", "Warrior",
])

# Strategy: generate knack kind context (mortal or immortal section anchors)
_knack_kind_anchor = st.sampled_from([
    ("Mortal Knacks", "mortal"),
    ("Guardian Knacks", "immortal"),
    ("Creator Knacks", "immortal"),
    ("Hunter Knacks", "immortal"),
    ("Sage Knacks", "immortal"),
    ("Warrior Knacks", "immortal"),
    ("Healer Mortal Knacks", "mortal"),
])

# Strategy: generate page numbers
_page_number = st.integers(min_value=1, max_value=500)

# Strategy: generate description text (non-empty lines)
_description_line = st.from_regex(r"[A-Z][a-z ]{5,40}\.", fullmatch=True)


@st.composite
def knack_section_text(draw):
    """Generate a valid knack section text with page markers and calling headings.

    Produces text that contains:
    - A page marker (===== Page N / Total =====)
    - A calling section heading (from calling_map)
    - One or more knack entries with names and description text
    """
    page_num = draw(_page_number)
    total_pages = draw(st.integers(min_value=page_num, max_value=page_num + 200))

    # Choose an anchor (section heading) and its expected knackKind
    anchor_text, expected_kind = draw(_knack_kind_anchor)

    # Generate 1-5 knack entries
    num_knacks = draw(st.integers(min_value=1, max_value=5))
    knack_names = draw(
        st.lists(
            _knack_name,
            min_size=num_knacks,
            max_size=num_knacks,
            unique=True,
        )
    )

    # Filter out any knack names that exactly match the anchor text
    knack_names = [n for n in knack_names if n.strip() != anchor_text.strip()]
    assume(len(knack_names) >= 1)

    # Build the section text
    lines = [
        f"===== Page {page_num} / {total_pages} =====",
        anchor_text,
    ]

    for name in knack_names:
        lines.append(name)
        # Add 1-3 description lines
        desc_count = draw(st.integers(min_value=1, max_value=3))
        for _ in range(desc_count):
            desc = draw(_description_line)
            lines.append(desc)
        lines.append("")  # blank line separator

    text = "\n".join(lines)

    # Build the calling_map and config
    calling_id = anchor_text.split()[0].lower()
    if "mortal" in anchor_text.lower():
        calling_id = anchor_text.replace("Mortal Knacks", "").replace("Mortal", "").strip().lower()
        if not calling_id:
            calling_id = "general"

    calling_map = {anchor_text: calling_id}

    # Generate a filename
    filename = draw(_pdf_filename)

    return {
        "text": text,
        "calling_map": calling_map,
        "filename": filename,
        "expected_kind": expected_kind,
        "knack_names": knack_names,
        "page_num": page_num,
    }


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 2: Knack Extraction Schema Conformance
# ---------------------------------------------------------------------------


class TestKnackExtractionSchemaConformance:
    """Property 2: Knack Extraction Schema Conformance.

    For any valid knack section text containing calling-organized bullet entries,
    the knack extractor SHALL produce entries where each entry has non-empty `id`,
    `name`, at least one element in `callings`, a `source` matching the pattern
    `<filename> p.<N>`, and a `knackKind` of either "mortal" or "immortal".

    **Validates: Requirements 3.1, 8.1**
    """

    @given(data=knack_section_text())
    @settings(max_examples=100)
    def test_all_entries_have_non_empty_id(self, data: dict) -> None:
        """Every extracted knack entry has a non-empty id field."""
        # **Validates: Requirements 3.1, 8.1**
        extractor = KnackExtractor()
        spec = _make_spec(filenames=[data["filename"]])
        config = {
            "calling_map": data["calling_map"],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$",
                "flags": ["MULTILINE"],
            },
        }

        result = extractor.extract(data["text"], spec, config)

        # Should produce at least one entry from valid input
        assert result.entry_count >= 1, (
            f"Expected at least 1 entry from valid knack text, got {result.entry_count}.\n"
            f"Text:\n{data['text']}"
        )

        for entry_id, entry in result.entries.items():
            assert entry["id"], (
                f"Entry has empty id. Entry: {entry}"
            )
            assert isinstance(entry["id"], str), (
                f"Entry id is not a string. Got: {type(entry['id'])}"
            )

    @given(data=knack_section_text())
    @settings(max_examples=100)
    def test_all_entries_have_non_empty_name(self, data: dict) -> None:
        """Every extracted knack entry has a non-empty name field."""
        # **Validates: Requirements 3.1, 8.1**
        extractor = KnackExtractor()
        spec = _make_spec(filenames=[data["filename"]])
        config = {
            "calling_map": data["calling_map"],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$",
                "flags": ["MULTILINE"],
            },
        }

        result = extractor.extract(data["text"], spec, config)
        assert result.entry_count >= 1

        for entry_id, entry in result.entries.items():
            assert entry["name"], (
                f"Entry has empty name. Entry: {entry}"
            )
            assert isinstance(entry["name"], str), (
                f"Entry name is not a string. Got: {type(entry['name'])}"
            )

    @given(data=knack_section_text())
    @settings(max_examples=100)
    def test_all_entries_have_at_least_one_calling(self, data: dict) -> None:
        """Every extracted knack entry has at least one element in callings."""
        # **Validates: Requirements 3.1, 8.1**
        extractor = KnackExtractor()
        spec = _make_spec(filenames=[data["filename"]])
        config = {
            "calling_map": data["calling_map"],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$",
                "flags": ["MULTILINE"],
            },
        }

        result = extractor.extract(data["text"], spec, config)
        assert result.entry_count >= 1

        for entry_id, entry in result.entries.items():
            assert isinstance(entry["callings"], list), (
                f"Entry callings is not a list. Got: {type(entry['callings'])}"
            )
            assert len(entry["callings"]) >= 1, (
                f"Entry has no callings. Entry: {entry}"
            )

    @given(data=knack_section_text())
    @settings(max_examples=100)
    def test_all_entries_have_valid_source_format(self, data: dict) -> None:
        """Every extracted knack entry has a source matching `<filename> p.<N>`."""
        # **Validates: Requirements 3.1, 8.1**
        extractor = KnackExtractor()
        spec = _make_spec(filenames=[data["filename"]])
        config = {
            "calling_map": data["calling_map"],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$",
                "flags": ["MULTILINE"],
            },
        }

        result = extractor.extract(data["text"], spec, config)
        assert result.entry_count >= 1

        for entry_id, entry in result.entries.items():
            source = entry["source"]
            assert isinstance(source, str), (
                f"Entry source is not a string. Got: {type(source)}"
            )
            assert _SOURCE_PATTERN.match(source), (
                f"Entry source does not match '<filename> p.<N>' pattern.\n"
                f"Got: {source!r}\n"
                f"Entry: {entry}"
            )
            # Verify the filename part matches the spec's filename
            assert source.startswith(data["filename"]), (
                f"Source does not start with expected filename.\n"
                f"Expected prefix: {data['filename']!r}\n"
                f"Got source: {source!r}"
            )

    @given(data=knack_section_text())
    @settings(max_examples=100)
    def test_all_entries_have_valid_knack_kind(self, data: dict) -> None:
        """Every extracted knack entry has knackKind of 'mortal' or 'immortal'."""
        # **Validates: Requirements 3.1, 8.1**
        extractor = KnackExtractor()
        spec = _make_spec(filenames=[data["filename"]])
        config = {
            "calling_map": data["calling_map"],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$",
                "flags": ["MULTILINE"],
            },
        }

        result = extractor.extract(data["text"], spec, config)
        assert result.entry_count >= 1

        for entry_id, entry in result.entries.items():
            assert entry["knackKind"] in ("mortal", "immortal"), (
                f"Entry knackKind is not 'mortal' or 'immortal'.\n"
                f"Got: {entry['knackKind']!r}\n"
                f"Entry: {entry}"
            )

    @given(data=knack_section_text())
    @settings(max_examples=100)
    def test_knack_kind_matches_section_context(self, data: dict) -> None:
        """knackKind is 'mortal' when section anchor contains 'Mortal', else 'immortal'."""
        # **Validates: Requirements 3.1, 8.1**
        extractor = KnackExtractor()
        spec = _make_spec(filenames=[data["filename"]])
        config = {
            "calling_map": data["calling_map"],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$",
                "flags": ["MULTILINE"],
            },
        }

        result = extractor.extract(data["text"], spec, config)
        assert result.entry_count >= 1

        for entry_id, entry in result.entries.items():
            assert entry["knackKind"] == data["expected_kind"], (
                f"Entry knackKind does not match expected from section context.\n"
                f"Expected: {data['expected_kind']!r}\n"
                f"Got: {entry['knackKind']!r}\n"
                f"Calling map: {data['calling_map']}"
            )
