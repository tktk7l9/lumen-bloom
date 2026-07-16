// Within a week's arrangement, the flowers age: 2 days budding open, 3 days
// fully bloomed, 2 days shedding — synced to arrangementForDate's own week
// grid so the two always reset at the same instant. Pure function of the
// wall-clock date, so a reload mid-week (or a different device) always
// shows the same stage — no session-accumulated state.

import { WEEK_MS } from "./arrangements";

export interface BloomStage {
  /** 0 = tightly closed bud, 1 = fully open. */
  openness: number;
  /** 0 = nothing shed yet, 1 = fully shed. Monotonic non-decreasing within a week. */
  shedProgress: number;
}

const DAY_MS = 86_400_000;
const OPEN_DAYS = 2;
const STABLE_DAYS = 3;
// The remaining 7 - OPEN_DAYS - STABLE_DAYS days are the shed window.

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * Deterministic bloom/shed stage for a wall-clock date.
 *
 * `daysIntoWeek` is always in [0, 7) by construction (`ms - week*WEEK_MS` is
 * an exact non-negative integer below WEEK_MS — both operands stay well
 * within the safe-integer range for current and long-future dates), and each
 * branch below divides it by a power of two, so the ratios fed to the easing
 * functions land in [0, 1) with no floating-point rounding risk — no
 * clamping needed.
 */
export function bloomStageForDate(date: Date): BloomStage {
  const ms = date.getTime();
  const week = Math.floor(ms / WEEK_MS);
  const daysIntoWeek = (ms - week * WEEK_MS) / DAY_MS; // always in [0, 7)

  if (daysIntoWeek < OPEN_DAYS) {
    return { openness: easeInOutCubic(daysIntoWeek / OPEN_DAYS), shedProgress: 0 };
  }
  if (daysIntoWeek < OPEN_DAYS + STABLE_DAYS) {
    return { openness: 1, shedProgress: 0 };
  }
  const shedT = (daysIntoWeek - (OPEN_DAYS + STABLE_DAYS)) / (7 - OPEN_DAYS - STABLE_DAYS);
  return { openness: 1, shedProgress: easeInCubic(shedT) };
}
