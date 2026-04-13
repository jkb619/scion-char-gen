#!/usr/bin/env python3
"""Emit AcroForm widget names per page for the local interactive sheet PDFs (pymupdf).

Windows paths (run from WSL):
  /mnt/c/Users/John/Desktop/Scion/Scion_2ndED_Complete_4-Page_Interactive.pdf
  /mnt/c/Users/John/Desktop/Scion/Scion_2ndED_Dragon_4-Page_Interactive.pdf

Output: src/scripts/interactive_sheet_fields_manifest.json (for pdf-lib / export tooling).
"""
from __future__ import annotations

import json
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError as e:
    raise SystemExit("Install PyMuPDF: pip install pymupdf") from e

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
OUT = SRC / "scripts" / "interactive_sheet_fields_manifest.json"

PDFS = {
    "scion2eComplete4PageInteractive": Path(
        "/mnt/c/Users/John/Desktop/Scion/Scion_2ndED_Complete_4-Page_Interactive.pdf"
    ),
    "scion2eDragon4PageInteractive": Path("/mnt/c/Users/John/Desktop/Scion/Scion_2ndED_Dragon_4-Page_Interactive.pdf"),
}


def page_field_rows(doc: fitz.Document, page_index: int) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    page = doc[page_index]
    for w in page.widgets() or []:
        if not w.field_name:
            continue
        rows.append((str(w.field_name), str(w.field_type_string)))
    return rows


def main() -> None:
    manifest: dict[str, object] = {
        "_meta": {
            "note": "AcroForm fields per PDF page: [fieldName, fieldType]. Regenerate: PYTHONPATH=src python3 src/scripts/export_interactive_sheet_field_manifest.py"
        }
    }
    for key, path in PDFS.items():
        if not path.is_file():
            manifest[key] = {"error": "missing", "path": str(path)}
            continue
        doc = fitz.open(path)
        try:
            pages = []
            for i in range(doc.page_count):
                pages.append({"page": i + 1, "fields": [list(t) for t in page_field_rows(doc, i)]})
            manifest[key] = {
                "path": str(path),
                "pageCount": doc.page_count,
                "widgetCount": sum(len(p["fields"]) for p in pages),
                "pages": pages,
            }
        finally:
            doc.close()
    OUT.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
