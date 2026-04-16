/**
 * Turn bundled-game `source` strings (often local PDF filenames) into reader-facing
 * book titles; page references already in the string (p. / pp.) are preserved.
 */

/** @type {Record<string, string>} — keys are exact filename tokens as stored in JSON. */
const PDF_FILENAME_TO_BOOK_TITLE = {
  "SCION_Pandoras_Box_(Revised_Download).pdf": "Pandora's Box (Revised)",
  "Scion_Origin_(Revised_Download).pdf": "Scion: Origin (Revised)",
  "Scion_Hero_(Final_Download).pdf": "Scion: Hero",
  "SCION_Scion_Hero_(Final_Download).pdf": "Scion: Hero",
  "Scion_Demigod_Second_Edition_(Final_Download).pdf": "Scion: Demigod",
  "Scion_Demigod_Companion_(Final_Download).pdf": "Scion: Demigod Companion",
  "Scion_God_Second_Edition_(Final_Download).pdf": "Scion: God",
  "Scion_God_Players_Guide_(Final_Download).pdf": "Scion: God Player's Guide",
  "Scion_Dragon_(Final_Download).pdf": "Scion: Dragon",
  "Scion_Dragon_Companion_(Final_Download).pdf": "Scion: Dragon Companion",
  "Scion_Masks_of_the_Mythos_(Final_Download).pdf": "Scion: Masks of the Mythos",
  "Scion_Players_Guide__Saints__Monsters_(Final_Download).pdf": "Scion: Saints & Monsters",
  "Scion_-_Titanomachy_(Final_Download).pdf": "Scion: Titanomachy",
  "TItans_Rising_(Final_Download).pdf": "Titans Rising",
  "Mysteries_of_the_World_-_Scion_Companion_(Final_Download).pdf": "Mysteries of the World: Scion Companion",
  "7711-Divine_Armory.pdf": "Divine Armory",
  "7711-Divine_Armory_-_List_of_Weapons.pdf": "Divine Armory: List of Weapons",
  "248484-ScionCC_v3.pdf": "MCG Scion Character Creator",
};

/** Longest keys first so we never partially replace a longer filename. */
const PDF_REPLACEMENTS = Object.entries(PDF_FILENAME_TO_BOOK_TITLE).sort((a, b) => b[0].length - a[0].length);

/**
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function formatGameDataSourceForDisplay(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/<\/?cite>/gi, "").trim();
  if (!/\.pdf\b/i.test(s)) return s;

  let out = s;
  for (const [fn, title] of PDF_REPLACEMENTS) {
    if (out.includes(fn)) out = out.split(fn).join(title);
  }
  out = out.replace(/\s*([;,])\s*/g, "$1 ").replace(/\s{2,}/g, " ").trim();
  out = out.replace(/\s+([—–])\s+/g, " $1 ").trim();
  return out;
}
