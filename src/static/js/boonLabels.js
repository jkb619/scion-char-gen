import { purviewDisplayNameForPantheon } from "./purviewDisplayName.js";
import { boonPrimaryPurview } from "./eligibility.js";

/** English ordinal for Boon position on a Purview (1–12). */
function ordinalEn(n) {
  const i = Math.floor(Number(n));
  if (!Number.isFinite(i) || i < 1) return String(n);
  const v = i % 100;
  if (v >= 11 && v <= 13) return `${i}th`;
  switch (i % 10) {
    case 1:
      return `${i}st`;
    case 2:
      return `${i}nd`;
    case 3:
      return `${i}rd`;
    default:
      return `${i}th`;
  }
}

/**
 * True when `boons.json` / generator used a generic placeholder instead of a Pandora’s Box title.
 * @param {string} name
 */
export function isPlaceholderBoonCatalogName(name) {
  const t = String(name ?? "").trim();
  if (!t) return true;
  if (/ladder\s*step/i.test(t)) return true;
  if (/\bboon\s*ladder\b/i.test(t)) return true;
  if (/[•·]\s*boon\s*\d+\s*$/i.test(t)) return true;
  return false;
}

/**
 * When no official title is in data, show ordinal Boon on Purview (not a printed Boon name from the books).
 * @param {string} purviewId
 * @param {number} dot
 * @param {{ purviews?: Record<string, Record<string, unknown>>; pantheons?: Record<string, Record<string, unknown>> }} bundle
 * @param {string} [pantheonId]
 */
function honestBoonRungChipLabel(purviewId, dot, bundle, pantheonId) {
  const disp = purviewDisplayNameForPantheon(purviewId, bundle, pantheonId) || purviewId || "Purview";
  if (!Number.isFinite(dot)) return `Boon on ${disp} Purview`;
  return `${ordinalEn(dot)} Boon on ${disp} Purview`;
}

/**
 * Display label for a Boon chip / sheet row: prefer Pandora’s Box names from `purviews.json`,
 * then any non-placeholder `boons.json` name, then an honest “Nth Boon on Purview” label (never a fake “• Boon n” title).
 * @param {Record<string, unknown>} b — one entry from bundle.boons
 * @param {{ purviews?: Record<string, Record<string, unknown>>; pantheons?: Record<string, Record<string, unknown>> }} bundle
 * @param {string} [pantheonId] — passed through for Purview display labels (e.g. pantheon Specialty names)
 * @returns {string}
 */
export function boonDisplayLabel(b, bundle, pantheonId) {
  if (!b || typeof b !== "object") return "";
  const bid = String(b.id ?? "").trim();
  const base = typeof b.name === "string" ? b.name.trim() : "";
  const pid = boonPrimaryPurview(b);
  const dotRaw = b.dot != null ? Number(b.dot) : NaN;
  const dot = Number.isFinite(dotRaw) ? Math.max(1, Math.min(12, Math.round(dotRaw))) : NaN;
  const pv = pid && bundle?.purviews?.[pid] && typeof bundle.purviews[pid] === "object" ? bundle.purviews[pid] : null;

  if (pv && Number.isFinite(dot)) {
    const byDot = pv.boonLadderNameByDot;
    if (byDot && typeof byDot === "object") {
      const k1 = String(dot);
      const k2 = String(dot).padStart(2, "0");
      const raw = byDot[k1] ?? byDot[k2];
      if (typeof raw === "string" && raw.trim()) return raw.trim();
    }
    const nameList = pv.boonLadderNames;
    if (Array.isArray(nameList) && nameList.length >= dot) {
      const raw = nameList[dot - 1];
      if (typeof raw === "string" && raw.trim()) return raw.trim();
    }
  }

  if (base && !isPlaceholderBoonCatalogName(base)) return base;

  if (pid && Number.isFinite(dot)) return honestBoonRungChipLabel(pid, dot, bundle, pantheonId);

  return base || bid;
}
