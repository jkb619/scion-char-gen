/**
 * Book-facing Purview label for the current pantheon: uses `signaturePurviewLabel`
 * when `purviewId` is that pantheon’s Signature Purview id (legacy Specialty renames).
 * @param {string} purviewId
 * @param {{ purviews?: Record<string, Record<string, unknown>>; pantheons?: Record<string, Record<string, unknown>> }} bundle
 * @param {string} [pantheonId]
 * @returns {string}
 */
export function purviewDisplayNameForPantheon(purviewId, bundle, pantheonId) {
  const pid = String(purviewId || "").trim();
  if (!pid) return "";
  const pp = String(pantheonId ?? "").trim();
  const pant = pp && bundle?.pantheons?.[pp] && typeof bundle.pantheons[pp] === "object" ? bundle.pantheons[pp] : null;
  const sig = pant && typeof pant.signaturePurviewId === "string" ? pant.signaturePurviewId.trim() : "";
  const lab = pant && typeof pant.signaturePurviewLabel === "string" ? pant.signaturePurviewLabel.trim() : "";
  if (sig && lab && sig === pid) return lab;
  const row = bundle?.purviews?.[pid];
  if (row && typeof row === "object" && typeof row.name === "string" && row.name.trim()) return row.name.trim();
  const spaced = pid.replace(/([A-Z])/g, " $1").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : pid;
}

/**
 * Deduped Purview id list for review sheet / interactive PDF. Export uses `purviews`;
 * older JSON may use `purviewIds`; patron slot picks may only appear in `patronPurviewSlots`.
 * @param {Record<string, unknown>} [data]
 * @returns {string[]}
 */
export function mergedPurviewIdsForSheet(data) {
  if (!data || typeof data !== "object") return [];
  /** @type {string[]} */
  const parts = [];
  const push = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const x of arr) {
      if (typeof x !== "string") continue;
      const id = x.trim();
      if (id) parts.push(id);
    }
  };
  push(data.purviews);
  push(data.purviewIds);
  push(data.patronPurviewSlots);
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const id of parts) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Chargen breakdown for export / review: innate (Signature + patron slots) vs extras vs Dominion.
 * Dominion marks are **not** innate Purviews.
 * @param {Record<string, unknown>} [data]
 * @param {{ tier?: Record<string, { patronPurviewSlotCount?: number }>; pantheons?: Record<string, { signaturePurviewId?: string }> }} [bundle]
 */
export function purviewChargenBreakdown(data, bundle) {
  if (!data || typeof data !== "object") {
    return {
      signaturePurviewId: null,
      patronInnateSlotPurviewIds: [],
      patronInnateSlotsFilled: 0,
      patronInnateSlotLimit: null,
      innatePurviewIds: [],
      extraPurviewIds: [],
      dominionBoonPurviewIds: [],
      allPurviewIds: [],
      note: "",
      demigodInnateReminder: null,
    };
  }
  const tierRaw = String(data.tier ?? data.tierId ?? "")
    .trim()
    .toLowerCase();
  const tierKey = tierRaw === "origin" ? "mortal" : tierRaw;
  const pantheonId = String(data.pantheonId ?? "").trim();
  const pant =
    pantheonId && bundle?.pantheons?.[pantheonId] && typeof bundle.pantheons[pantheonId] === "object"
      ? bundle.pantheons[pantheonId]
      : null;
  const signaturePurviewId =
    pant && typeof pant.signaturePurviewId === "string" ? pant.signaturePurviewId.trim() : "";
  const patronSlots = (data.patronPurviewSlots || [])
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  const slotLimitRaw = bundle?.tier?.[tierKey]?.patronPurviewSlotCount;
  const patronInnateSlotLimit = Number.isFinite(Number(slotLimitRaw)) ? Math.floor(Number(slotLimitRaw)) : null;
  const innatePurviewIds = [...new Set([...(signaturePurviewId ? [signaturePurviewId] : []), ...patronSlots])];
  const pickSet = new Set(patronSlots);
  const extraPurviewIds = [
    ...new Set(
      (data.purviewIds || []).filter(
        (id) => typeof id === "string" && id.trim() && id !== signaturePurviewId && !pickSet.has(id),
      ),
    ),
  ];
  const dominionBoonPurviewIds = (data.dominionBoonPurviewIds || []).filter(
    (id) => typeof id === "string" && id.trim(),
  );
  const demigodLike = new Set(["demigod", "god", "sorcerer_demigod", "sorcerer_god"]);
  const demigodInnateReminder =
    demigodLike.has(tierKey) && patronInnateSlotLimit != null && patronSlots.length < patronInnateSlotLimit
      ? `Demigod+ innate Purviews: automatic Signature plus ${patronInnateSlotLimit} patron innate slots (Hero pick + two more at advancement). Only ${patronSlots.length} of ${patronInnateSlotLimit} patron slots are filled on this sheet.`
      : null;
  return {
    signaturePurviewId: signaturePurviewId || null,
    patronInnateSlotPurviewIds: [...patronSlots],
    patronInnateSlotsFilled: patronSlots.length,
    patronInnateSlotLimit,
    innatePurviewIds,
    extraPurviewIds,
    dominionBoonPurviewIds: [...dominionBoonPurviewIds],
    allPurviewIds: mergedPurviewIdsForSheet(data),
    note: "Dominion Boons (dominionBoonPurviewIds) are not innate Purviews — each costs two regular Purview Boon purchases in play (Demigod pp. 154–155). Innate Purviews at Demigod+ are pantheon Signature plus patron innate slots above.",
    demigodInnateReminder,
  };
}

/**
 * Human-readable Purview tracking role for review sheet / export.
 * @param {string} purviewId
 * @param {ReturnType<typeof purviewChargenBreakdown>} breakdown
 */
export function purviewTrackingRoleLabel(purviewId, breakdown) {
  const pid = String(purviewId || "").trim();
  if (!pid || !breakdown) return "Extra Purview";
  /** @type {string[]} */
  const parts = [];
  if (breakdown.signaturePurviewId === pid) parts.push("Pantheon Signature (innate, automatic)");
  const slotIdx = breakdown.patronInnateSlotPurviewIds.indexOf(pid);
  if (slotIdx >= 0) parts.push(`Patron innate slot ${slotIdx + 1}`);
  if (breakdown.extraPurviewIds.includes(pid)) parts.push("Extra (chips / Boons / Birthrights)");
  if (breakdown.dominionBoonPurviewIds.includes(pid)) parts.push("Dominion Boon (not innate; 2 Boon purchases)");
  return parts.length ? parts.join("; ") : "Tracked Purview";
}
