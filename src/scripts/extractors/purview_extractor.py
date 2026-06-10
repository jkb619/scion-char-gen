"""Purview category extractor.

Locates the Standard Purviews section in ingested PDF text, splits by
purview heading pattern, extracts boon ladder names (padded to 12),
innate power summaries, and derives camelCase IDs.
"""

from __future__ import annotations

import re
from typing import Any

from extractors.base import CategoryExtractor, CategoryResult, LogEntry
from parser_framework.models import BookSpec


# Page marker format used by ingest_engine: "===== Page N / Total ====="
_PAGE_MARKER_RE = re.compile(r"===== Page (\d+) / \d+ =====")

# Boon entry heading pattern: ALL-CAPS title followed by newline then "Cost:"
_BOON_HEAD_RE = re.compile(r"^([A-Z][A-Z0-9 '\u2019\-\.&,]+)\nCost:", re.MULTILINE)

# Innate Power pattern (appears in some PDFs like saints_monsters, mysteries_of_the_world)
_INNATE_POWER_RE = re.compile(
    r"Innate\s*\n?\s*Power:\s*(.+?)(?=\n[A-Z][A-Z0-9 '\u2019\-\.&,]+\nCost:|\Z)",
    re.DOTALL,
)

# Alternative innate power heading (single line)
_INNATE_POWER_SINGLE_RE = re.compile(
    r"Innate Power:\s*(.+?)(?=\n[A-Z][A-Z0-9 '\u2019\-\.&,]+\nCost:|\Z)",
    re.DOTALL,
)


def _name_to_camel_case(name: str) -> str:
    """Convert a display name like 'Epic Strength' to camelCase id 'epicStrength'.

    Strips punctuation, splits on whitespace, lowercases first word,
    capitalizes subsequent words.
    """
    # Remove punctuation except apostrophes within words
    cleaned = re.sub(r"[^\w\s']", "", name)
    # Split on whitespace
    words = cleaned.split()
    if not words:
        return ""
    # First word lowercase, subsequent words capitalized
    parts = [words[0].lower()]
    for w in words[1:]:
        parts.append(w[0].upper() + w[1:].lower() if len(w) > 1 else w.upper())
    result = "".join(parts)
    # Remove apostrophes from final id
    result = result.replace("'", "").replace("\u2019", "")
    return result


def _title_case_boon(s: str) -> str:
    """Convert ALL-CAPS boon heading to readable title case.

    Follows the same logic as the legacy extract_pb_boon_ladders.py script.
    """
    parts: list[str] = []
    for w in s.split():
        wl = w.lower()
        if "'" in wl or "\u2019" in wl:
            # Normalize curly apostrophe to straight
            wl_norm = wl.replace("\u2019", "'")
            bits = [b[:1].upper() + b[1:] if b else "" for b in wl_norm.split("'")]
            parts.append("'".join(bits))
        else:
            parts.append(wl[:1].upper() + wl[1:])
    # Lowercase small words (except first)
    small = {"Of", "The", "And", "To", "For", "In", "On", "At", "Or", "A", "An"}
    fixed: list[str] = []
    for i, p in enumerate(parts):
        if i > 0 and p in small:
            fixed.append(p.lower())
        else:
            fixed.append(p)
    return " ".join(fixed)


def _pad_to_12(names: list[str]) -> list[str]:
    """Pad boon ladder names list to exactly length 12 with trailing empty strings."""
    out = names[:12]
    while len(out) < 12:
        out.append("")
    return out


def _get_page_number(text: str, position: int, filename: str) -> str:
    """Find the page number for a position in the text by looking at preceding page markers."""
    # Search backwards from position for the nearest page marker
    preceding_text = text[:position]
    markers = list(_PAGE_MARKER_RE.finditer(preceding_text))
    if markers:
        page_num = markers[-1].group(1)
        return f"{filename} p.{page_num}"
    return f"{filename} p.1"


def _normalize_text(text: str) -> str:
    """Normalize curly quotes and apostrophes to straight equivalents."""
    return (
        text.replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


class PurviewExtractor(CategoryExtractor):
    """Extractor for purview definitions with boon ladders and innate powers."""

    def extract(self, text: str, spec: BookSpec, category_config: dict) -> CategoryResult:
        """Extract purview entries from ingested text.

        Strategy:
        1. Locate the Purviews chapter section using section anchors.
        2. Split by purview heading pattern to isolate each purview block.
        3. Extract boonLadderNames (ordered list of boon titles, padded to 12).
        4. Extract purviewInnateSummary from "Innate Power" subsection.
        5. Derive id from name (camelCase).
        """
        log: list[LogEntry] = []
        entries: dict[str, Any] = {}

        # Determine the source filename from the spec
        filename = spec.filenames[0] if spec.filenames else "unknown.pdf"

        # Normalize text
        normalized = _normalize_text(text)

        # Get section anchors from config
        section_anchors = category_config.get("section_anchors", [])

        # Get heading pattern from config (or use default purview heading pattern)
        heading_config = category_config.get("heading_pattern", {})
        heading_regex = heading_config.get("regex", r"^(?P<name>[A-Z][A-Za-z ]+)$")
        heading_flags = heading_config.get("flags", ["MULTILINE"])
        re_flags = 0
        for flag_name in heading_flags:
            re_flags |= getattr(re, flag_name, 0)

        # Find the purviews section start
        section_start = self._find_section_start(normalized, section_anchors)
        if section_start < 0:
            log.append(
                LogEntry(
                    entry_id="",
                    field="section",
                    reason="anchor_not_found",
                    detail="Could not locate Purviews section in text",
                )
            )
            return CategoryResult(
                category="purviews",
                entries={},
                entry_count=0,
                log=log,
            )

        # Work with text from section start to section end
        section_end = self._find_section_end(normalized, section_start)
        section_text = normalized[section_start:section_end]

        # Find purview headings — these are ALL-CAPS single-word or multi-word lines
        # that start a purview block, followed by boon entries
        purview_blocks = self._split_into_purview_blocks(section_text)

        for purview_name, block_text, block_offset in purview_blocks:
            purview_id = _name_to_camel_case(purview_name)
            if not purview_id:
                continue

            # Extract boon ladder names from the block
            boon_names = self._extract_boon_names(block_text)
            boon_ladder = _pad_to_12(boon_names)

            # Extract innate power summary
            innate_summary, innate_name = self._extract_innate_power(block_text)

            # Get source page number
            abs_position = section_start + block_offset
            source = _get_page_number(text, abs_position, filename)

            entry: dict[str, Any] = {
                "id": purview_id,
                "name": purview_name,
                "description": "",
                "mechanicalEffects": "",
                "source": source,
                "boonLadderNames": boon_ladder,
            }

            if innate_summary:
                entry["purviewInnateSummary"] = innate_summary
            if innate_name:
                entry["purviewInnateName"] = innate_name

            entries[purview_id] = entry

            if not boon_names:
                log.append(
                    LogEntry(
                        entry_id=purview_id,
                        field="boonLadderNames",
                        reason="not_found",
                        detail=f"No boon titles found for purview '{purview_name}'",
                    )
                )

        return CategoryResult(
            category="purviews",
            entries=entries,
            entry_count=len(entries),
            log=log,
        )

    def validate_config(self, category_config: dict) -> list[str]:
        """Validate purview category configuration block."""
        errors: list[str] = []
        if "output_path" not in category_config:
            errors.append("purviews: missing required field 'output_path'")
        if "section_anchors" not in category_config:
            errors.append("purviews: missing required field 'section_anchors'")
        return errors

    def _find_section_start(self, text: str, section_anchors: list[dict]) -> int:
        """Find the start of the purviews section using configured anchors."""
        for anchor in section_anchors:
            pattern = anchor.get("pattern", "")
            pattern_type = anchor.get("pattern_type", "literal")

            if pattern_type == "literal":
                # Look for the literal text as a line
                # Try various forms: exact match, as a standalone line
                needle = f"\n{pattern}\n"
                pos = text.find(needle)
                if pos >= 0:
                    return pos + 1  # skip the leading newline

                # Also try with the text appearing at start
                if text.startswith(f"{pattern}\n"):
                    return 0
            elif pattern_type == "regex":
                flags = 0
                if anchor.get("case_insensitive"):
                    flags |= re.IGNORECASE
                flags |= re.MULTILINE
                match = re.search(pattern, text, flags)
                if match:
                    return match.start()

        # Fallback: look for "STANDARD PURVIEWS" which is common in Pandora's Box
        fallback_patterns = [
            "\nSTANDARD PURVIEWS\n",
            "\nSTANDARD PURVIEWS",
            "\nPurviews\n",
            "\nPURVIEWS\n",
        ]
        for fp in fallback_patterns:
            pos = text.find(fp)
            if pos >= 0:
                return pos + 1
        return -1

    def _find_section_end(self, text: str, section_start: int) -> int:
        """Find where the purviews section ends.

        Looks for known section boundaries that appear after standard purviews:
        UNIVERSAL, DRAGON MAGIC, PRIMEVAL, TITANIC, etc.
        """
        section_text = text[section_start:]
        # Patterns that signal end of the standard purviews section
        end_markers = [
            "\nUNIVERSAL\n",
            "\nDRAGON MAGIC\n",
            "\nDRAGON MAGIC \n",
            "\nPRIMEVAL PURVIEWS\n",
            "\nPRIMEVAL\n",
            "\nTITANIC PURVIEWS\n",
            "\nDENIZEN PURVIEW",
            "\nDENIZEN SIGNATURE",
            "\nPANTHEON SIGNATURE",
        ]
        end_pos = len(text)
        for marker in end_markers:
            pos = section_text.find(marker)
            if pos >= 0:
                absolute_pos = section_start + pos
                if absolute_pos < end_pos:
                    end_pos = absolute_pos
        return end_pos

    def _split_into_purview_blocks(self, section_text: str) -> list[tuple[str, str, int]]:
        """Split the purview section into individual purview blocks.

        Returns list of (purview_name, block_text, offset_in_section_text).

        Purview headings are ALL-CAPS lines that are NOT immediately followed
        by "Cost:" (which would make them boon entries). A purview heading is
        followed by its boon entries (which do have "Cost:" after them).
        """
        # Find all ALL-CAPS headings
        heading_re = re.compile(r"^([A-Z][A-Z0-9 '\u2019\-\.&,]+)$", re.MULTILINE)

        skip_headings = {
            "STANDARD PURVIEWS",
            "PURVIEWS",
            "BOONS",
            "TABLE OF CONTENTS",
            "DENIZEN SIGNATURE PURVIEWS",
            "PANTHEON SIGNATURE PURVIEWS",
            "DENIZEN PURVIEW",
            "PRIMEVAL PURVIEWS",
        }

        # Noise patterns: page headers, footers, or book-title lines that
        # repeat throughout the PDF and should never be treated as purviews.
        noise_re = re.compile(
            r"^P\s*ANDORA|^SCION|^BOONS?\s*\d|^TABLE OF CONTENTS|^\d+$",
            re.IGNORECASE,
        )

        # Identify purview headings: ALL-CAPS lines NOT followed by "Cost:"
        # (Boon entries have "Cost:" on the line after the heading)
        purview_headings: list[tuple[str, int]] = []

        for match in heading_re.finditer(section_text):
            name_raw = match.group(1).strip()
            # Skip very short or noise lines
            if len(name_raw) < 3:
                continue
            if name_raw in skip_headings:
                continue
            # Skip page headers and other noise patterns
            if noise_re.search(name_raw):
                continue

            # Check if the next non-empty line after this heading is "Cost:"
            after_heading = section_text[match.end():]
            # Strip leading newline(s) to find the next content line
            next_content = after_heading.lstrip("\n")
            if next_content.startswith("Cost:") or next_content.startswith("Cost :"):
                # This is a boon entry, not a purview heading
                continue

            # This is a potential purview heading
            name = name_raw.title()
            purview_headings.append((name, match.start()))

        # Split into blocks: each purview block runs from its heading to the next
        blocks: list[tuple[str, str, int]] = []
        for i, (name, start) in enumerate(purview_headings):
            end = purview_headings[i + 1][1] if i + 1 < len(purview_headings) else len(section_text)
            block_text = section_text[start:end]

            # Verify this heading actually has boon entries
            if _BOON_HEAD_RE.search(block_text):
                blocks.append((name, block_text, start))

        return blocks

    def _extract_boon_names(self, block_text: str) -> list[str]:
        """Extract ordered boon title names from a purview block.

        Boon entries are identified by ALL-CAPS heading followed by "Cost:".
        """
        raw_titles = _BOON_HEAD_RE.findall(block_text)
        out: list[str] = []
        # Get the purview heading (first line of block) to filter it out
        first_line = block_text.split("\n")[0].strip()

        for raw in raw_titles:
            title = " ".join(raw.split()).strip()
            # Skip if it looks like the section header itself
            if not title or len(title) > 72:
                continue
            # Skip if it matches the purview heading
            if title.upper() == first_line.upper():
                continue
            out.append(_title_case_boon(title))
        return out

    def _extract_innate_power(self, block_text: str) -> tuple[str | None, str | None]:
        """Extract innate power summary and name from a purview block.

        Returns (summary, name) tuple. Either can be None if not found.
        """
        # Try multi-line pattern first (PDF text often breaks "Innate\nPower:")
        match = _INNATE_POWER_RE.search(block_text)
        if not match:
            match = _INNATE_POWER_SINGLE_RE.search(block_text)

        if not match:
            return None, None

        summary_raw = match.group(1).strip()
        # Clean up: collapse multiple whitespace/newlines
        summary = re.sub(r"\s+", " ", summary_raw).strip()

        # Try to extract a name for the innate power
        # Look for a heading before "Innate Power:" in the block
        innate_pos = match.start()
        preceding = block_text[:innate_pos]
        # Look for a title-case line just before innate power
        name_match = re.search(
            r"^([A-Z][a-z]+(?:\s+[A-Za-z]+)*)\s*$",
            preceding,
            re.MULTILINE,
        )
        innate_name = name_match.group(1).strip() if name_match else None

        return summary if summary else None, innate_name
