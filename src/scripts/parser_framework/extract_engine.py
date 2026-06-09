"""Extract Engine — Structured extraction driven by Book Spec declarations.

Locates sections via anchors (with normalization and fuzzy fallback), identifies
entry headings, and extracts field values from entry blocks. Supports both
pypdf-based plain-text extraction and pymupdf-based layout-aware extraction.
"""

from __future__ import annotations

import re
from pathlib import Path

from parser_framework.models import (
    BookSpec,
    ExtractResult,
    LogEntry,
    SectionAnchor,
)
from parser_framework.normalize import (
    fuzzy_find_anchor,
    normalize_heading,
    normalize_text,
    whitespace_insensitive_find,
)


def find_section(text: str, anchor: SectionAnchor) -> tuple[int, int] | None:
    """Return (start, end) character offsets of the section identified by anchor.

    For literal-type anchors:
      1. Normalize both anchor pattern and text, use whitespace-insensitive find.
      2. On failure, try fuzzy_find_anchor with max_distance=2.
      3. If anchor has aliases, try primary pattern first, then each alias in
         declaration order; stop at the first successful match.

    For regex-type anchors:
      - Compile the regex with MULTILINE flag (+ IGNORECASE if case_insensitive).
      - Search the text directly (no normalization on regex patterns).
      - Aliases are treated as alternative regex patterns.

    Args:
        text: The full ingested text to search within.
        anchor: A SectionAnchor defining the pattern and matching strategy.

    Returns:
        A tuple (start_offset, end_offset) where start is where the anchor match
        begins and end is the start of the next section-level content or end of text.
        Returns None if the anchor cannot be found after all attempts.
    """
    # Build the list of patterns to try: primary first, then aliases
    patterns_to_try = [anchor.pattern]
    if anchor.aliases:
        patterns_to_try.extend(anchor.aliases)

    if anchor.pattern_type == "regex":
        return _find_section_regex(text, patterns_to_try, anchor.case_insensitive)
    else:
        return _find_section_literal(text, patterns_to_try)


def _find_section_literal(
    text: str, patterns: list[str]
) -> tuple[int, int] | None:
    """Try each literal pattern with normalization + fuzzy fallback."""
    for pattern in patterns:
        result = _try_literal_match(text, pattern)
        if result is not None:
            return result
    return None


def _try_literal_match(text: str, pattern: str) -> tuple[int, int] | None:
    """Attempt literal matching: whitespace-insensitive first, then fuzzy."""
    # First try: whitespace-insensitive find on normalized text
    normalized_pattern = normalize_text(pattern)
    offset = whitespace_insensitive_find(normalized_pattern, text)

    if offset >= 0:
        # Find end of the match (end of the line containing the anchor)
        line_end = text.find("\n", offset)
        if line_end == -1:
            start = offset
        else:
            start = offset
        return (start, len(text))

    # Second try: fuzzy matching against individual lines
    lines = text.split("\n")
    match_result = fuzzy_find_anchor(pattern, lines, max_distance=2)
    if match_result is not None:
        line_idx, _matched_text, _distance = match_result
        # Calculate character offset of the matched line
        char_offset = 0
        for i in range(line_idx):
            char_offset += len(lines[i]) + 1  # +1 for newline
        return (char_offset, len(text))

    return None


def _find_section_regex(
    text: str, patterns: list[str], case_insensitive: bool
) -> tuple[int, int] | None:
    """Try each regex pattern directly against text."""
    flags = re.MULTILINE
    if case_insensitive:
        flags |= re.IGNORECASE

    for pattern in patterns:
        try:
            match = re.search(pattern, text, flags)
        except re.error:
            continue
        if match:
            return (match.start(), len(text))

    return None


def extract_fields(block: str, expected_fields: list[str]) -> dict[str, str | None]:
    """Scan an entry block for field:value lines.

    For each expected field name, scans the block for lines matching
    ``FieldName:`` (case-sensitive for field name) followed by a value.
    The separator is a colon optionally followed by whitespace.

    Collapses interior whitespace in extracted values to single spaces.

    Args:
        block: Text block for a single entry.
        expected_fields: List of field names to extract.

    Returns:
        Dictionary mapping each field name to its extracted value (stripped,
        whitespace-collapsed) or None if the field was not found.
    """
    result: dict[str, str | None] = {}

    for field_name in expected_fields:
        # Build pattern: exact field name followed by colon and optional whitespace
        pattern = re.compile(
            r"^" + re.escape(field_name) + r":\s*(.*)",
            re.MULTILINE,
        )
        match = pattern.search(block)
        if match:
            value = match.group(1).strip()
            # Collapse interior whitespace to single spaces
            value = re.sub(r"\s+", " ", value)
            result[field_name] = value if value else None
        else:
            result[field_name] = None

    return result


def extract(spec: BookSpec, text: str) -> ExtractResult:
    """Locate sections, identify headings, extract fields per entry.

    Pipeline:
    1. Remove noise lines if spec.noise_line_regex is set.
    2. For each section_anchor, call find_section to locate boundaries.
    3. Within each section, apply heading_patterns to identify entry boundaries.
    4. For each entry block, call extract_fields with spec.expected_fields.
    5. Build entry keys using ``{section_name}_dot_{NN}`` format.

    Args:
        spec: Book specification with anchors, headings, and expected fields.
        text: The full ingested plain text.

    Returns:
        ExtractResult with all extracted entries and a structured log.
    """
    log: list[LogEntry] = []
    entries: dict[str, dict[str, str | None]] = {}

    # Step 1: Remove noise lines
    working_text = _remove_noise_lines(text, spec.noise_line_regex)

    # Step 2: Find sections and determine boundaries
    section_matches: list[tuple[SectionAnchor, int, int]] = []
    for anchor in spec.section_anchors:
        result = find_section(working_text, anchor)
        if result is None:
            log.append(
                LogEntry(
                    book_id=spec.book_id,
                    entry_id=None,
                    field=None,
                    reason="anchor_not_found",
                    detail=f"Anchor '{anchor.pattern}' not found after normalization and fuzzy matching",
                )
            )
            continue
        start, _end = result
        section_matches.append((anchor, start, _end))

    # Sort sections by their start offset
    section_matches.sort(key=lambda x: x[1])

    # Adjust section end boundaries: each section ends where the next begins
    for i in range(len(section_matches)):
        if i + 1 < len(section_matches):
            anchor, start, _end = section_matches[i]
            next_start = section_matches[i + 1][1]
            section_matches[i] = (anchor, start, next_start)

    # Step 3-5: Process each section
    for anchor, sec_start, sec_end in section_matches:
        section_text = working_text[sec_start:sec_end]
        section_name = _derive_section_name(anchor)

        # Find entry headings within this section
        heading_blocks = _split_by_headings(section_text, spec.heading_patterns)

        if not heading_blocks:
            # No headings found — log and skip
            log.append(
                LogEntry(
                    book_id=spec.book_id,
                    entry_id=None,
                    field=None,
                    reason="heading_unmatched",
                    detail=f"No headings matched in section '{section_name}'",
                )
            )
            continue

        # Extract fields from each heading block
        for idx, block in enumerate(heading_blocks, start=1):
            entry_key = f"{section_name}_dot_{idx:02d}"
            fields = extract_fields(block, spec.expected_fields)

            # Log missing fields
            for field_name, value in fields.items():
                if value is None:
                    log.append(
                        LogEntry(
                            book_id=spec.book_id,
                            entry_id=entry_key,
                            field=field_name,
                            reason="not_found",
                            detail=f"Field '{field_name}' not found in entry block",
                        )
                    )

            entries[entry_key] = fields

    return ExtractResult(book_id=spec.book_id, entries=entries, log=log)


def extract_pymupdf(spec: BookSpec, pdf_path: Path) -> ExtractResult:
    """pymupdf-based structured extraction for layout-sensitive books.

    Uses pymupdf's block extraction for layout-aware parsing. This is used
    for books like Pandora's Box where positional layout matters.

    Args:
        spec: Book specification with anchors, headings, and expected fields.
        pdf_path: Path to the PDF file to extract from.

    Returns:
        ExtractResult with all extracted entries and a structured log.
    """
    import fitz  # pymupdf

    doc = fitz.open(str(pdf_path))
    log: list[LogEntry] = []
    text_parts: list[str] = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        # Extract text blocks — each block is (x0, y0, x1, y1, text, block_no, block_type)
        blocks = page.get_text("blocks")
        # Sort blocks by vertical position then horizontal for reading order
        blocks.sort(key=lambda b: (b[1], b[0]))
        for block in blocks:
            # block_type 0 = text
            if block[6] == 0:
                text_parts.append(block[4])

    doc.close()

    # Assemble full text from blocks
    full_text = "\n".join(text_parts)

    # Delegate to the standard extract logic
    return extract(spec, full_text)


def _remove_noise_lines(text: str, noise_regex: str | None) -> str:
    """Remove lines matching the noise regex from text.

    Args:
        text: Input text.
        noise_regex: Regex pattern for noise lines, or None to skip.

    Returns:
        Text with noise lines removed.
    """
    if not noise_regex:
        return text

    pattern = re.compile(noise_regex)
    lines = text.split("\n")
    filtered = [line for line in lines if not pattern.match(line)]
    return "\n".join(filtered)


def _derive_section_name(anchor: SectionAnchor) -> str:
    """Derive a section name from the anchor pattern for use in entry keys.

    Normalizes the pattern to lowercase with underscores replacing spaces
    and non-alphanumeric characters removed.
    """
    name = anchor.pattern.lower()
    # Remove regex special characters if present
    name = re.sub(r"[^a-z0-9\s]", "", name)
    # Replace whitespace runs with underscore
    name = re.sub(r"\s+", "_", name).strip("_")
    return name or "section"


def _split_by_headings(
    section_text: str, heading_patterns: list
) -> list[str]:
    """Split section text into entry blocks based on heading patterns.

    Applies heading patterns to find entry boundaries. Each entry block spans
    from one heading match to the next (or end of section for the last entry).
    Heading normalization is applied for matching.

    Args:
        section_text: Text of the section to split.
        heading_patterns: List of HeadingPattern objects.

    Returns:
        List of text blocks, one per matched heading entry.
    """
    if not heading_patterns:
        return []

    # Find all heading match positions
    heading_positions: list[int] = []

    for hp in heading_patterns:
        flags = re.MULTILINE
        if hp.flags:
            for flag_name in hp.flags:
                flag_val = getattr(re, flag_name, None)
                if flag_val is not None:
                    flags |= flag_val

        for match in re.finditer(hp.regex, section_text, flags):
            heading_positions.append(match.start())

    if not heading_positions:
        return []

    # Sort and deduplicate positions
    heading_positions = sorted(set(heading_positions))

    # Split into blocks
    blocks: list[str] = []
    for i, start in enumerate(heading_positions):
        if i + 1 < len(heading_positions):
            end = heading_positions[i + 1]
        else:
            end = len(section_text)
        block = section_text[start:end]
        if block.strip():
            blocks.append(block)

    return blocks
