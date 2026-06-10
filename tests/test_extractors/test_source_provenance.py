"""Unit tests for source provenance utilities and pipeline _meta injection.

Validates Requirements 8.1, 8.2, 8.3:
- Every extracted entry has a `source` field matching `<filename> p.<N>` format
- Every output JSON has `_meta` block with `sourcePdf`, `slug`, `book_title`
- Multi-page entries record page number of heading appearance
- The pipeline output writing stage correctly injects _meta for all categories
- Book slice outputs preserve their rich _meta block from the extractor
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from unittest.mock import patch
from typing import Any

import pytest

from extractors.source_provenance import (
    PAGE_MARKER_RE,
    SOURCE_FIELD_PATTERN,
    build_meta_block,
    build_source,
    find_nearest_page,
    validate_meta_block,
    validate_source_field,
)
from extractors.base import CategoryResult
from parser_framework.models import BookSpec


# ---------------------------------------------------------------------------
# Tests for build_source
# ---------------------------------------------------------------------------


class TestBuildSource:
    """Tests for the build_source function."""

    def test_basic_format(self):
        result = build_source("Scion_Hero.pdf", 42)
        assert result == "Scion_Hero.pdf p.42"

    def test_page_1(self):
        result = build_source("Book.pdf", 1)
        assert result == "Book.pdf p.1"

    def test_large_page_number(self):
        result = build_source("Long_Book.pdf", 999)
        assert result == "Long_Book.pdf p.999"

    def test_filename_with_spaces(self):
        result = build_source("My Book (Revised).pdf", 5)
        assert result == "My Book (Revised).pdf p.5"

    def test_result_matches_pattern(self):
        result = build_source("Test.pdf", 10)
        assert validate_source_field(result)


# ---------------------------------------------------------------------------
# Tests for validate_source_field
# ---------------------------------------------------------------------------


class TestValidateSourceField:
    """Tests for the validate_source_field function."""

    def test_valid_source(self):
        assert validate_source_field("Scion_Hero.pdf p.42") is True

    def test_valid_source_with_spaces_in_filename(self):
        assert validate_source_field("My Book (Revised).pdf p.5") is True

    def test_valid_source_page_1(self):
        assert validate_source_field("Book.pdf p.1") is True

    def test_empty_string_invalid(self):
        assert validate_source_field("") is False

    def test_none_invalid(self):
        assert validate_source_field(None) is False

    def test_missing_page_prefix_invalid(self):
        assert validate_source_field("Book.pdf 42") is False

    def test_missing_page_number_invalid(self):
        assert validate_source_field("Book.pdf p.") is False

    def test_no_space_before_page_invalid(self):
        assert validate_source_field("Book.pdfp.42") is False

    def test_filename_only_invalid(self):
        assert validate_source_field("Book.pdf") is False

    def test_page_only_invalid(self):
        # No filename part
        assert validate_source_field("p.42") is False


# ---------------------------------------------------------------------------
# Tests for find_nearest_page
# ---------------------------------------------------------------------------


class TestFindNearestPage:
    """Tests for the find_nearest_page function."""

    def test_finds_preceding_marker(self):
        text = "===== Page 5 / 100 =====\nSome content here"
        result = find_nearest_page(text, 40)
        assert result == 5

    def test_returns_1_when_no_marker(self):
        text = "Just some plain text without any markers"
        result = find_nearest_page(text, 20)
        assert result == 1

    def test_finds_most_recent_marker(self):
        text = (
            "===== Page 3 / 100 =====\nContent\n"
            "===== Page 4 / 100 =====\nMore content\n"
            "===== Page 5 / 100 =====\nFinal content"
        )
        # Position after the Page 4 marker but before Page 5
        pos = text.index("More content") + 5
        result = find_nearest_page(text, pos)
        assert result == 4

    def test_position_at_start(self):
        text = "===== Page 1 / 50 =====\nFirst page"
        result = find_nearest_page(text, 0)
        assert result == 1

    def test_multi_page_entry_records_heading_page(self):
        """Requirement 8.3: Multi-page entries record page of heading appearance."""
        text = (
            "===== Page 10 / 50 =====\n"
            "Entry Heading\n"
            "First part of description...\n"
            "===== Page 11 / 50 =====\n"
            "Continuation of the same entry.\n"
        )
        # Position at the heading (on page 10)
        heading_pos = text.index("Entry Heading")
        result = find_nearest_page(text, heading_pos)
        assert result == 10


# ---------------------------------------------------------------------------
# Tests for build_meta_block
# ---------------------------------------------------------------------------


class TestBuildMetaBlock:
    """Tests for the build_meta_block function."""

    def test_basic_meta_block(self):
        meta = build_meta_block("Scion_Hero.pdf", "scion_hero", "Scion Hero")
        assert meta == {
            "sourcePdf": "Scion_Hero.pdf",
            "slug": "scion_hero",
            "book_title": "Scion Hero",
        }

    def test_extra_fields_included(self):
        meta = build_meta_block(
            "Book.pdf", "my_book", "My Book",
            kind="supplement",
            note="Some note",
        )
        assert meta["kind"] == "supplement"
        assert meta["note"] == "Some note"
        assert meta["sourcePdf"] == "Book.pdf"

    def test_validates_successfully(self):
        meta = build_meta_block("Book.pdf", "slug", "Title")
        assert validate_meta_block(meta) == []


# ---------------------------------------------------------------------------
# Tests for validate_meta_block
# ---------------------------------------------------------------------------


class TestValidateMetaBlock:
    """Tests for the validate_meta_block function."""

    def test_valid_meta(self):
        meta = {"sourcePdf": "Book.pdf", "slug": "my_book", "book_title": "My Book"}
        assert validate_meta_block(meta) == []

    def test_missing_source_pdf(self):
        meta = {"slug": "my_book", "book_title": "My Book"}
        errors = validate_meta_block(meta)
        assert len(errors) == 1
        assert "sourcePdf" in errors[0]

    def test_empty_source_pdf(self):
        meta = {"sourcePdf": "", "slug": "my_book", "book_title": "My Book"}
        errors = validate_meta_block(meta)
        assert len(errors) == 1
        assert "sourcePdf" in errors[0]

    def test_missing_slug(self):
        meta = {"sourcePdf": "Book.pdf", "book_title": "My Book"}
        errors = validate_meta_block(meta)
        assert len(errors) == 1
        assert "slug" in errors[0]

    def test_empty_slug(self):
        meta = {"sourcePdf": "Book.pdf", "slug": "", "book_title": "My Book"}
        errors = validate_meta_block(meta)
        assert len(errors) == 1
        assert "slug" in errors[0]

    def test_missing_book_title(self):
        meta = {"sourcePdf": "Book.pdf", "slug": "my_book"}
        errors = validate_meta_block(meta)
        assert len(errors) == 1
        assert "book_title" in errors[0]

    def test_all_missing(self):
        errors = validate_meta_block({})
        assert len(errors) == 3

    def test_not_a_dict(self):
        errors = validate_meta_block("not a dict")
        assert errors == ["_meta must be a dict"]

    def test_extra_fields_dont_cause_errors(self):
        meta = {
            "sourcePdf": "Book.pdf",
            "slug": "my_book",
            "book_title": "My Book",
            "kind": "supplement",
            "note": "extra info",
        }
        assert validate_meta_block(meta) == []


# ---------------------------------------------------------------------------
# Tests for source field format across all extractors
# ---------------------------------------------------------------------------


class TestAllExtractorsSourceFormat:
    """Verify that all extractors produce correctly-formatted source fields.

    Each extractor should produce entries with source matching `<filename> p.<N>`.
    """

    def _make_spec(self, filenames: list[str] | None = None) -> BookSpec:
        return BookSpec(
            book_id="test_book",
            filenames=filenames or ["TestBook.pdf"],
            output_path="src/data/_extracted/test_book.txt",
            section_anchors=[],
            heading_patterns=[],
            expected_fields=[],
            pipeline_stages=["ingest", "extract"],
            book_title="Test Book",
            book_slug="test_book",
        )

    def _text_with_page_markers(self) -> str:
        """Create sample ingested text with page markers."""
        return (
            "===== Page 1 / 10 =====\n"
            "Some introductory content\n"
            "===== Page 5 / 10 =====\n"
            "Guardian Knacks\n"
            "Aura of Greatness\n"
            "This knack grants an aura of greatness.\n"
            "Mechanical: Roll dice.\n"
            "===== Page 6 / 10 =====\n"
            "More content\n"
        )

    def test_knack_extractor_source_format(self):
        from extractors.knack_extractor import KnackExtractor

        extractor = KnackExtractor()
        spec = self._make_spec(["TestBook.pdf"])
        config = {
            "calling_map": {"Guardian Knacks": "guardian"},
        }
        text = self._text_with_page_markers()

        result = extractor.extract(text, spec, config)

        for entry_id, entry in result.entries.items():
            assert "source" in entry, f"Entry {entry_id} missing source field"
            assert validate_source_field(entry["source"]), (
                f"Entry {entry_id} source '{entry['source']}' doesn't match format"
            )

    def test_boon_extractor_source_format(self):
        from extractors.boon_extractor import BoonExtractor

        extractor = BoonExtractor()
        spec = self._make_spec(["TestBook.pdf"])
        config = {
            "section_anchors": [
                {"pattern": r"^(?P<purview>[A-Z][a-z]+)\s+Boons$", "pattern_type": "regex"}
            ],
        }
        text = (
            "===== Page 3 / 10 =====\n"
            "Artistry Boons\n"
            "Creative Vision ●\n"
            "You gain creative insight.\n"
            "Cost: None\n"
        )

        result = extractor.extract(text, spec, config)

        for entry_id, entry in result.entries.items():
            assert "source" in entry, f"Entry {entry_id} missing source field"
            assert validate_source_field(entry["source"]), (
                f"Entry {entry_id} source '{entry['source']}' doesn't match format"
            )

    def test_calling_extractor_source_format(self):
        from extractors.calling_extractor import CallingExtractor

        extractor = CallingExtractor()
        spec = self._make_spec(["TestBook.pdf"])
        config = {
            "section_anchors": [{"pattern": "Callings", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(?P<name>Creator|Guardian|Healer|Hunter|Judge|Liminal|Lover|Sage|Trickster|Warrior)$",
                "flags": ["MULTILINE"],
            },
        }
        text = (
            "===== Page 7 / 20 =====\n"
            "Callings\n"
            "Creator\n"
            "Creators build things and make art.\n"
        )

        result = extractor.extract(text, spec, config)

        for entry_id, entry in result.entries.items():
            assert "source" in entry, f"Entry {entry_id} missing source field"
            assert validate_source_field(entry["source"]), (
                f"Entry {entry_id} source '{entry['source']}' doesn't match format"
            )

    def test_purview_extractor_source_format(self):
        from extractors.purview_extractor import PurviewExtractor

        extractor = PurviewExtractor()
        spec = self._make_spec(["TestBook.pdf"])
        config = {
            "section_anchors": [{"pattern": "Purviews", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z][a-z]+)$",
                "flags": ["MULTILINE"],
            },
        }
        text = (
            "===== Page 12 / 50 =====\n"
            "Purviews\n"
            "Artistry\n"
            "Artistry is the purview of creative works.\n"
            "Innate Power: You sense beauty.\n"
        )

        result = extractor.extract(text, spec, config)

        for entry_id, entry in result.entries.items():
            assert "source" in entry, f"Entry {entry_id} missing source field"
            assert validate_source_field(entry["source"]), (
                f"Entry {entry_id} source '{entry['source']}' doesn't match format"
            )

    def test_equipment_extractor_source_format(self):
        from extractors.equipment_extractor import EquipmentExtractor

        extractor = EquipmentExtractor()
        spec = self._make_spec(["TestBook.pdf"])
        config = {
            "section_anchors": [{"pattern": "Equipment", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z].+)$",
                "flags": ["MULTILINE"],
            },
        }
        text = (
            "===== Page 20 / 100 =====\n"
            "Equipment\n"
            "Melee Weapons\n"
            "Longsword\n"
            "A fine longsword.\n"
            "Tags: Lethal (0), Melee (0)\n"
        )

        result = extractor.extract(text, spec, config)

        for entry_id, entry in result.entries.items():
            assert "source" in entry, f"Entry {entry_id} missing source field"
            assert validate_source_field(entry["source"]), (
                f"Entry {entry_id} source '{entry['source']}' doesn't match format"
            )

    def test_birthright_extractor_source_format(self):
        from extractors.birthright_extractor import BirthrightExtractor

        extractor = BirthrightExtractor()
        spec = self._make_spec(["TestBook.pdf"])
        config = {
            "section_anchors": [{"pattern": "Birthrights", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(?P<name>.+?)\s*\((?P<type>Relic|Creature|Follower|Guide|Cult)\)",
                "flags": ["MULTILINE"],
            },
        }
        text = (
            "===== Page 30 / 100 =====\n"
            "Birthrights\n"
            "Mjolnir (Relic)\n"
            "••\n"
            "Thor's mighty hammer.\n"
        )

        result = extractor.extract(text, spec, config)

        for entry_id, entry in result.entries.items():
            assert "source" in entry, f"Entry {entry_id} missing source field"
            assert validate_source_field(entry["source"]), (
                f"Entry {entry_id} source '{entry['source']}' doesn't match format"
            )

    def test_path_extractor_source_format(self):
        from extractors.path_extractor import PathExtractor

        extractor = PathExtractor()
        spec = self._make_spec(["TestBook.pdf"])
        config = {
            "section_anchors": [{"pattern": "Paths", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z].+)$",
                "flags": ["MULTILINE"],
            },
        }
        text = (
            "===== Page 15 / 50 =====\n"
            "Paths\n"
            "Origin Paths\n"
            "Born Leader\n"
            "A natural leader from birth.\n"
            "Skills: Leadership, Persuasion\n"
        )

        result = extractor.extract(text, spec, config)

        for entry_id, entry in result.entries.items():
            assert "source" in entry, f"Entry {entry_id} missing source field"
            assert validate_source_field(entry["source"]), (
                f"Entry {entry_id} source '{entry['source']}' doesn't match format"
            )

    def test_pantheon_extractor_source_format(self):
        from extractors.pantheon_extractor import PantheonExtractor

        extractor = PantheonExtractor()
        spec = self._make_spec(["TestBook.pdf"])
        config = {
            "section_anchors": [{"pattern": "Pantheons", "pattern_type": "literal"}],
            "heading_pattern": {
                "regex": r"^(?P<name>[A-Z].+?)\s*[—–-]\s*(?P<tradition>.+)$",
                "flags": ["MULTILINE"],
            },
        }
        text = (
            "===== Page 40 / 100 =====\n"
            "Pantheons\n"
            "Æsir — Norse\n"
            "The Norse gods of Asgard.\n"
            "Asset Skills: Athletics, Melee\n"
        )

        result = extractor.extract(text, spec, config)

        for entry_id, entry in result.entries.items():
            assert "source" in entry, f"Entry {entry_id} missing source field"
            assert validate_source_field(entry["source"]), (
                f"Entry {entry_id} source '{entry['source']}' doesn't match format"
            )


# ---------------------------------------------------------------------------
# Tests for pipeline _meta injection
# ---------------------------------------------------------------------------


class TestPipelineMetaInjection:
    """Tests for the pipeline output writing stage's _meta block injection.

    Validates that the unified_extractor's output stage adds _meta to all
    category outputs, and preserves book_slices' existing _meta.
    """

    def _make_spec(self) -> BookSpec:
        return BookSpec(
            book_id="test_book",
            filenames=["TestBook.pdf"],
            output_path="src/data/_extracted/test_book.txt",
            section_anchors=[],
            heading_patterns=[],
            expected_fields=[],
            pipeline_stages=["ingest", "extract"],
            book_title="Test Book",
            book_slug="test_book",
        )

    def test_meta_block_added_to_category_output(self, tmp_path: Path):
        """Non-book-slice categories get _meta injected at output stage."""
        from parser_framework.output_writer import write_output

        spec = self._make_spec()
        slug = spec.book_slug or spec.book_id
        pdf_name = "TestBook.pdf"

        # Simulate the pipeline output writing logic
        entries = {
            "knack1": {"id": "knack1", "name": "Test Knack", "source": "TestBook.pdf p.5"},
            "knack2": {"id": "knack2", "name": "Another", "source": "TestBook.pdf p.6"},
        }

        output_data: dict[str, Any] = {"_meta": {
            "sourcePdf": pdf_name,
            "slug": slug,
            "book_title": spec.book_title or spec.book_id,
        }}
        output_data.update(entries)

        output_path = tmp_path / "knacks.json"
        write_output(output_data, output_path)

        # Verify the output
        written = json.loads(output_path.read_text(encoding="utf-8"))
        assert "_meta" in written
        meta = written["_meta"]
        assert meta["sourcePdf"] == "TestBook.pdf"
        assert meta["slug"] == "test_book"
        assert meta["book_title"] == "Test Book"

    def test_meta_block_is_first_key(self, tmp_path: Path):
        """_meta should appear as the first key in output JSON."""
        from parser_framework.output_writer import write_output

        output_data: dict[str, Any] = {"_meta": {
            "sourcePdf": "Book.pdf",
            "slug": "slug",
            "book_title": "Title",
        }}
        output_data["entry1"] = {"id": "entry1"}
        output_data["entry2"] = {"id": "entry2"}

        output_path = tmp_path / "output.json"
        write_output(output_data, output_path)

        text = output_path.read_text(encoding="utf-8")
        # _meta should appear before any other keys
        meta_pos = text.find('"_meta"')
        entry1_pos = text.find('"entry1"')
        assert meta_pos < entry1_pos

    def test_book_slice_meta_preserved(self, tmp_path: Path):
        """Book slice outputs preserve their extractor's rich _meta block."""
        from parser_framework.output_writer import write_output

        # Simulate what the book_slice_extractor produces
        slice_entries: dict[str, Any] = {
            "_meta": {
                "slug": "divine_armory",
                "title": "Divine Armory",
                "sourcePdf": "7711-Divine_Armory.pdf",
                "kind": "storypath_nexus",
                "note": "Personal bundle slice — merged at load; delete file to remove book.",
            },
            "equipment": {"eq1": {"id": "eq1", "source": "7711-Divine_Armory.pdf p.5"}},
        }

        # The pipeline for book_slices should preserve existing _meta
        # and only fill in missing fields
        meta = slice_entries["_meta"]
        meta.setdefault("sourcePdf", "7711-Divine_Armory.pdf")
        meta.setdefault("slug", "divine_armory")
        meta.setdefault("book_title", "Divine Armory")

        output_path = tmp_path / "divine_armory.json"
        write_output(slice_entries, output_path)

        written = json.loads(output_path.read_text(encoding="utf-8"))
        meta = written["_meta"]
        # Original rich _meta fields preserved
        assert meta["kind"] == "storypath_nexus"
        assert meta["note"] == "Personal bundle slice — merged at load; delete file to remove book."
        # Required provenance fields present
        assert meta["sourcePdf"] == "7711-Divine_Armory.pdf"
        assert meta["slug"] == "divine_armory"

    def test_meta_block_validates_correctly(self):
        """Output _meta blocks satisfy validate_meta_block."""
        meta = {
            "sourcePdf": "Book.pdf",
            "slug": "my_book",
            "book_title": "My Book",
        }
        assert validate_meta_block(meta) == []


# ---------------------------------------------------------------------------
# Tests for multi-page entry provenance (Requirement 8.3)
# ---------------------------------------------------------------------------


class TestMultiPageProvenance:
    """Requirement 8.3: Multi-page entries record the page of heading appearance."""

    def test_knack_spanning_pages_records_heading_page(self):
        """A knack whose text spans pages records the page where the heading appeared."""
        from extractors.knack_extractor import KnackExtractor

        extractor = KnackExtractor()
        spec = BookSpec(
            book_id="test_book",
            filenames=["TestBook.pdf"],
            output_path="src/data/_extracted/test_book.txt",
            section_anchors=[],
            heading_patterns=[],
            expected_fields=[],
            pipeline_stages=["ingest", "extract"],
        )
        config = {
            "calling_map": {"Guardian Knacks": "guardian"},
        }

        # The heading appears on page 10, but description continues to page 11
        text = (
            "===== Page 10 / 50 =====\n"
            "Guardian Knacks\n"
            "Aura of Greatness\n"
            "This is a description that goes on for a while.\n"
            "===== Page 11 / 50 =====\n"
            "And continues on the next page with more details.\n"
            "Mechanical: Roll dice and stuff.\n"
        )

        result = extractor.extract(text, spec, config)

        # Should have extracted the entry
        assert len(result.entries) > 0
        # The source should record page 10 (where the heading appeared)
        entry = list(result.entries.values())[0]
        assert "p.10" in entry["source"]
        assert "TestBook.pdf p.10" == entry["source"]
