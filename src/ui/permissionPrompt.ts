// Minimal, dismissible location-permission affordance. The wallpaper never
// blocks on it — the scene renders immediately with a fallback location,
// and this prompt only ever offers a retry for a more accurate sun position.

import { locationPromptCopy, type LocationPromptState } from "../engine/locationPromptCopy";
import { el } from "./dom";

const DISMISS_KEY = "lumen-bloom:location-prompt-dismissed";

export interface PermissionPrompt {
  /**
   * Show the pill; the button click triggers `onRequest`. The geolocation
   * API is only ever called from that click — requesting on page load both
   * annoys first-time visitors and trips Chrome's no-gesture violation.
   */
  show(onRequest: () => void): void;
  /** Switch the wording: in-flight request, or a failed one (SHIG 58, 55). */
  setState(state: LocationPromptState): void;
  hide(): void;
  /** Whether the user has closed it with ×. */
  isUserHidden(): boolean;
  /** Forget the × and show it again (restore button / undo). */
  restore(): void;
  /** Move keyboard focus to its main button (after an undo / restore). */
  focus(): void;
}

export function createPermissionPrompt(
  mount: HTMLElement,
  onUserHide: () => void,
): PermissionPrompt {
  const message = el("span", { "aria-live": "polite" });
  const retryButton = el("button", { type: "button" });
  const closeButton = el(
    "button",
    { type: "button", class: "close", "aria-label": "位置情報の案内を閉じる" },
    "×",
  );
  const node = el(
    "div",
    { class: "location-prompt", hidden: true },
    message,
    retryButton,
    closeButton,
  );

  function setState(state: LocationPromptState): void {
    const copy = locationPromptCopy(state);
    message.textContent = copy.message;
    retryButton.textContent = copy.button;
    retryButton.disabled = copy.busy;
  }
  setState("idle");

  // Denied-permission users shouldn't be nagged on every launch of an
  // always-on wallpaper — × hides the prompt (per browser); the undo toast
  // and the restore button bring it back.
  closeButton.addEventListener("click", () => {
    node.hidden = true;
    localStorage.setItem(DISMISS_KEY, "1");
    onUserHide();
  });
  mount.append(node);

  let currentHandler: (() => void) | null = null;

  return {
    show(onRequest: () => void): void {
      if (currentHandler) retryButton.removeEventListener("click", currentHandler);
      currentHandler = onRequest;
      retryButton.addEventListener("click", currentHandler);
      if (localStorage.getItem(DISMISS_KEY) !== null) return;
      node.hidden = false;
    },
    setState,
    hide(): void {
      node.hidden = true;
    },
    isUserHidden: () => localStorage.getItem(DISMISS_KEY) !== null,
    restore(): void {
      localStorage.removeItem(DISMISS_KEY);
      setState("idle");
      node.hidden = false;
    },
    focus(): void {
      if (!node.hidden) retryButton.focus();
    },
  };
}
