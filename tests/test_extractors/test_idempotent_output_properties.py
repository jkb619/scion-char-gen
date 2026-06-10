"""Property-based tests for idempotent output.

# Feature: unified-pdf-extractor, Property 7: Idempotent Output

For any Book Spec and its corresponding PDF text, running the extraction pipeline
twice with identical inputs SHALL produce byte-identical JSON output files.

**Validates: Requirements 4.3**
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Any

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from extractors.knack_extractor import KnackExtractor
from extractors.boon_extractor import BoonExtractor
from extractors.calling_extractor import CallingExtractor
from parser_framework.models import BookSpec
from parser_framework.output_writer import format_json


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_spec(filenames: list[str] | None = None) -> BookSpec:
    """Create a minimal BookSpec for testing."""
    return BookSpec(
        book_id="test_book",
        filenames=filenames or ["Test_Book.pdf"],
        output_path="src/data/_extracted/test_book.txt",
        section_anchors=[],
        heading_patterns=[],
        expected_fields=[],
        pipeline_stages=["ingest", "extract"],
    )


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# PDF filename strategy
_pdf_filename = st.from_regex(r"[A-Z][A-Za-z0-9_]{2,20}\.pdf", fullmatch=True)

# Strategy: generate valid knack names (capitalized words, 1-4 words)
_word = st.from_regex(r"[A-Z][a-z]{2,10}", fullmatch=True)
_knack_name = st.lists(_word, min_size=1, max_size=4).map(lambda ws: " ".join(ws))

# Page numbers
_page_number = st.integers(min_value=1, max_value=500)

# Description text
_description_line = st.from_regex(r"[A-Z][a-z ]{5,40}\.", fullmatch=True)

# Calling names for knack tests
_calling_anchors = st.sampled_from([
    "Guardian Knacks",
    "Creator Knacks",
    "Hunter Knacks",
    "Sage Knacks",
    "Warrior Knacks",
])


@st.composite
def knack_extraction_input(draw):
    """Generate a complete knack extraction input (text + config + spec)."""
    page_num = draw(_page_number)
    total_pages = draw(st.integers(min_value=page_num, max_value=page_num + 200))
    anchor_text = draw(_calling_anchors)

    # Generate 1-5 knack entries
    num_knacks = draw(st.integers(min_value=1, max_value=5))
    knack_names = draw(
        st.lists(_knack_name, min_size=num_knacks, max_size=num_knacks, unique=True)
    )
    # Filter out names matching the anchor
    knack_names = [n for n in knack_names if n.strip() != anchor_text.strip()]
    assume(len(knack_names) >= 1)

    # Build section text
    lines = [
        f"===== Page {page_num} / {total_pages} =====",
        anchor_text,
    ]
    for name in knack_names:
        lines.append(name)
        desc_count = draw(st.integers(min_value=1, max_value=3))
        for _ in range(desc_count):
            desc = draw(_description_line)
            lines.append(desc)
        lines.append("")

    text = "\n".join(lines)
    calling_id = anchor_text.split()[0].lower()
    calling_map = {anchor_text: calling_id}
    filename = draw(_pdf_filename)

    config = {
        "calling_map": calling_map,
        "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$",
            "flags": ["MULTILINE"],
        },
    }
    spec = _make_spec(filenames=[filename])

    return {"text": text, "config": config, "spec": spec}


# Boon dot symbol
_dot_count = st.integers(min_value=1, max_value=12)

# Boon purview names
_purview_name = st.sampled_from([
    "Artistry", "Beauty", "Chaos", "Darkness", "Death",
    "Earth", "Epic", "Fertility", "Fire", "Fortune",
    "Frost", "Health", "Journeys", "Moon", "Order",
])


@st.composite
def boon_extraction_input(draw):
    """Generate a complete boon extraction input (text + config + spec)."""
    page_num = draw(_page_number)
    total_pages = draw(st.integers(min_value=page_num, max_value=page_num + 200))
    purview = draw(_purview_name)
    dots = draw(_dot_count)

    boon_name = draw(_knack_name)
    dot_symbols = "●" * dots
    description = draw(_description_line)

    text = (
        f"===== Page {page_num} / {total_pages} =====\n"
        f"{purview} Boons\n\n"
        f"{boon_name} {dot_symbols}\n"
        f"{description}\n"
        f"Cost: Imbue 1 Legend\n"
        f"Duration: One scene\n"
    )

    config = {
        "section_anchors": [
            {"pattern": r"^(?P<purview>[A-Z][a-z]+)\s+Boons$", "pattern_type": "regex"}
        ],
        "heading_pattern": {
            "regex": r"^(?P<name>.+?)\s*(?P<dots>[●]+)$",
            "flags": ["MULTILINE"],
        },
        "dot_symbol": "●",
    }
    filename = draw(_pdf_filename)
    spec = _make_spec(filenames=[filename])

    return {"text": text, "config": config, "spec": spec}


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 7: Idempotent Output
# ---------------------------------------------------------------------------


class TestIdempotentOutput:
    """Property 7: Idempotent Output.

    For any Book Spec and its corresponding PDF text, running the extraction
    pipeline twice with identical inputs SHALL produce byte-identical JSON
    output files.

    **Validates: Requirements 4.3**
    """

    @given(data=knack_extraction_input())
    @settings(max_examples=100)
    def test_knack_extractor_produces_identical_output_on_repeated_runs(
        self, data: dict
    ) -> None:
        """Running the knack extractor twice with the same input produces identical results."""
        # **Validates: Requirements 4.3**
        extractor = KnackExtractor()

        result1 = extractor.extract(data["text"], data["spec"], data["config"])
        result2 = extractor.extract(data["text"], data["spec"], data["config"])

        # The entries dicts must be identical
        assert result1.entries == result2.entries, (
            "Knack extractor produced different entries on repeated runs.\n"
            f"Run 1 keys: {sorted(result1.entries.keys())}\n"
            f"Run 2 keys: {sorted(result2.entries.keys())}"
        )
        assert result1.entry_count == result2.entry_count

        # JSON serialization must also be byte-identical
        json1 = format_json(result1.entries)
        json2 = format_json(result2.entries)
        assert json1 == json2, (
            "Knack extractor JSON serialization differs between runs."
        )

    @given(data=boon_extraction_input())
    @settings(max_examples=100)
    def test_boon_extractor_produces_identical_output_on_repeated_runs(
        self, data: dict
    ) -> None:
        """Running the boon extractor twice with the same input produces identical results."""
        # **Validates: Requirements 4.3**
        extractor = BoonExtractor()

        result1 = extractor.extract(data["text"], data["spec"], data["config"])
        result2 = extractor.extract(data["text"], data["spec"], data["config"])

        # The entries dicts must be identical
        assert result1.entries == result2.entries, (
            "Boon extractor produced different entries on repeated runs.\n"
            f"Run 1 keys: {sorted(result1.entries.keys())}\n"
            f"Run 2 keys: {sorted(result2.entries.keys())}"
        )
        assert result1.entry_count == result2.entry_count

        # JSON serialization must also be byte-identical
        json1 = format_json(result1.entries)
        json2 = format_json(result2.entries)
        assert json1 == json2, (
            "Boon extractor JSON serialization differs between runs."
        )

    @given(data=knack_extraction_input())
    @settings(max_examples=100)
    def test_format_json_is_deterministic_for_extractor_output(
        self, data: dict
    ) -> None:
        """format_json produces byte-identical output for the same dict input."""
        # **Validates: Requirements 4.3**
        extractor = KnackExtractor()
        result = extractor.extract(data["text"], data["spec"], data["config"])

        # Serialize the same result multiple times
        json1 = format_json(result.entries)
        json2 = format_json(result.entries)
        json3 = format_json(result.entries)

        assert json1 == json2 == json3, (
            "format_json is not deterministic for the same input dict."
        )

        # Also verify round-tripping: deserialize and re-serialize
        deserialized = json.loads(json1)
        json4 = format_json(deserialized)
        assert json1 == json4, (
            "format_json is not idempotent after round-trip deserialization.\n"
            f"Original: {json1[:200]!r}\n"
            f"After round-trip: {json4[:200]!r}"
        )
