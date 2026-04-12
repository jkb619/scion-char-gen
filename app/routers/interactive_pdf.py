"""Fill local AcroForm character sheet PDFs (community interactive sheets) from client-built field maps."""

from __future__ import annotations

import base64
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response

from app.config import INTERACTIVE_SHEET_DRAGON_PDF, INTERACTIVE_SHEET_SCION_PDF

router = APIRouter(tags=["export"])

try:
    import fitz  # PyMuPDF
except ImportError as e:  # pragma: no cover
    fitz = None  # type: ignore[misc, assignment]
    _import_err = e
else:
    _import_err = None


def _safe_filename_base(name: str) -> str:
    t = re.sub(r"[^\w\-]+", "_", (name or "character").strip(), flags=re.UNICODE)
    return (t[:80] or "character").strip("_") or "character"


def _apply_fields(doc: "fitz.Document", fields: dict[str, Any]) -> None:
    for page in doc:
        for w in page.widgets() or []:
            fn = w.field_name
            if not fn or fn not in fields:
                continue
            val = fields[fn]
            if w.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                w.field_value = "Yes" if bool(val) else "Off"
            else:
                if val is None:
                    w.field_value = ""
                elif isinstance(val, bool):
                    w.field_value = "Yes" if val else ""
                else:
                    s = str(val)
                    # Avoid oversized single-line bursts in some readers
                    if len(s) > 4000:
                        s = s[:3997] + "…"
                    w.field_value = s
            w.update()


def _fill_pdf(path: Path, fields: dict[str, Any]) -> bytes:
    if fitz is None:
        raise HTTPException(
            status_code=503,
            detail="PyMuPDF is not installed on the server. Add pymupdf to requirements.txt and reinstall.",
        ) from _import_err
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"Interactive sheet template not found: {path}. Set SCION_INTERACTIVE_SHEET_PDF or SCION_DRAGON_INTERACTIVE_SHEET_PDF.",
        )
    doc = fitz.open(path)
    try:
        _apply_fields(doc, fields)
        return doc.tobytes(deflate=True, garbage=4)
    finally:
        doc.close()


@router.post("/api/export/interactive-pdf")
def post_interactive_pdf(body: dict[str, Any]) -> Response:
    """
    Body JSON: `{ "lineage": "scion" | "dragon", "fields": { "name": "...", "skills1": "...", ... } }`
    Field values: strings for text fields; booleans for checkboxes (true = checked).

    Optional `"transfer": "base64"` returns `{ "filename": "…", "pdfBase64": "…" }` (application/json)
    so the browser can rebuild the file without relying on a binary response body (some stacks
    deliver an empty body for large application/pdf responses).
    """
    lineage = str(body.get("lineage") or "").strip().lower()
    fields = body.get("fields")
    if lineage not in ("scion", "dragon"):
        raise HTTPException(status_code=400, detail='Expected "lineage": "scion" or "dragon".')
    if not isinstance(fields, dict) or not fields:
        raise HTTPException(status_code=400, detail='Expected non-empty "fields" object.')

    path = INTERACTIVE_SHEET_DRAGON_PDF if lineage == "dragon" else INTERACTIVE_SHEET_SCION_PDF
    pdf_bytes = _fill_pdf(path, fields)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="Filled PDF produced no bytes (template or save failed).")
    base = _safe_filename_base(str(body.get("downloadName") or body.get("characterName") or "character"))
    suffix = "dragon-interactive" if lineage == "dragon" else "scion-interactive"
    fn = f"{base}-{suffix}.pdf"
    transfer = str(body.get("transfer") or "").strip().lower()
    if transfer == "base64":
        return JSONResponse(
            {
                "filename": fn,
                "byteLength": len(pdf_bytes),
                "pdfBase64": base64.standard_b64encode(pdf_bytes).decode("ascii"),
            },
        )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{fn}"',
            "X-PDF-Byte-Count": str(len(pdf_bytes)),
        },
    )
