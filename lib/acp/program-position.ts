/**
 * Accelerator program position — week / day-in-week from a rep's join date,
 * counting **working days** (Monday–Saturday). Only **Sunday** is skipped.
 *
 * The program runs a 6-day week: a rep who joins on a Friday has Saturday as
 * "Day 2" and the following Monday as "Day 3" (Sunday is the weekly off). The
 * join day itself is Day 1. Each program week is 6 working days; weeks 1–4 are
 * Month 1, weeks 5–8 are Month 2. Position is capped at the final day (W8 D6)
 * once the 8-week program is over.
 *
 * Pure (no React) so both the client components ({@link
 * ../../components/sales/accelerator/acp-shared}) and the alert engine
 * ({@link ./alerts}) share one definition. The frontend computes this from
 * `joined_at` rather than trusting the backend's `current_week`/`current_day`
 * (see docs/backend-acp-business-day-program-position.md).
 */

import type { AcpActivity } from "@/lib/api/sales-accelerator";

export interface ProgramPosition {
  /** 1–8. */
  week: number;
  /** 1–6 (Mon–Sat). */
  dayInWeek: number;
  /** 1 for weeks 1–4, 2 for weeks 5–8. */
  month: 1 | 2;
}

/**
 * Day-type per program week/day (the FE schedule):
 *   - Week 1, Days 1–2: **Training**
 *   - Day 6 of Weeks 1–2: **Observation**
 *   - everything else: **Field**
 *
 * Used by the alert engine, the daily-log inference, and the batch Weekly
 * board so all three agree on what kind of day a given (week, day) is.
 */
export function programDayActivity(
  week: number,
  dayInWeek: number,
): AcpActivity {
  if (week === 1 && dayInWeek <= 2) return "training";
  if (dayInWeek === 6 && week <= 2) return "observation";
  return "field";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PROGRAM_WEEKS = 8;
const DAYS_PER_WEEK = 6; // working days — Mon–Sat (Sunday off)

/**
 * Local-midnight `Date` for an ISO timestamp or `YYYY-MM-DD` string.
 *
 * For ISO timestamps we take the leading date part (`slice(0,10)` equivalent)
 * so the math agrees with the join date the UI shows (`joined_at.slice(0,10)`),
 * rather than drifting by a day across the UTC/local boundary.
 */
function localMidnight(input: string | Date): Date {
  if (typeof input === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(input);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Count of working days (Mon–Sat) in the inclusive range [a, b] — only Sundays
 *  are excluded. Both args are local midnights. */
function workingDaysInclusive(a: Date, b: Date): number {
  const total = Math.floor((b.getTime() - a.getTime()) / DAY_MS) + 1;
  if (total <= 0) return 0;
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 6; // every 7-day block holds exactly 6 non-Sundays
  const startDow = a.getDay(); // 0=Sun … 6=Sat
  for (let i = 0; i < total - fullWeeks * 7; i++) {
    if ((startDow + i) % 7 !== 0) count++; // skip Sunday only
  }
  return count;
}

/**
 * Program week/day for `at` (default: now) relative to `joinedAt`, counting
 * working days only (Mon–Sat; Sunday skipped). The join day is Day 1.
 */
export function programPosition(
  joinedAt: string | Date,
  at: string | Date = new Date(),
): ProgramPosition {
  const joined = localMidnight(joinedAt);
  const target = localMidnight(at);
  // Working days since the join day, zero-based (join day → 0 → "Day 1").
  const elapsed = Math.max(0, workingDaysInclusive(joined, target) - 1);

  // Past the program's end → pin to the final day.
  if (elapsed >= PROGRAM_WEEKS * DAYS_PER_WEEK) {
    return { week: PROGRAM_WEEKS, dayInWeek: DAYS_PER_WEEK, month: 2 };
  }
  const week = Math.floor(elapsed / DAYS_PER_WEEK) + 1;
  const dayInWeek = (elapsed % DAYS_PER_WEEK) + 1;
  return { week, dayInWeek, month: week <= 4 ? 1 : 2 };
}
