"""Shared fixtures and path setup for book-source-filter tests."""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure src/ is importable so that `from app.services...` works.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_SRC_DIR = _REPO_ROOT / "src"

if str(_SRC_DIR) not in sys.path:
    sys.path.insert(0, str(_SRC_DIR))
