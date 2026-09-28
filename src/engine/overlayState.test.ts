import { canRestorePrompt, restoreButtonVisible, type OverlayFlags } from "./overlayState";

const none: OverlayFlags = {
  hudHidden: false,
  infoHidden: false,
  promptHidden: false,
  locationResolved: false,
};

describe("restoreButtonVisible", () => {
  it("stays hidden while nothing is hidden", () => {
    expect(restoreButtonVisible(none)).toBe(false);
  });

  it("appears when the HUD or the info card is hidden", () => {
    expect(restoreButtonVisible({ ...none, hudHidden: true })).toBe(true);
    expect(restoreButtonVisible({ ...none, infoHidden: true })).toBe(true);
  });

  it("appears for a closed prompt only while the location is still unknown", () => {
    expect(restoreButtonVisible({ ...none, promptHidden: true })).toBe(true);
    expect(
      restoreButtonVisible({ ...none, promptHidden: true, locationResolved: true }),
    ).toBe(false);
  });
});

describe("canRestorePrompt", () => {
  it("brings back a closed prompt before a GPS fix", () => {
    expect(canRestorePrompt({ ...none, promptHidden: true })).toBe(true);
  });

  it("never brings the prompt back after a GPS fix, even from a pending undo", () => {
    expect(canRestorePrompt({ ...none, promptHidden: true, locationResolved: true })).toBe(
      false,
    );
  });

  it("has nothing to restore when the prompt was never closed", () => {
    expect(canRestorePrompt(none)).toBe(false);
  });
});
