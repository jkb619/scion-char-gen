/**
 * Sheet-ready Cost / Duration / Subject / Range / Action / Clash for a Boon.
 * Prefers explicit strings on the object (from `generate_boons_catalog.py`), else parses `mechanicalEffects`.
 * @param {Record<string, unknown> | null | undefined} bb
 * @returns {{ cost: string; duration: string; subject: string; range: string; action: string; clash: string }}
 */
export function boonTrackedMechanicalFields(bb) {
  const o = { cost: "", duration: "", subject: "", range: "", action: "", clash: "" };
  if (!bb || typeof bb !== "object") return o;
  const x = /** @type {any} */ (bb);
  const strTrim = (v) => (v == null ? "" : String(v).trim());
  const keys = /** @type {(keyof typeof o)[]} */ (["cost", "duration", "subject", "range", "action", "clash"]);
  let anyExplicit = false;
  for (const k of keys) {
    if (strTrim(x[k]) !== "") anyExplicit = true;
  }
  if (anyExplicit) {
    for (const k of keys) o[k] = strTrim(x[k]);
    return o;
  }

  const mech = String(x.mechanicalEffects ?? "").trim();
  if (!mech) return o;

  const matches = [...mech.matchAll(/\b(Cost|Duration|Subject|Range|Action|Clash)\s*:\s*/gi)];
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? mech.length : mech.length;
    let val = mech.slice(start, end).trim();
    val = val.replace(/\s+\.+$/g, "").trim();
    const key = String(m[1]).toLowerCase();
    if (key in o) o[/** @type {keyof typeof o} */ (key)] = val;
  }
  return o;
}
