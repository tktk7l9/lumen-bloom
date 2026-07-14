import { kelvinToRgb01 } from "./colorTemp";

describe("kelvinToRgb01", () => {
  it("is warm orange at low (candlelight-ish) temperatures", () => {
    const [r, g, b] = kelvinToRgb01(1900);
    expect(r).toBe(1);
    expect(g).toBeGreaterThan(0.3);
    expect(g).toBeLessThan(0.7);
    expect(b).toBe(0);
  });

  it("is nearly neutral white at daylight temperatures", () => {
    const [r, g, b] = kelvinToRgb01(5800);
    expect(r).toBe(1);
    expect(g).toBeGreaterThan(0.9);
    expect(b).toBeGreaterThan(0.85);
  });

  it("blue is fully clamped to 0 at very low temperatures", () => {
    const [, , b] = kelvinToRgb01(1000);
    expect(b).toBe(0);
  });

  it("blue saturates to 1 at and above 6600K", () => {
    expect(kelvinToRgb01(6600)[2]).toBe(1);
    expect(kelvinToRgb01(10000)[2]).toBe(1);
  });

  it("red rolls off above 6600K but stays clamped within [0, 1]", () => {
    const [rHot] = kelvinToRgb01(12000);
    const [rNeutral] = kelvinToRgb01(6600);
    expect(rHot).toBeLessThan(rNeutral);
    expect(rHot).toBeGreaterThanOrEqual(0);
  });

  it("green rises through the low-temperature branch, then stays valid past 6600K", () => {
    const gLow = kelvinToRgb01(2000)[1];
    const gMid = kelvinToRgb01(6000)[1];
    const gHigh = kelvinToRgb01(12000)[1];
    expect(gMid).toBeGreaterThan(gLow);
    expect(gHigh).toBeLessThanOrEqual(1);
    expect(gHigh).toBeGreaterThan(0);
  });
});
