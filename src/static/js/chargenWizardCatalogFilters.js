/**
 * Hide placeholder library rows from chargen wizard pickers (not library editors).
 * @param {unknown} br
 * @param {string} bid
 */
export function isChargenWizardHiddenBirthrightRow(br, bid) {
  const nm = String(/** @type {{ name?: unknown }} */ (br)?.name ?? bid ?? "").trim();
  return nm.toLowerCase().includes("(blank template)");
}

/**
 * @param {unknown} eq
 * @param {string} eid
 */
export function isChargenWizardHiddenEquipmentRow(eq, eid) {
  const nm = String(/** @type {{ name?: unknown }} */ (eq)?.name ?? eid ?? "").trim();
  const low = nm.toLowerCase();
  if (low.includes("(blank template)")) return true;
  return low.endsWith("(template)");
}
