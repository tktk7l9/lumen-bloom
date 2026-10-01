// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupWakeLock } from "./wakeLock";

function installWakeLock(request: ReturnType<typeof vi.fn> | undefined): void {
  Object.defineProperty(navigator, "wakeLock", {
    value: request ? { request } : undefined,
    configurable: true,
  });
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  installWakeLock(undefined);
});

afterEach(() => {
  installWakeLock(undefined);
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
});

describe("setupWakeLock", () => {
  it("does nothing on browsers without the API", () => {
    expect(() => setupWakeLock()).not.toThrow();
  });

  it("requests a screen lock at once and re-acquires when the tab becomes visible", async () => {
    const request = vi.fn().mockResolvedValue({ release: vi.fn() });
    installWakeLock(request);

    setupWakeLock();
    await flush();
    expect(request).toHaveBeenCalledWith("screen");
    expect(request).toHaveBeenCalledTimes(1);

    setHidden(true);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    setHidden(false);
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("retries once on the first pointer interaction when the initial request was denied", async () => {
    // Denied every time, so a further retry would be observable.
    const request = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    installWakeLock(request);

    setupWakeLock();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("pointerdown"));
    await flush();
    expect(request).toHaveBeenCalledTimes(2);

    // The listener is one-shot: still denied, yet a second gesture does not ask again.
    window.dispatchEvent(new Event("pointerdown"));
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not re-request on pointerdown while a sentinel is already held", async () => {
    const request = vi.fn().mockResolvedValue({ release: vi.fn() });
    installWakeLock(request);

    setupWakeLock();
    await flush();
    window.dispatchEvent(new Event("pointerdown"));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
