// Minimal, dismissible location-permission affordance. The wallpaper never
// blocks on it — the scene renders immediately with a fallback location,
// and this prompt only ever offers a retry for a more accurate sun position.

import { el } from "./dom";

const DISMISS_KEY = "lumen-bloom:location-prompt-dismissed";

export interface PermissionPrompt {
  /**
   * Show the pill; the button click triggers `onRequest`. The geolocation
   * API is only ever called from that click — requesting on page load both
   * annoys first-time visitors and trips Chrome's no-gesture violation.
   */
  show(onRequest: () => void): void;
  hide(): void;
}

export function createPermissionPrompt(mount: HTMLElement): PermissionPrompt {
  const node = el(
    "div",
    { class: "location-prompt", hidden: true },
    el("span", {}, "位置情報を許可すると、太陽の位置がこの場所に合わせて正確になります。"),
  );
  const retryButton = el("button", { type: "button" }, "位置情報を使う");
  const closeButton = el(
    "button",
    { type: "button", class: "close", "aria-label": "閉じる" },
    "×",
  );
  // Denied-permission users shouldn't be nagged on every launch of an
  // always-on wallpaper — × hides the prompt for good (per browser).
  closeButton.addEventListener("click", () => {
    node.hidden = true;
    localStorage.setItem(DISMISS_KEY, "1");
  });
  node.append(retryButton, closeButton);
  mount.append(node);

  let currentHandler: (() => void) | null = null;

  return {
    show(onRequest: () => void): void {
      if (localStorage.getItem(DISMISS_KEY) !== null) return;
      if (currentHandler) retryButton.removeEventListener("click", currentHandler);
      currentHandler = onRequest;
      retryButton.addEventListener("click", currentHandler);
      node.hidden = false;
    },
    hide(): void {
      node.hidden = true;
    },
  };
}
