/**
 * Draft session for the Exp Leveling wizard step.
 * Purchases mutate a draft clone until the user leaves the step (Back / nav tab).
 */

/** @type {Record<string, unknown> | null} */
let restoreTarget = null;

/** @type {string | null} */
let baselineJson = null;

const LEAVE_CONFIRM_MESSAGE =
  "Leave Exp Leveling?\n\nYour Experience purchases will be saved and applied to your character.";

/**
 * @param {Record<string, unknown>} char
 */
function pickExpLevelingFields(char) {
  const sp = char.sorceryProfile;
  return {
    experiencePoints: char.experiencePoints,
    experiencePointsSpent: char.experiencePointsSpent,
    experiencePurchaseLog: Array.isArray(char.experiencePurchaseLog) ? [...char.experiencePurchaseLog] : [],
    experienceAttributeBumps:
      char.experienceAttributeBumps && typeof char.experienceAttributeBumps === "object"
        ? { ...char.experienceAttributeBumps }
        : {},
    experienceSkillBumps:
      char.experienceSkillBumps && typeof char.experienceSkillBumps === "object"
        ? { ...char.experienceSkillBumps }
        : {},
    experienceKnackIds: Array.isArray(char.experienceKnackIds) ? [...char.experienceKnackIds] : [],
    experienceBirthrightPickIds: Array.isArray(char.experienceBirthrightPickIds)
      ? [...char.experienceBirthrightPickIds]
      : [],
    attributes: char.attributes && typeof char.attributes === "object" ? { ...char.attributes } : {},
    favoredApproach: char.favoredApproach,
    skillDots: char.skillDots && typeof char.skillDots === "object" ? { ...char.skillDots } : {},
    skillSpecialties:
      char.skillSpecialties && typeof char.skillSpecialties === "object" ? { ...char.skillSpecialties } : {},
    knackIds: Array.isArray(char.knackIds) ? [...char.knackIds] : [],
    knackSlotById:
      char.knackSlotById && typeof char.knackSlotById === "object" ? { ...char.knackSlotById } : {},
    boonIds: Array.isArray(char.boonIds) ? [...char.boonIds] : [],
    sorceryProfile: sp && typeof sp === "object"
      ? {
          additionalTechniqueIds: Array.isArray(sp.additionalTechniqueIds) ? [...sp.additionalTechniqueIds] : [],
          experienceAdditionalTechniqueIds: Array.isArray(sp.experienceAdditionalTechniqueIds)
            ? [...sp.experienceAdditionalTechniqueIds]
            : [],
        }
      : null,
  };
}

/**
 * @param {Record<string, unknown>} char
 */
function expLevelingSnapshotJson(char) {
  return JSON.stringify(pickExpLevelingFields(char));
}

/**
 * @param {Record<string, unknown>} target
 * @param {ReturnType<typeof pickExpLevelingFields>} picked
 */
function applyPickedToCharacter(target, picked) {
  target.experiencePoints = picked.experiencePoints;
  target.experiencePointsSpent = picked.experiencePointsSpent;
  target.experiencePurchaseLog = [...picked.experiencePurchaseLog];
  target.experienceAttributeBumps = { ...picked.experienceAttributeBumps };
  target.experienceSkillBumps = { ...picked.experienceSkillBumps };
  target.experienceKnackIds = [...picked.experienceKnackIds];
  target.experienceBirthrightPickIds = [...picked.experienceBirthrightPickIds];
  target.attributes = { ...picked.attributes };
  target.favoredApproach = picked.favoredApproach;
  target.skillDots = { ...picked.skillDots };
  target.skillSpecialties = { ...picked.skillSpecialties };
  target.knackIds = [...picked.knackIds];
  target.knackSlotById = { ...picked.knackSlotById };
  target.boonIds = [...picked.boonIds];
  if (picked.sorceryProfile) {
    if (!target.sorceryProfile || typeof target.sorceryProfile !== "object") target.sorceryProfile = {};
    target.sorceryProfile.additionalTechniqueIds = [...picked.sorceryProfile.additionalTechniqueIds];
    target.sorceryProfile.experienceAdditionalTechniqueIds = [
      ...picked.sorceryProfile.experienceAdditionalTechniqueIds,
    ];
  }
}

export function expLevelingSessionActive() {
  return restoreTarget != null;
}

/**
 * Begin or resume a draft session for the Exp Leveling step.
 * @param {Record<string, unknown>} currentCharacter
 * @returns {Record<string, unknown>}
 */
export function activateExpLevelingSession(currentCharacter) {
  if (restoreTarget) return currentCharacter;
  restoreTarget = currentCharacter;
  baselineJson = expLevelingSnapshotJson(currentCharacter);
  return structuredClone(currentCharacter);
}

/**
 * @param {Record<string, unknown>} draftCharacter
 */
export function expLevelingSessionDirty(draftCharacter) {
  if (!restoreTarget || baselineJson == null) return false;
  return expLevelingSnapshotJson(draftCharacter) !== baselineJson;
}

/**
 * @param {Record<string, unknown>} draftCharacter
 * @returns {Record<string, unknown>}
 */
export function commitExpLevelingSession(draftCharacter) {
  const real = restoreTarget;
  if (!real) return draftCharacter;
  applyPickedToCharacter(real, pickExpLevelingFields(draftCharacter));
  restoreTarget = null;
  baselineJson = null;
  return real;
}

/** @returns {Record<string, unknown> | null} */
export function discardExpLevelingSession() {
  const real = restoreTarget;
  restoreTarget = null;
  baselineJson = null;
  return real;
}

/**
 * Resolve leaving the Exp Leveling step (confirm save when the draft changed).
 * @param {Record<string, unknown>} draftCharacter
 * @returns {{ proceed: boolean; character: Record<string, unknown> }}
 */
export function resolveLeaveExpLevelingStep(draftCharacter) {
  if (!expLevelingSessionActive()) return { proceed: true, character: draftCharacter };
  if (!expLevelingSessionDirty(draftCharacter)) {
    const real = discardExpLevelingSession();
    return { proceed: true, character: real || draftCharacter };
  }
  if (!window.confirm(LEAVE_CONFIRM_MESSAGE)) return { proceed: false, character: draftCharacter };
  return { proceed: true, character: commitExpLevelingSession(draftCharacter) };
}

export { LEAVE_CONFIRM_MESSAGE };
