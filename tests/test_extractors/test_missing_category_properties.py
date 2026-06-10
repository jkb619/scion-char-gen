"""Property-based tests for missing category graceful handling.

# Feature: unified-pdf-extractor, Property 9: Missing Category Graceful Handling

For any Book Spec that declares a category C, and ingested text that contains
no matching section anchor for C, the extractor SHALL produce a `CategoryResult`
with `entry_count == 0` and no raised exceptions.

**Validates: Requirements 7.3**
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from extractors import EXTRACTOR_REGISTRY, CategoryResult
from parser_framework.models import BookSpec


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
        book_title="Test Book",
        book_slug="test_book",
    )


# ---------------------------------------------------------------------------
# Category configs — each provides valid config structure but with section
# anchors that will never match randomly generated text (because the anchors
# use very specific patterns that random text won't produce).
# ---------------------------------------------------------------------------

_CATEGORY_CONFIGS: dict[str, dict] = {
    "knacks": {
        "calling_map": {
            "Guardian Knacks": "guardian",
            "Creator Knacks": "creator",
            "Healer Knacks": "healer",
        },
        "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][A-Za-z' ]+)$",
            "flags": ["MULTILINE"],
        },
    },
    "boons": {
        "section_anchors": [
            {"pattern": r"^(?P<purview>[A-Z][a-z]+)\s+Boons$", "pattern_type": "regex"}
        ],
        "heading_pattern": {
            "regex": r"^(?P<name>.+?)\s*(?P<dots>[●]+)$",
            "flags": ["MULTILINE"],
        },
        "dot_symbol": "●",
    },
    "purviews": {
        "section_anchors": [{"pattern": "Purviews", "pattern_type": "literal"}],
        "heading_pattern": {
            "regex": r"^(?P<name>[A-Z][a-z]+)$",
            "flags": ["MULTILINE"],
        },
    },
    "callings": {
        "section_anchors": [{"pattern": "Callings", "pattern_type": "literal"}],
        "heading_pattern": {
            "regex": r"^(?P<name>Creator|Guardian|Healer|Hunter|Judge|Liminal|Lover|Sage|Trickster|Warrior)$",
            "flags": ["MULTILINE"],
        },
    },
    "birthrights": {
        "section_anchors": [{"pattern": "Birthrights", "pattern_type": "literal"}],
        "heading_pattern": {
            "regex": r"^(?P<name>.+?)\s*\((?P<type>Relic|Creature|Follower|Guide|Cult)\)",
            "flags": ["MULTILINE"],
        },
        "stat_block_pattern": r"Primary Pool:\s*(?P<primaryPool>\d+).*?Defense:\s*(?P<defense>\d+).*?Health:\s*(?P<health>\d+)",
    },
    "equipment": {
        "section_anchors": [{"pattern": "Equipment", "pattern_type": "literal"}],
        "heading_pattern": {
            "regex": r"^(?P<name>[A-Z].+)$",
            "flags": ["MULTILINE"],
        },
        "tag_pattern": r"Tags:\s*(?P<tags>.+)",
    },
    "paths": {
        "section_anchors": [{"pattern": "Paths", "pattern_type": "literal"}],
        "heading_pattern": {
            "regex": r"^(?P<name>[A-Z].+)$",
            "flags": ["MULTILINE"],
        },
    },
    "pantheons": {
        "section_anchors": [{"pattern": "Pantheons", "pattern_type": "literal"}],
        "heading_pattern": {
            "regex": r"^(?P<name>[A-Z].+?)\s*[—–-]\s*(?P<tradition>.+)$",
            "flags": ["MULTILINE"],
        },
    },
    "book_slices": {
        "section_anchors": [],
    },
}


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Generate random text that explicitly avoids section anchors.
# We use lowercase-only words and digits to ensure no section anchor can match.
_random_word = st.from_regex(r"[a-z]{2,8}", fullmatch=True)
_random_line = st.lists(_random_word, min_size=1, max_size=8).map(lambda ws: " ".join(ws))

# Generate random text blocks (multiple lines of lowercase words)
_random_text = st.lists(_random_line, min_size=1, max_size=20).map(
    lambda lines: "\n".join(lines)
)

# All category names that have extractors registered
_category_name = st.sampled_from(sorted(EXTRACTOR_REGISTRY.keys()))


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 9: Missing Category Graceful Handling
# ---------------------------------------------------------------------------


class TestMissingCategoryGracefulHandling:
    """Property 9: Missing Category Graceful Handling.

    For any Book Spec that declares a category C, and ingested text that
    contains no matching section anchor for C, the extractor SHALL produce a
    `CategoryResult` with `entry_count == 0` and no raised exceptions.

    **Validates: Requirements 7.3**
    """

    @given(category=_category_name, text=_random_text)
    @settings(max_examples=100)
    def test_missing_anchor_produces_zero_entries(
        self, category: str, text: str
    ) -> None:
        """Extractors return entry_count == 0 when text has no matching anchors."""
        # **Validates: Requirements 7.3**
        extractor_cls = EXTRACTOR_REGISTRY[category]
        extractor = extractor_cls()
        spec = _make_spec()
        config = _CATEGORY_CONFIGS.get(category, {})

        # This must not raise any exception
        result = extractor.extract(text, spec, config)

        assert isinstance(result, CategoryResult), (
            f"Expected CategoryResult, got {type(result).__name__} "
            f"for category {category!r}"
        )
        assert result.entry_count == 0, (
            f"Expected entry_count == 0 for category {category!r} "
            f"with random text (no section anchors), "
            f"got entry_count == {result.entry_count}.\n"
            f"Text:\n{text[:200]}"
        )

    @given(category=_category_name, text=_random_text)
    @settings(max_examples=100)
    def test_missing_anchor_does_not_raise(
        self, category: str, text: str
    ) -> None:
        """Extractors do not raise exceptions when text has no matching anchors."""
        # **Validates: Requirements 7.3**
        extractor_cls = EXTRACTOR_REGISTRY[category]
        extractor = extractor_cls()
        spec = _make_spec()
        config = _CATEGORY_CONFIGS.get(category, {})

        # The primary assertion is that no exception is raised.
        # If an exception is raised, the test will fail with a traceback.
        try:
            result = extractor.extract(text, spec, config)
        except Exception as exc:
            raise AssertionError(
                f"Extractor for category {category!r} raised {type(exc).__name__}: "
                f"{exc}\nText:\n{text[:200]}"
            ) from exc

        # Additionally verify the result type is correct
        assert isinstance(result, CategoryResult)

    @given(text=_random_text)
    @settings(max_examples=100)
    def test_all_extractors_handle_empty_config_gracefully(
        self, text: str
    ) -> None:
        """All extractors handle minimal/empty config without crashing."""
        # **Validates: Requirements 7.3**
        spec = _make_spec()

        for category, extractor_cls in EXTRACTOR_REGISTRY.items():
            extractor = extractor_cls()
            config = _CATEGORY_CONFIGS.get(category, {})

            try:
                result = extractor.extract(text, spec, config)
            except Exception as exc:
                raise AssertionError(
                    f"Extractor for category {category!r} raised "
                    f"{type(exc).__name__}: {exc}\nText:\n{text[:200]}"
                ) from exc

            assert isinstance(result, CategoryResult)
            assert result.entry_count == 0, (
                f"Expected entry_count == 0 for {category!r}, "
                f"got {result.entry_count}"
            )
