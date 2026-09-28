import { describe, expect, it, vi } from "vitest";
import { AFTER_PAINT_FALLBACK_MS, afterNextPaint, yieldToMain, type YieldHost } from "./yieldToMain";

function timerHost(): YieldHost & { flush(ms: number): void; rafs: Array<() => void> } {
  let queue: Array<{ cb: () => void; at: number }> = [];
  let clock = 0;
  const rafs: Array<() => void> = [];
  return {
    rafs,
    setTimeout(cb, ms) {
      queue.push({ cb, at: clock + ms });
      return queue.length;
    },
    requestAnimationFrame(cb) {
      rafs.push(cb);
      return rafs.length;
    },
    flush(ms) {
      clock += ms;
      const due = queue.filter((t) => t.at <= clock);
      queue = queue.filter((t) => t.at > clock);
      due.forEach((t) => t.cb());
    },
  };
}

async function settled(p: Promise<void>): Promise<boolean> {
  let resolved = false;
  void p.then(() => {
    resolved = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  return resolved;
}

describe("yieldToMain", () => {
  it("uses scheduler.yield when the host provides it", async () => {
    const schedulerYield = vi.fn(() => Promise.resolve());
    const host: YieldHost = { setTimeout: vi.fn(), scheduler: { yield: schedulerYield } };
    await yieldToMain(host);
    expect(schedulerYield).toHaveBeenCalledTimes(1);
    expect(host.setTimeout).not.toHaveBeenCalled();
  });

  it("keeps scheduler as the receiver of yield()", async () => {
    const scheduler = {
      called: false,
      yield(this: { called: boolean }) {
        this.called = true;
        return Promise.resolve();
      },
    };
    await yieldToMain({ setTimeout: vi.fn(), scheduler });
    expect(scheduler.called).toBe(true);
  });

  it("falls back to a zero-delay timer without scheduler.yield", async () => {
    const host = timerHost();
    host.scheduler = {};
    const p = yieldToMain(host);
    expect(await settled(p)).toBe(false);
    host.flush(0);
    expect(await settled(p)).toBe(true);
  });
});

describe("afterNextPaint", () => {
  it("resolves after an animation frame plus a timer turn", async () => {
    const host = timerHost();
    const p = afterNextPaint(host);
    host.flush(0);
    expect(await settled(p)).toBe(false); // frame not rendered yet
    host.rafs[0]!();
    expect(await settled(p)).toBe(false); // still inside the frame
    host.flush(0);
    expect(await settled(p)).toBe(true);
  });

  it("falls back to a timer when animation frames never fire", async () => {
    const host = timerHost();
    const p = afterNextPaint(host);
    host.flush(AFTER_PAINT_FALLBACK_MS - 1);
    expect(await settled(p)).toBe(false);
    host.flush(1);
    expect(await settled(p)).toBe(true);
  });

  it("works on hosts without requestAnimationFrame", async () => {
    const host = timerHost();
    delete host.requestAnimationFrame;
    const p = afterNextPaint(host, 5);
    host.flush(5);
    expect(await settled(p)).toBe(true);
  });

  it("resolves only once when both the frame and the fallback fire", async () => {
    const host = timerHost();
    const onResolve = vi.fn();
    void afterNextPaint(host, 10).then(onResolve);
    host.rafs[0]!();
    host.flush(0);
    host.flush(10);
    await Promise.resolve();
    await Promise.resolve();
    expect(onResolve).toHaveBeenCalledTimes(1);
  });
});
