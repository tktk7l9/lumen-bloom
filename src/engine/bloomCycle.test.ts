import { WEEK_MS } from "./arrangements";
import { bloomStageForDate } from "./bloomCycle";

const DAY_MS = 86_400_000;
// An arbitrary but exact multiple of WEEK_MS — guaranteed to land precisely
// on a week boundary without relying on any calendar-day-of-week reasoning.
const WEEK_START_MS = WEEK_MS * 100_000;

function atDay(days: number): Date {
  return new Date(WEEK_START_MS + days * DAY_MS);
}

describe("bloomStageForDate", () => {
  it("is deterministic", () => {
    const d = atDay(1.3);
    expect(bloomStageForDate(d)).toEqual(bloomStageForDate(d));
  });

  it("starts as a closed bud at the week boundary", () => {
    const stage = bloomStageForDate(atDay(0));
    expect(stage.openness).toBe(0);
    expect(stage.shedProgress).toBe(0);
  });

  it("is partway open partway through day 1", () => {
    const stage = bloomStageForDate(atDay(1));
    expect(stage.openness).toBeGreaterThan(0);
    expect(stage.openness).toBeLessThan(1);
    expect(stage.shedProgress).toBe(0);
  });

  it("is fully open right at the day-2 boundary and for the stable window after", () => {
    expect(bloomStageForDate(atDay(2)).openness).toBe(1);
    expect(bloomStageForDate(atDay(3)).openness).toBe(1);
    expect(bloomStageForDate(atDay(4)).openness).toBe(1);
  });

  it("has not started shedding right up to the day-5 boundary", () => {
    expect(bloomStageForDate(atDay(4.99)).shedProgress).toBe(0);
    expect(bloomStageForDate(atDay(5)).shedProgress).toBe(0);
  });

  it("sheds progressively across days 5-7, staying fully open", () => {
    const mid = bloomStageForDate(atDay(6));
    expect(mid.openness).toBe(1);
    expect(mid.shedProgress).toBeGreaterThan(0);
    expect(mid.shedProgress).toBeLessThan(1);
  });

  it("is nearly fully shed right before the next week boundary", () => {
    const stage = bloomStageForDate(atDay(6.99));
    expect(stage.shedProgress).toBeGreaterThan(0.9);
    expect(stage.shedProgress).toBeLessThan(1);
  });

  it("resets to a closed bud exactly at the next week boundary, in sync with arrangementForDate's own grid", () => {
    const justBefore = atDay(7 - 1e-7);
    const at = atDay(7);
    expect(Math.floor(justBefore.getTime() / WEEK_MS)).toBe(Math.floor(at.getTime() / WEEK_MS) - 1);

    expect(bloomStageForDate(justBefore).shedProgress).toBeGreaterThan(0.99);
    const reset = bloomStageForDate(at);
    expect(reset.openness).toBe(0);
    expect(reset.shedProgress).toBe(0);
  });

  it("openness rises monotonically across the two bud days", () => {
    const samples = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 1.999].map(
      (d) => bloomStageForDate(atDay(d)).openness,
    );
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });

  it("shedProgress rises monotonically across the two shed days", () => {
    const samples = [5, 5.25, 5.5, 5.75, 6, 6.25, 6.5, 6.75, 6.999].map(
      (d) => bloomStageForDate(atDay(d)).shedProgress,
    );
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });

  it("stays finite and in range for a pre-epoch (negative) timestamp", () => {
    const stage = bloomStageForDate(new Date(-WEEK_MS * 3.5));
    expect(Number.isFinite(stage.openness)).toBe(true);
    expect(Number.isFinite(stage.shedProgress)).toBe(true);
    expect(stage.openness).toBeGreaterThanOrEqual(0);
    expect(stage.openness).toBeLessThanOrEqual(1);
    expect(stage.shedProgress).toBeGreaterThanOrEqual(0);
    expect(stage.shedProgress).toBeLessThanOrEqual(1);
  });
});
