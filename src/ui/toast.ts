// One-line notice with an undo action. Hiding an overlay happens at once,
// without a confirm dialog; this toast is the fail-safe (SHIG 57, 54).

import { el } from "./dom";

const TOAST_MS = 6000;

export interface Toast {
  show(message: string, onUndo: () => void): void;
}

export function createToast(mount: HTMLElement): Toast {
  const text = el("span", {});
  const undoButton = el("button", { type: "button" }, "元に戻す");
  const node = el("div", { class: "toast", role: "status", hidden: true }, text, undoButton);
  mount.append(node);

  let timer: number | null = null;
  let undo: (() => void) | null = null;

  function close(): void {
    node.hidden = true;
    undo = null;
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }

  undoButton.addEventListener("click", () => {
    const action = undo;
    close();
    action?.();
  });

  return {
    show(message: string, onUndo: () => void): void {
      if (timer !== null) window.clearTimeout(timer);
      text.textContent = message;
      undo = onUndo;
      node.hidden = false;
      timer = window.setTimeout(close, TOAST_MS);
    },
  };
}
