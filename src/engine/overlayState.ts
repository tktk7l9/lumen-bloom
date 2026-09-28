// Which hidden overlays can come back. Pure so the rules behind the undo
// toast and the "表示を戻す" button are testable in node (SHIG 54, 60).
//
// The location prompt is special: once a GPS fix has landed it has done its
// job, so neither the restore button nor a still-open undo toast may bring
// it back — otherwise it would reappear offering a location the app
// already has.

export interface OverlayFlags {
  /** The user hid the HUD (not a ?hud=0 URL). */
  hudHidden: boolean;
  /** The user hid the info card (not a ?info=0 URL). */
  infoHidden: boolean;
  /** The user closed the location prompt with ×. */
  promptHidden: boolean;
  /** A real location is known — the prompt is gone for good. */
  locationResolved: boolean;
}

export function canRestorePrompt(flags: OverlayFlags): boolean {
  return flags.promptHidden && !flags.locationResolved;
}

export function restoreButtonVisible(flags: OverlayFlags): boolean {
  return flags.hudHidden || flags.infoHidden || canRestorePrompt(flags);
}
