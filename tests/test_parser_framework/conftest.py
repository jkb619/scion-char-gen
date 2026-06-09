"""Shared fixtures for parser_framework property and unit tests."""

from __future__ import annotations

import pytest
from hypothesis import settings

# Register Hypothesis profile for CI with more examples
settings.register_profile("ci", max_examples=500)
settings.register_profile("dev", max_examples=50)


@pytest.fixture
def sample_lines() -> list[str]:
    """A set of sample text lines for fuzzy matching tests."""
    return [
        "BEAST",
        "EPIC STRENGTH",
        "DIVINE WRATH",
        "Some random paragraph text here.",
        "Another line of text with numbers 123.",
    ]
