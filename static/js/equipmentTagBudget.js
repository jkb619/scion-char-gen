/**
 * Origin (Revised) weapon & armor tag budgets — Scion_Origin_(Revised_Download).pdf
 * Chapter Four: weapon tags and armor tags may each have up to three total tag points
 * (sum of listed point costs, including negative flaw credits).
 */

export const ORIGIN_EQUIPMENT_TAG_POINT_MAX = 3;

/** @param {any} tag */
export function tagBudgetLine(tag) {
  if (!tag || typeof tag !== "object") return null;
  const bc = typeof tag.bookCategory === "string" ? tag.bookCategory.trim() : "";
  if (bc === "Weapon") return "weapon";
  if (bc === "Armor") return "armor";
  const tt = typeof tag.tagType === "string" ? tag.tagType : "";
  if (tt === "weapon") return "weapon";
  if (tt === "armor") return "armor";
  return null;
}

/** @param {any} tag */
function tagPointContribution(tag) {
  if (!tag) return 0;
  const pc = tag.pointCost;
  if (typeof pc === "number" && Number.isFinite(pc)) return pc;
  return 0;
}

/**
 * @param {any} bundle
 * @param {string[]} tagIds
 * @param {"weapon" | "armor"} line
 */
export function sumTagPointsOnLine(bundle, tagIds, line) {
  let s = 0;
  const tags = bundle?.tags || {};
  for (const tid of tagIds || []) {
    const t = tags[tid];
    if (!t) continue;
    if (tagBudgetLine(t) !== line) continue;
    s += tagPointContribution(t);
  }
  return s;
}

const ARMOR_CORE = new Set(["hardArmor", "softArmor", "ballisticArmor"]);
const ARMOR_PENALTY = new Set(["weighty", "cumbersome", "slotHelm"]);

/**
 * Suggest flaw tags for heavy protection (Origin tone; not every build needs both).
 * @param {any} bundle
 * @param {string[]} tagIds
 * @returns {string | null}
 */
export function armorPenaltyHint(bundle, tagIds) {
  const tags = bundle?.tags || {};
  const ids = new Set(tagIds || []);
  const hasCore = [...ids].some((id) => ARMOR_CORE.has(id));
  if (!hasCore) return null;
  const hasPen = [...ids].some((id) => ARMOR_PENALTY.has(id));
  if (hasPen) return null;
  return "This item uses Hard/Soft/Ballistic armor tags — consider adding **weighty** and/or **cumbersome** (Origin armor flaws). Integrated head protection can use **slot: helm** where appropriate (Divine Armory).";
}

/**
 * @param {any} bundle
 * @param {string} candidateId
 * @param {string[]} currentIds — selected tags (candidate not included unless already checked)
 * @returns {string | null} block reason, or null if adding is OK
 */
export function getEquipmentTagAddBlockReason(bundle, candidateId, currentIds) {
  const tags = bundle?.tags || {};
  const cand = tags[candidateId];
  if (!cand) return null;
  const sel = new Set(normalizeIds(currentIds));
  if (sel.has(candidateId)) return null;
  const next = [...sel, candidateId];
  const w = sumTagPointsOnLine(bundle, next, "weapon");
  const a = sumTagPointsOnLine(bundle, next, "armor");
  if (w > ORIGIN_EQUIPMENT_TAG_POINT_MAX) {
    return `Would exceed Origin weapon-line tag budget (${ORIGIN_EQUIPMENT_TAG_POINT_MAX} points).`;
  }
  if (a > ORIGIN_EQUIPMENT_TAG_POINT_MAX) {
    return `Would exceed Origin armor-line tag budget (${ORIGIN_EQUIPMENT_TAG_POINT_MAX} points).`;
  }
  return null;
}

/**
 * @param {any} bundle
 * @param {string[]} tagIds
 * @returns {{ weapon: boolean; armor: boolean; messages: string[] }}
 */
export function equipmentTagBudgetViolations(bundle, tagIds) {
  const w = sumTagPointsOnLine(bundle, tagIds, "weapon");
  const a = sumTagPointsOnLine(bundle, tagIds, "armor");
  const messages = [];
  if (w > ORIGIN_EQUIPMENT_TAG_POINT_MAX) {
    messages.push(
      `Weapon-line tags sum to ${w} (max ${ORIGIN_EQUIPMENT_TAG_POINT_MAX} per Origin Revised, Weapons and Armor).`,
    );
  }
  if (a > ORIGIN_EQUIPMENT_TAG_POINT_MAX) {
    messages.push(
      `Armor-line tags sum to ${a} (max ${ORIGIN_EQUIPMENT_TAG_POINT_MAX} per Origin Revised, Weapons and Armor).`,
    );
  }
  return {
    weapon: w > ORIGIN_EQUIPMENT_TAG_POINT_MAX,
    armor: a > ORIGIN_EQUIPMENT_TAG_POINT_MAX,
    messages,
  };
}

function normalizeIds(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];
}
