// @vitest-environment jsdom
import { getByRole, getByText, queryByText } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPermissionPrompt } from "./permissionPrompt";

const DISMISS_KEY = "lumen-bloom:location-prompt-dismissed";

let mount: HTMLElement;

beforeEach(() => {
  localStorage.clear();
  mount = document.createElement("div");
  document.body.append(mount);
});

afterEach(() => {
  mount.remove();
});

function pill(): HTMLElement {
  return mount.querySelector<HTMLElement>(".location-prompt")!;
}

describe("createPermissionPrompt", () => {
  it("is hidden until show() and then explains the Tokyo fallback", () => {
    const prompt = createPermissionPrompt(mount, vi.fn());
    expect(pill().hidden).toBe(true);

    prompt.show(vi.fn());
    expect(pill().hidden).toBe(false);
    expect(getByRole(mount, "group", { name: "位置情報の案内" })).toBe(pill());
    expect(getByText(mount, /いまは東京の太陽で表示しています/)).toBeTruthy();
    expect(getByRole(mount, "button", { name: "位置情報を使う" })).toBeTruthy();
  });

  it("only the latest show() handler runs on the main button", async () => {
    const user = userEvent.setup();
    const first = vi.fn();
    const second = vi.fn();
    const prompt = createPermissionPrompt(mount, vi.fn());
    prompt.show(first);
    prompt.show(second);

    await user.click(getByRole(mount, "button", { name: "位置情報を使う" }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("pending disables the button with progress wording; failed tells the user what to do", () => {
    const prompt = createPermissionPrompt(mount, vi.fn());
    prompt.show(vi.fn());

    prompt.setState("pending");
    const busy = getByRole(mount, "button", { name: "取得しています…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);

    prompt.setState("failed");
    const retry = getByRole(mount, "button", { name: "もう一度試す" });
    expect((retry as HTMLButtonElement).disabled).toBe(false);
    expect(getByText(mount, /位置情報を取得できませんでした/)).toBeTruthy();
    expect(getByText(mount, /位置情報を取得できませんでした/).getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("× hides it for good, remembers it and notifies the orchestrator", async () => {
    const user = userEvent.setup();
    const onUserHide = vi.fn();
    const prompt = createPermissionPrompt(mount, onUserHide);
    prompt.show(vi.fn());

    await user.click(getByRole(mount, "button", { name: "位置情報の案内を閉じる" }));

    expect(pill().hidden).toBe(true);
    expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
    expect(onUserHide).toHaveBeenCalledTimes(1);
    expect(prompt.isUserHidden()).toBe(true);

    // A later show() (e.g. a failed GPS retry) must respect the dismissal
    // but still rebind the handler for a restore.
    const handler = vi.fn();
    prompt.show(handler);
    expect(pill().hidden).toBe(true);
    prompt.restore();
    expect(pill().hidden).toBe(false);
    await user.click(getByRole(mount, "button", { name: "位置情報を使う" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("restore() forgets the dismissal and resets to idle wording", () => {
    localStorage.setItem(DISMISS_KEY, "1");
    const prompt = createPermissionPrompt(mount, vi.fn());
    prompt.setState("failed");
    prompt.restore();

    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
    expect(prompt.isUserHidden()).toBe(false);
    expect(pill().hidden).toBe(false);
    expect(queryByText(mount, /取得できませんでした/)).toBeNull();
    expect(getByRole(mount, "button", { name: "位置情報を使う" })).toBeTruthy();
  });

  it("hide() removes the pill without touching the stored preference", () => {
    const prompt = createPermissionPrompt(mount, vi.fn());
    prompt.show(vi.fn());
    prompt.hide();
    expect(pill().hidden).toBe(true);
    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
    expect(prompt.isUserHidden()).toBe(false);
  });

  it("focus() targets the main button only while visible", () => {
    const prompt = createPermissionPrompt(mount, vi.fn());
    prompt.focus();
    expect(document.activeElement).toBe(document.body);

    prompt.show(vi.fn());
    prompt.focus();
    expect(document.activeElement).toBe(getByRole(mount, "button", { name: "位置情報を使う" }));
  });
});
