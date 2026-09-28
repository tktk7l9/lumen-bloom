// Quiet top-right button that appears only while the user has hidden an
// overlay — the way back after the undo toast is gone, without having to
// know the ?hud=1 / ?info=1 URL params (SHIG 60, 12).

import { el } from "./dom";

export interface RestoreButton {
  setVisible(visible: boolean): void;
}

export function createRestoreButton(mount: HTMLElement, onRestore: () => void): RestoreButton {
  const node = el(
    "button",
    { type: "button", class: "restore", hidden: true },
    "表示を戻す",
  );
  node.addEventListener("click", onRestore);
  mount.append(node);
  return {
    setVisible(visible: boolean): void {
      node.hidden = !visible;
    },
  };
}
