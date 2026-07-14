import { lerpHex } from "./colorMix";

describe("lerpHex", () => {
  it("returns the endpoints at t=0 and t=1", () => {
    expect(lerpHex(0x03040a, 0x8fa3c0, 0)).toBe(0x03040a);
    expect(lerpHex(0x03040a, 0x8fa3c0, 1)).toBe(0x8fa3c0);
  });

  it("mixes per channel at the midpoint", () => {
    expect(lerpHex(0x000000, 0xff0000, 0.5)).toBe(0x800000);
    expect(lerpHex(0x0000ff, 0x000000, 0.5)).toBe(0x000080);
    expect(lerpHex(0x102030, 0x304050, 0.5)).toBe(0x203040);
  });

  it("clamps t outside [0, 1]", () => {
    expect(lerpHex(0x111111, 0x999999, -0.5)).toBe(0x111111);
    expect(lerpHex(0x111111, 0x999999, 2)).toBe(0x999999);
  });

  it("never produces channels outside 0-255", () => {
    const v = lerpHex(0xffffff, 0x000000, 0.999);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(0xffffff);
  });
});
