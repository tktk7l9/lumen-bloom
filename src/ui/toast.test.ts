// @vitest-environment jsdom
import { getByRole, queryByRole } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createToast } from "./toast";

let mount: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  mount = document.createElement("div");
  document.body.append(mount);
});

afterEach(() => {
  mount.remove();
  vi.useRealTimers();
});

function toastNode(): HTMLElement {
  return mount.querySelector<HTMLElement>(".toast")!;
}

describe("createToast", () => {
  it("shows the message, announces it and offers undo", () => {
    const toast = createToast(mount, vi.fn());
    expect(toastNode().hidden).toBe(true);

    toast.show("時計を隠しました", vi.fn());

    expect(toastNode().hidden).toBe(false);
    expect(toastNode().textContent).toContain("時計を隠しました");
    expect(getByRole(mount, "status").textContent).toBe("時計を隠しました");
    expect(getByRole(mount, "button", { name: "元に戻す" })).toBeTruthy();
  });

  it("undo runs the action once and closes the toast", () => {
    const toast = createToast(mount, vi.fn());
    const onUndo = vi.fn();
    toast.show("時計を隠しました", onUndo);

    const undo = getByRole(mount, "button", { name: "元に戻す" });
    undo.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(toastNode().hidden).toBe(true);
    expect(getByRole(mount, "status").textContent).toBe("");

    // A stale click after close must not re-run the action.
    undo.click();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("closes by itself after 6 seconds", () => {
    const toast = createToast(mount, vi.fn());
    toast.show("時計を隠しました", vi.fn());

    vi.advanceTimersByTime(5999);
    expect(toastNode().hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect(toastNode().hidden).toBe(true);
    expect(queryByRole(mount, "button")).toBeNull();
  });

  it("a second show() replaces the message and restarts the timer with the new undo", () => {
    const toast = createToast(mount, vi.fn());
    const first = vi.fn();
    const second = vi.fn();
    toast.show("時計を隠しました", first);
    vi.advanceTimersByTime(4000);
    toast.show("花の説明を隠しました", second);

    vi.advanceTimersByTime(4000);
    expect(toastNode().hidden).toBe(false);
    expect(toastNode().textContent).toContain("花の説明を隠しました");

    getByRole(mount, "button", { name: "元に戻す" }).click();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("catches lost focus on the undo button and hands it to onFocusExit on auto-close", () => {
    const onFocusExit = vi.fn();
    const toast = createToast(mount, onFocusExit);
    // Focus sits on body: the button the user pressed has just been hidden.
    (document.activeElement as HTMLElement | null)?.blur();
    toast.show("時計を隠しました", vi.fn());

    expect(document.activeElement).toBe(getByRole(mount, "button", { name: "元に戻す" }));
    vi.advanceTimersByTime(6000);
    expect(onFocusExit).toHaveBeenCalledTimes(1);
  });

  it("treats focus inside a hidden subtree as lost", () => {
    const hiddenButton = document.createElement("button");
    mount.append(hiddenButton);
    hiddenButton.focus();
    hiddenButton.hidden = true;
    expect(document.activeElement).toBe(hiddenButton);

    const toast = createToast(mount, vi.fn());
    toast.show("時計を隠しました", vi.fn());
    expect(document.activeElement).toBe(getByRole(mount, "button", { name: "元に戻す" }));
  });

  it("leaves focus alone when the user is focused elsewhere", () => {
    const other = document.createElement("input");
    mount.append(other);
    other.focus();

    const onFocusExit = vi.fn();
    const toast = createToast(mount, onFocusExit);
    toast.show("時計を隠しました", vi.fn());
    expect(document.activeElement).toBe(other);

    vi.advanceTimersByTime(6000);
    expect(onFocusExit).not.toHaveBeenCalled();
  });
});
