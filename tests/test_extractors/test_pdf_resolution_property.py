"""Property-based test for PDF resolution precedence.

# Feature: unified-pdf-extractor, Property 1: PDF Resolution Precedence

For any set of directories where some contain matching PDF filenames and a
Book Spec with N filename variants, `resolve_pdf` SHALL return the file from
the highest-precedence directory, and within that directory, the first
filename variant from the spec's list that exists.

**Validates: Requirements 2.1, 2.2**
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from hypothesis import assume, given, settings
from hypothesis import strategies as st

from parser_framework.ingest_engine import resolve_pdf
from parser_framework.models import BookSpec, HeadingPattern, SectionAnchor
from scion_books_dir import books_search_dirs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_spec(filenames: list[str]) -> BookSpec:
    """Create a minimal BookSpec with the given filename variants."""
    return BookSpec(
        book_id="test_book",
        filenames=filenames,
        output_path="src/data/_extracted/test.txt",
        section_anchors=[SectionAnchor(pattern="TEST")],
        heading_patterns=[HeadingPattern(regex="^TEST$")],
        expected_fields=["name"],
        pipeline_stages=["ingest"],
    )


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Generate a list of unique PDF filenames (the spec's filename variants)
_filename_variants = st.lists(
    st.from_regex(r"[a-z][a-z0-9_]{2,12}\.pdf", fullmatch=True),
    min_size=1,
    max_size=5,
    unique=True,
)

# Number of directories in the search path
_num_dirs = st.integers(min_value=2, max_value=6)


# ---------------------------------------------------------------------------
# Feature: unified-pdf-extractor, Property 1: PDF Resolution Precedence
# ---------------------------------------------------------------------------


class TestPDFResolutionPrecedence:
    """Property 1: PDF Resolution Precedence.

    For any set of directories where some contain matching PDF filenames and a
    Book Spec with N filename variants, `resolve_pdf` SHALL return the file
    from the highest-precedence directory, and within that directory, the first
    filename variant from the spec's list that exists.

    **Validates: Requirements 2.1, 2.2**
    """

    @given(
        num_dirs=_num_dirs,
        filenames=_filename_variants,
        high_dir_idx=st.integers(min_value=0, max_value=5),
        low_dir_idx=st.integers(min_value=0, max_value=5),
        high_filename_idx=st.integers(min_value=0, max_value=4),
        low_filename_idx=st.integers(min_value=0, max_value=4),
    )
    @settings(max_examples=100)
    def test_highest_precedence_directory_wins(
        self,
        num_dirs: int,
        filenames: list[str],
        high_dir_idx: int,
        low_dir_idx: int,
        high_filename_idx: int,
        low_filename_idx: int,
    ) -> None:
        """A file in a higher-precedence directory always wins, regardless
        of which filename variant it matches."""
        # Constrain indices to valid ranges
        high_dir_idx = high_dir_idx % num_dirs
        low_dir_idx = low_dir_idx % num_dirs
        assume(high_dir_idx < low_dir_idx)

        high_filename_idx = high_filename_idx % len(filenames)
        low_filename_idx = low_filename_idx % len(filenames)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create search directories
            dirs: list[Path] = []
            for i in range(num_dirs):
                d = tmp_path / f"dir_{i}"
                d.mkdir()
                dirs.append(d)

            # Place a file in the higher-precedence directory (any filename variant)
            high_file = dirs[high_dir_idx] / filenames[high_filename_idx]
            high_file.write_text("high_priority", encoding="utf-8")

            # Place a file in the lower-precedence directory (any filename variant)
            low_file = dirs[low_dir_idx] / filenames[low_filename_idx]
            low_file.write_text("low_priority", encoding="utf-8")

            spec = _make_spec(filenames)
            result = resolve_pdf(spec, dirs)

            # Result must be from the higher-precedence directory
            assert result.parent == dirs[high_dir_idx], (
                f"Expected result from dir index {high_dir_idx} ({dirs[high_dir_idx]}), "
                f"got {result.parent}. Higher-precedence directory must always win."
            )

    @given(
        num_dirs=_num_dirs,
        filenames=st.lists(
            st.from_regex(r"[a-z][a-z0-9_]{2,12}\.pdf", fullmatch=True),
            min_size=2,
            max_size=5,
            unique=True,
        ),
        dir_idx=st.integers(min_value=0, max_value=5),
        present_indices=st.lists(
            st.integers(min_value=0, max_value=4),
            min_size=2,
            max_size=5,
        ),
    )
    @settings(max_examples=100)
    def test_first_filename_variant_wins_within_same_directory(
        self,
        num_dirs: int,
        filenames: list[str],
        dir_idx: int,
        present_indices: list[int],
    ) -> None:
        """Within a single directory, the first filename variant from the
        spec's list that exists is returned."""
        dir_idx = dir_idx % num_dirs

        # Map indices to valid filename positions and deduplicate
        valid_indices = sorted(set(idx % len(filenames) for idx in present_indices))
        assume(len(valid_indices) >= 2)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create directories
            dirs: list[Path] = []
            for i in range(num_dirs):
                d = tmp_path / f"dir_{i}"
                d.mkdir()
                dirs.append(d)

            # Place multiple filename variants in the same directory
            for idx in valid_indices:
                f = dirs[dir_idx] / filenames[idx]
                f.write_text(f"variant_{idx}", encoding="utf-8")

            spec = _make_spec(filenames)
            result = resolve_pdf(spec, dirs)

            # The result must be the first variant (by spec declaration order)
            expected_filename = filenames[valid_indices[0]]
            expected = dirs[dir_idx] / expected_filename
            assert result == expected, (
                f"Expected first variant '{expected_filename}' (index {valid_indices[0]}), "
                f"got '{result.name}'. First filename variant in spec's list must win."
            )

    @given(
        num_dirs=_num_dirs,
        filenames=_filename_variants,
        placement=st.lists(
            st.tuples(
                st.integers(min_value=0, max_value=5),
                st.integers(min_value=0, max_value=4),
            ),
            min_size=1,
            max_size=8,
        ),
    )
    @settings(max_examples=100)
    def test_combined_precedence_invariant(
        self,
        num_dirs: int,
        filenames: list[str],
        placement: list[tuple[int, int]],
    ) -> None:
        """The combined invariant: resolve_pdf returns the file from the
        highest-precedence directory, and within that directory, the first
        filename variant that exists."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create directories
            dirs: list[Path] = []
            for i in range(num_dirs):
                d = tmp_path / f"dir_{i}"
                d.mkdir()
                dirs.append(d)

            # Place files according to generated placement
            placed_files: list[tuple[int, int, Path]] = []
            for raw_dir_idx, raw_fname_idx in placement:
                d_idx = raw_dir_idx % num_dirs
                f_idx = raw_fname_idx % len(filenames)
                filepath = dirs[d_idx] / filenames[f_idx]
                if not filepath.exists():
                    filepath.write_text(f"d{d_idx}_f{f_idx}", encoding="utf-8")
                    placed_files.append((d_idx, f_idx, filepath))

            assume(len(placed_files) > 0)

            spec = _make_spec(filenames)
            result = resolve_pdf(spec, dirs)

            # Compute expected: highest-precedence dir (lowest index) that has
            # any file, then first filename variant in that dir
            min_dir = min(d_idx for d_idx, _, _ in placed_files)
            # Among files in that directory, find first by filename order
            files_in_min_dir = [
                (f_idx, path)
                for d_idx, f_idx, path in placed_files
                if d_idx == min_dir
            ]
            files_in_min_dir.sort(key=lambda x: x[0])
            expected_path = files_in_min_dir[0][1]

            assert result == expected_path, (
                f"Expected {expected_path} (dir={min_dir}, "
                f"filename='{expected_path.name}'), got {result}. "
                f"Precedence: highest-priority dir first, then first filename variant."
            )

    @given(
        explicit_dir_name=st.from_regex(r"[a-z][a-z0-9]{2,8}", fullmatch=True),
        env_dir_name=st.from_regex(r"[a-z][a-z0-9]{2,8}", fullmatch=True),
    )
    @settings(max_examples=100)
    def test_books_search_dirs_explicit_before_env(
        self,
        explicit_dir_name: str,
        env_dir_name: str,
    ) -> None:
        """books_search_dirs places explicit dir before env var dir in the
        returned list, confirming the precedence order."""
        import os

        assume(explicit_dir_name != env_dir_name)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            explicit_dir = tmp_path / explicit_dir_name
            explicit_dir.mkdir()
            env_dir = tmp_path / env_dir_name
            env_dir.mkdir()

            old_env = os.environ.get("SCION_BOOKS_DIR")
            try:
                os.environ["SCION_BOOKS_DIR"] = str(env_dir)
                result = books_search_dirs(explicit_dir=explicit_dir)
            finally:
                if old_env is None:
                    os.environ.pop("SCION_BOOKS_DIR", None)
                else:
                    os.environ["SCION_BOOKS_DIR"] = old_env

            # Explicit dir must come before env dir
            explicit_resolved = explicit_dir.resolve()
            env_resolved = env_dir.resolve()

            assert explicit_resolved in result, (
                f"Explicit dir {explicit_resolved} not in search dirs"
            )
            assert env_resolved in result, (
                f"Env dir {env_resolved} not in search dirs"
            )
            explicit_pos = result.index(explicit_resolved)
            env_pos = result.index(env_resolved)
            assert explicit_pos < env_pos, (
                f"Explicit dir (pos={explicit_pos}) must come before "
                f"env dir (pos={env_pos}) in search dirs."
            )
