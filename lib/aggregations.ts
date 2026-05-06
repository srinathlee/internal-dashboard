import type {
  DailyMetric,
  MetricAggregation,
  MetricDefinition,
} from "./types";
import { REFERENCE_DATE, lastNDates } from "./mock-data";

export type DateWindowKey = "7d" | "30d" | "quarter";

/**
 * Resolve a UI date-range key to ISO from/to strings (inclusive). Uses
 * REFERENCE_DATE as "today" so mock data stays anchored regardless of when
 * the page is opened.
 */
export function getDateWindow(
  range: DateWindowKey,
  now: string = REFERENCE_DATE,
): { from: string; to: string; days: number } {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const dates = lastNDates(days, now);
  const from = dates[0] ?? now;
  const to = dates[dates.length - 1] ?? now;
  return { from, to, days };
}

/**
 * Aggregate a metric across a (possibly multi-user) set of daily rows.
 *
 * - "sum"  → total of values across users × days
 * - "avg"  → arithmetic mean across users × days
 * - "last" → for each user take their most recent day, then sum across users
 *            (this matches the intent of "active onboardings" — a stock, not a flow)
 */
export function aggregateMetricsForKey(
  metrics: DailyMetric[],
  key: string,
  aggregation: MetricAggregation,
): number {
  if (metrics.length === 0) return 0;

  if (aggregation === "last") {
    const latestPerUser = new Map<string, DailyMetric>();
    for (const m of metrics) {
      const cur = latestPerUser.get(m.userId);
      if (!cur || m.date > cur.date) latestPerUser.set(m.userId, m);
    }
    let total = 0;
    for (const m of latestPerUser.values()) total += m.values[key] ?? 0;
    return total;
  }

  let sum = 0;
  let count = 0;
  for (const m of metrics) {
    const v = m.values[key];
    if (v === undefined) continue;
    sum += v;
    count++;
  }
  if (aggregation === "sum") return sum;
  return count > 0 ? sum / count : 0;
}

/** First day of the calendar month containing `dateIso` (YYYY-MM-DD). */
export function firstDayOfMonth(dateIso: string = REFERENCE_DATE): string {
  return dateIso.slice(0, 7) + "-01";
}

/**
 * Per-user aggregate for a single metric key over a date range.
 * Convenient for ranking members on a leaderboard.
 */
export function aggregatePerUser(
  metrics: DailyMetric[],
  key: string,
  aggregation: MetricAggregation,
): Map<string, number> {
  const grouped = new Map<string, DailyMetric[]>();
  for (const m of metrics) {
    const list = grouped.get(m.userId);
    if (list) list.push(m);
    else grouped.set(m.userId, [m]);
  }
  const out = new Map<string, number>();
  for (const [userId, rows] of grouped) {
    out.set(userId, aggregateMetricsForKey(rows, key, aggregation));
  }
  return out;
}

/**
 * Rank a user against a peer group on a metric.
 * Returns 1-based rank where 1 = best. `betterWhen` flips the sort.
 */
export function rankAmong(
  perUserValues: Map<string, number>,
  targetUserId: string,
  betterWhen: "higher" | "lower",
): { rank: number; total: number } {
  const entries = [...perUserValues.entries()];
  entries.sort(([, a], [, b]) =>
    betterWhen === "higher" ? b - a : a - b,
  );
  const idx = entries.findIndex(([id]) => id === targetUserId);
  return {
    rank: idx === -1 ? entries.length : idx + 1,
    total: entries.length,
  };
}

/** A team's "primary" metric is the first one declared in its config. */
export function primaryMetric(metrics: MetricDefinition[]): MetricDefinition {
  const m = metrics[0];
  if (!m) throw new Error("Team has no metrics defined");
  return m;
}

/**
 * Build a series suitable for Recharts: { date, value } per day, sorted ascending.
 * If multiple users share a day (team-level chart), values are summed before plotting
 * — except for "avg" metrics which are averaged across users for that day.
 */
export function buildDailySeries(
  metrics: DailyMetric[],
  metric: MetricDefinition,
): { date: string; value: number }[] {
  const byDate = new Map<string, number[]>();
  for (const m of metrics) {
    const v = m.values[metric.key];
    if (v === undefined) continue;
    const list = byDate.get(m.date);
    if (list) list.push(v);
    else byDate.set(m.date, [v]);
  }
  const dates = [...byDate.keys()].sort();
  return dates.map((date) => {
    const values = byDate.get(date)!;
    let value: number;
    if (metric.aggregation === "avg") {
      value = values.reduce((a, b) => a + b, 0) / values.length;
    } else {
      // sum (and "last" — collapses to sum at the day level when stacking users)
      value = values.reduce((a, b) => a + b, 0);
    }
    return { date, value };
  });
}
