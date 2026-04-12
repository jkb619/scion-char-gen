/**
 * Shared hook for alternate chargen UIs. The Scion deity/titan flow remains procedural in `app.js`;
 * Dragon Heir uses `DragonChargenWizard.js` (functional module) plus this placeholder for future refactors.
 */
export class BaseChargenWizard {
  /**
   * @param {{ render: () => void; character: Record<string, unknown>; bundle: Record<string, unknown> }} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
  }
}
