/**
 * Export the Review on-screen character sheet to PDF.
 * Server prefers **Playwright + Chromium** (matches browser layout, colors, borders).
 * PDFs are **A4** (`character-sheet-pdf-a4.css`, ~720px layout width).
 * If Chromium is not installed, falls back to PyMuPDF Story (limited CSS).
 * One-time setup: `pip install -r requirements.txt` then `playwright install chromium`.
 */

import { apiUrl } from "./apiBase.js";

/**
 * @param {HTMLElement} sheetRoot — `.character-sheet` element from Review
 * @param {string} [downloadName]
 */
export async function downloadReviewSheetAsPdf(sheetRoot, downloadName) {
  if (!sheetRoot || !(sheetRoot instanceof HTMLElement)) {
    throw new Error("Missing character sheet element.");
  }
  const sheetHtml = sheetRoot.outerHTML;
  const r = await fetch(apiUrl("api/export/review-sheet-pdf"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sheetHtml,
      characterName: downloadName,
      transfer: "base64",
    }),
    cache: "no-store",
  });
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const j = await r.json();
      if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      try {
        msg = await r.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg || `HTTP ${r.status}`);
  }
  const j = await r.json();
  if (j && j.renderer === "story" && typeof j.rendererNote === "string" && j.rendererNote.trim()) {
    console.warn(j.rendererNote);
  }
  const b64 = j && typeof j.pdfBase64 === "string" ? j.pdfBase64 : "";
  if (!b64) {
    throw new Error("Server did not return pdfBase64.");
  }
  let bytes;
  try {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
  const expected = Number(j.byteLength);
  if (Number.isFinite(expected) && expected > 0 && bytes.byteLength !== expected) {
    throw new Error(`PDF size mismatch after decode (got ${bytes.byteLength}, expected ${expected}).`);
  }
  if (!bytes.byteLength) {
    throw new Error("Decoded PDF is empty.");
  }
  let fn = typeof j.filename === "string" && j.filename.trim() ? j.filename.trim() : "character-sheet.pdf";
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fn;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
