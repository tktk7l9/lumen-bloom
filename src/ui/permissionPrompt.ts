// Minimal, dismissible location-permission affordance. The wallpaper never
// blocks on it — the scene renders immediately with a fallback location,
// and this prompt only ever offers a retry for a more accurate sun position.

import { el } from "./dom";

export interface PermissionPrompt {
  showDenied(onRetry: () => void): void;
  hide(): void;
}

export function createPermissionPrompt(mount: HTMLElement): PermissionPrompt {
  const node = el(
    "div",
    { class: "location-prompt", hidden: true },
    el("span", {}, "位置情報を許可すると、太陽の位置がこの場所に合わせて正確になります。"),
  );
  const retryButton = el("button", { type: "button" }, "再試行");
  node.append(retryButton);
  mount.append(node);

  let currentHandler: (() => void) | null = null;

  return {
    showDenied(onRetry: () => void): void {
      if (currentHandler) retryButton.removeEventListener("click", currentHandler);
      currentHandler = onRetry;
      retryButton.addEventListener("click", currentHandler);
      node.hidden = false;
    },
    hide(): void {
      node.hidden = true;
    },
  };
}
