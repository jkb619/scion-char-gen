/**
 * Purview Innate summaries (separate from Boon catalog picks).
 * @typedef {{ key: string; label: string; body: string }} PurviewInnateBlock
 */

/**
 * Standard innate body text (bundle fallbacks match character sheet / wizard).
 * @param {{ purviews?: Record<string, Record<string, unknown>> }} bundle
 * @param {string} purviewId
 */
export function purviewStandardInnateText(bundle, purviewId) {
  const pv = bundle?.purviews?.[purviewId];
  if (!pv || typeof pv !== "object") {
    return "See Pandora’s Box (Revised) and Scion: Hero for this Purview’s standard Innate.";
  }
  const curated = typeof pv.purviewInnateSummary === "string" && pv.purviewInnateSummary.trim();
  if (curated) return curated;
  const mech = typeof pv.mechanicalEffects === "string" && pv.mechanicalEffects.trim();
  if (mech) return mech;
  return "See Pandora’s Box (Revised) for this Purview’s standard Innate Power (and Scion: Hero where PB points there).";
}

/**
 * Ordered blocks: optional Epicenter (Titanic), standard innate, optional Mythos Awareness write-up.
 * @param {{ purviews?: Record<string, unknown>; epicenters?: Record<string, { summary?: string }> }} bundle
 * @param {string} purviewId
 * @param {{ mythosPantheon?: boolean; titanicTier?: boolean }} [opts]
 * @returns {PurviewInnateBlock[]}
 */
export function purviewInnateBlocks(bundle, purviewId, opts) {
  /** @type {PurviewInnateBlock[]} */
  const blocks = [];
  if (!purviewId) return blocks;
  if (opts?.titanicTier === true) {
    const ep = bundle?.epicenters?.[purviewId];
    const sum = ep && typeof ep === "object" && typeof ep.summary === "string" ? ep.summary.trim() : "";
    if (sum) {
      blocks.push({
        key: "epicenter",
        label: "Epicenter (Saints & Monsters — replaces usual Innate while unsuppressed)",
        body: sum,
      });
    }
  }
  const pv = bundle?.purviews?.[purviewId];
  const innName = pv && typeof pv === "object" && typeof pv.purviewInnateName === "string" ? pv.purviewInnateName.trim() : "";
  blocks.push({
    key: "standard",
    label: innName ? `Standard innate — ${innName}` : "Standard innate",
    body: purviewStandardInnateText(bundle, purviewId),
  });
  if (opts?.mythosPantheon && pv && typeof pv === "object") {
    const aw = typeof pv.mythosAwarenessInnate === "string" ? pv.mythosAwarenessInnate.trim() : "";
    if (aw) {
      blocks.push({ key: "awareness", label: "Mythos Awareness innate (optional — MotM)", body: aw });
    }
  }
  return blocks;
}
