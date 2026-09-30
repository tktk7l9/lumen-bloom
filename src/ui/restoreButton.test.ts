// @vitest-environment jsdom
import { getByRole, queryByRole } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRestoreButton } from "./restoreButton";

let mount: HTMLElement;

beforeEach(() => {
  mount = document.createElement("div");
  document.body.append(mount);
});

afterEach(() => {
  mount.remove();
});

describe("createRestoreButton", () => {
  it("starts hidden and appears via setVisible", () => {
    const button = createRestoreButton(mount, vi.fn());
    expect(queryByRole(mount, "button")).toBeNull();

    button.setVisible(true);
    expect(getByRole(mount, "button", { name: "表示を戻す" })).toBeTruthy();

    button.setVisible(false);
    expect(queryByRole(mount, "button")).toBeNull();
  });

  it("calls onRestore when pressed", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const button = createRestoreButton(mount, onRestore);
    button.setVisible(true);

    await user.click(getByRole(mount, "button", { name: "表示を戻す" }));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("focus() is a no-op while hidden", () => {
    const button = createRestoreButton(mount, vi.fn());
    button.focus();
    expect(document.activeElement).toBe(document.body);

    button.setVisible(true);
    button.focus();
    expect(document.activeElement).toBe(getByRole(mount, "button"));
  });
});
