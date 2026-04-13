"""Render the in-app Review character sheet to PDF.

Primary: **Playwright + Chromium** (same layout engine as Chrome — colors, grid, borders).
Output is **A4** (`character-sheet-pdf-a4.css` + viewport tuned for A4 width).
Fallback: PyMuPDF Story (limited CSS; used if Playwright/Chromium is unavailable).

After `pip install -r requirements.txt`, install the browser once:
`playwright install chromium`
"""

from __future__ import annotations

import base64
import io
import logging
import os
import re
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response

from app.config import STATIC_DIR

router = APIRouter(tags=["export"])
logger = logging.getLogger(__name__)

try:
    import fitz  # PyMuPDF
except ImportError as e:  # pragma: no cover
    fitz = None  # type: ignore[misc, assignment]
    _import_err = e
else:
    _import_err = None

SHEET_HTML_MAX = 4_000_000


def _strip_scripts_and_handlers(html: str) -> str:
    out = re.sub(r"(?is)<script\b[^>]*>.*?</script>", "", html)
    out = re.sub(r"(?i)\s+on\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", out)
    return out


def _expand_css_variables(css: str) -> str:
    """Inline `--cs-*` (and related) custom properties for engines with weak `var()` support."""
    m = re.search(r"\.character-sheet\s*\{([^}]*)\}", css, flags=re.DOTALL)
    if m:
        block = m.group(1)
        vars_map: dict[str, str] = {}
        for vm in re.finditer(r"(--cs-[\w-]+|--border)\s*:\s*([^;]+);", block):
            vars_map[vm.group(1)] = vm.group(2).strip()
        for name, val in vars_map.items():
            esc = re.escape(name)
            css = re.sub(rf"var\(\s*{esc}\s*\)", val, css)
            css = re.sub(rf"var\(\s*{esc}\s*,\s*([^)]+)\)", lambda mm, v=val: v, css)
    css = re.sub(r"var\(\s*--border\s*,\s*([^)]+)\)", r"\1", css)
    return css


def _html_to_pdf_bytes_story(html_document: str) -> bytes:
    if fitz is None:
        raise HTTPException(
            status_code=503,
            detail="PyMuPDF is not installed on the server. Add pymupdf to requirements.txt and reinstall.",
        ) from _import_err
    story = fitz.Story(html_document)
    stream = io.BytesIO()
    writer = fitz.DocumentWriter(stream)
    mediabox = fitz.paper_rect("a4")
    where = mediabox + (28, 28, -28, -28)
    more = 1
    while more:
        dev = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(dev)
        writer.end_page()
    writer.close()
    stream.seek(0)
    raw = stream.getvalue()
    if not raw:
        raise HTTPException(status_code=500, detail="Story produced an empty PDF.")
    return raw


def _html_to_pdf_bytes_playwright(html_document: str) -> bytes:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            # ~A4 printable width at 96dpi (210mm − 20mm margins) so layout matches A4 pages, not a scaled Letter canvas.
            page.set_viewport_size({"width": 720, "height": 1100})
            page.set_content(html_document, wait_until="load", timeout=120_000)
            return page.pdf(
                format="A4",
                print_background=True,
                prefer_css_page_size=True,
            )
        finally:
            browser.close()


def _pdf_engine() -> str:
    v = os.environ.get("SCION_REVIEW_SHEET_PDF_ENGINE", "auto").strip().lower()
    if v in ("auto", "playwright", "story"):
        return v
    return "auto"


@router.post("/api/export/review-sheet-pdf", response_model=None)
def post_review_sheet_pdf(body: dict[str, Any]) -> JSONResponse | Response:
    """
    Body: `{ "sheetHtml": "<div class=…>", "characterName"?: str, "transfer"?: "base64" }`
    Default: JSON `{ filename, byteLength, pdfBase64, renderer }` when transfer=base64.
    """
    raw_html = body.get("sheetHtml") or body.get("html")
    if not isinstance(raw_html, str) or not raw_html.strip():
        raise HTTPException(status_code=400, detail='Expected non-empty "sheetHtml" string.')
    if len(raw_html) > SHEET_HTML_MAX:
        raise HTTPException(status_code=400, detail="sheetHtml exceeds size limit.")

    css_path = STATIC_DIR / "css" / "character-sheet.css"
    if not css_path.is_file():
        raise HTTPException(status_code=500, detail=f"Missing stylesheet: {css_path}")
    css = _expand_css_variables(css_path.read_text(encoding="utf-8", errors="replace"))
    pdf_css_path = STATIC_DIR / "css" / "character-sheet-pdf-a4.css"
    pdf_css = pdf_css_path.read_text(encoding="utf-8", errors="replace") if pdf_css_path.is_file() else ""

    fragment = _strip_scripts_and_handlers(raw_html.strip())
    full_html = (
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>"
        "<meta name=\"viewport\" content=\"width=720\"/>"
        f"<style>{css}</style>"
        f"<style>{pdf_css}</style>"
        "</head><body class=\"sheet-pdf-export\">"
        f"{fragment}</body></html>"
    )

    engine = _pdf_engine()
    renderer = "story"
    renderer_note: str | None = None
    pdf_bytes: bytes

    if engine == "story":
        pdf_bytes = _html_to_pdf_bytes_story(full_html)
    elif engine == "playwright":
        try:
            pdf_bytes = _html_to_pdf_bytes_playwright(full_html)
            renderer = "playwright"
        except Exception as e:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Playwright PDF export failed (install browsers: `playwright install chromium`). "
                    f"Original error: {e}"
                ),
            ) from e
    else:
        try:
            pdf_bytes = _html_to_pdf_bytes_playwright(full_html)
            renderer = "playwright"
        except Exception as e:
            logger.warning("Playwright sheet PDF failed; falling back to PyMuPDF Story: %s", e)
            pdf_bytes = _html_to_pdf_bytes_story(full_html)
            renderer = "story"
            renderer_note = (
                "Chromium/Playwright was unavailable or failed; used PyMuPDF Story (simpler CSS). "
                "For full colors and layout run: `pip install playwright && playwright install chromium`, "
                "or set SCION_REVIEW_SHEET_PDF_ENGINE=playwright after installing."
            )

    base = re.sub(
        r"[^\w\-]+",
        "_",
        str(body.get("downloadName") or body.get("characterName") or "character").strip(),
        flags=re.UNICODE,
    )
    base = (base[:80] or "character").strip("_") or "character"
    fn = f"{base}-character-sheet.pdf"

    transfer = str(body.get("transfer") or "").strip().lower()
    if transfer == "base64":
        payload: dict[str, Any] = {
            "filename": fn,
            "byteLength": len(pdf_bytes),
            "pdfBase64": base64.standard_b64encode(pdf_bytes).decode("ascii"),
            "renderer": renderer,
        }
        if renderer_note:
            payload["rendererNote"] = renderer_note
        return JSONResponse(payload)

    headers: dict[str, str] = {"Content-Disposition": f'attachment; filename="{fn}"'}
    if renderer_note:
        headers["X-Sheet-Pdf-Renderer-Note"] = renderer_note[:2000]
    headers["X-Sheet-Pdf-Renderer"] = renderer
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
