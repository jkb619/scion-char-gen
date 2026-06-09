"""Shared text normalization utilities for the PDF Parser Framework.

Provides Unicode normalization, smart-quote replacement, whitespace collapsing,
heading normalization, and fuzzy anchor matching using Levenshtein distance.
"""

from __future__ import annotations

import re
import unicodedata

from Levenshtein import distance as levenshtein_distance


# Pre-compiled patterns for performance
_MULTI_WHITESPACE_RE = re.compile(r"\s+")
_SOFT_HYPHEN = "\u00ad"
_EN_DASH = "\u2013"

# Smart quote mappings
_SMART_QUOTE_MAP: dict[str, str] = {
    "\u2018": "'",   # left single curly quote
    "\u2019": "'",   # right single curly quote
    "\u201c": '"',   # left double curly quote
    "\u201d": '"',   # right double curly quote
}


def normalize_text(s: str) -> str:
    """Apply NFKD normalization, soft-hyphen removal, smart-quote replacement,
    and whitespace collapse.

    Args:
        s: Input string to normalize.

    Returns:
        Normalized string with single spaces replacing any whitespace runs.
    """
    # NFKD Unicode normalization
    result = unicodedata.normalize("NFKD", s)

    # Remove soft hyphens
    result = result.replace(_SOFT_HYPHEN, "")

    # Replace smart quotes with ASCII equivalents
    for smart, ascii_equiv in _SMART_QUOTE_MAP.items():
        result = result.replace(smart, ascii_equiv)

    # Collapse all whitespace runs to a single space
    result = _MULTI_WHITESPACE_RE.sub(" ", result)

    # Strip leading/trailing whitespace
    result = result.strip()

    return result


def normalize_heading(s: str) -> str:
    """Full heading normalization pipeline.

    Applies in order:
    1. Unicode NFKD decomposition
    2. Soft-hyphen (U+00AD) removal
    3. En-dash (U+2013) → ASCII hyphen replacement
    4. Smart-quote (U+2018–U+201D) → ASCII equivalent replacement
    5. Conversion to uppercase
    6. Collapse consecutive whitespace to a single space
    7. Strip leading/trailing whitespace

    Args:
        s: Input heading string.

    Returns:
        Fully normalized heading string.
    """
    # NFKD Unicode normalization
    result = unicodedata.normalize("NFKD", s)

    # Remove soft hyphens
    result = result.replace(_SOFT_HYPHEN, "")

    # Replace en-dash with ASCII hyphen
    result = result.replace(_EN_DASH, "-")

    # Replace smart quotes with ASCII equivalents
    for smart, ascii_equiv in _SMART_QUOTE_MAP.items():
        result = result.replace(smart, ascii_equiv)

    # Convert to uppercase
    result = result.upper()

    # Collapse all whitespace runs to a single space
    result = _MULTI_WHITESPACE_RE.sub(" ", result)

    # Strip leading/trailing whitespace
    result = result.strip()

    return result


def fuzzy_find_anchor(
    needle: str, lines: list[str], max_distance: int = 2
) -> tuple[int, str, int] | None:
    """Find the best fuzzy match for an anchor string among a list of lines.

    Uses Levenshtein distance to find the closest matching line within the
    specified threshold. If multiple lines match within the threshold, returns
    the one with the smallest distance (first occurrence on ties).

    Args:
        needle: The anchor string to search for (will be normalized).
        lines: List of text lines to search through.
        max_distance: Maximum Levenshtein distance to accept (default: 2).

    Returns:
        A tuple of (line_index, matched_text, distance) for the best match,
        or None if no line is within the threshold.
    """
    normalized_needle = normalize_text(needle)

    best_match: tuple[int, str, int] | None = None
    best_distance = max_distance + 1

    for i, line in enumerate(lines):
        normalized_line = normalize_text(line)
        dist = levenshtein_distance(normalized_needle, normalized_line)

        if dist <= max_distance and dist < best_distance:
            best_distance = dist
            best_match = (i, line, dist)

    return best_match


def whitespace_insensitive_find(needle: str, haystack: str) -> int:
    """Find needle in haystack ignoring whitespace differences.

    Splits needle into non-whitespace tokens and searches for those tokens
    in sequence within the haystack, allowing arbitrary whitespace between them.

    Args:
        needle: The string to search for.
        haystack: The string to search within.

    Returns:
        The character offset in haystack where the match begins, or -1 if not found.
    """
    tokens = needle.split()
    if not tokens:
        return 0 if not needle or not haystack else -1

    # Build a regex pattern that matches the tokens with flexible whitespace
    escaped_tokens = [re.escape(token) for token in tokens]
    pattern = r"\s*".join(escaped_tokens)

    match = re.search(pattern, haystack)
    if match:
        return match.start()
    return -1
