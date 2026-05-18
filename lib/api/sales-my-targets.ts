/**
 * "My Targets" — the rep's own multi-period targets snapshot.
 *
 * Spec: MY_TARGETS_FRONTEND_GUIDE.md.
 * Single endpoint: `GET /api/v1/sales/me/targets` returns all four periods
 * in one round-trip, scoped to the calling sales rep.
 *
 * IMPORTANT: currency `actual` / `target` values come back as **paise**.
 * Divide by 100 before passing to `formatCurrency`. Per-metric `status`
 * is computed server-side — never derive it client-side.
 */

import { apiData } from "./client";

export type MyTargetPeriod =
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "yearly";

export type MyTargetStatus =
  | "ahead"
  | "on_track"
  | "behind"
  | "at_risk";

export type MyTargetUnit = "count" | "currency";

export type MyTargetIconHint =
  | "users"
  | "hash"
  | "wallet"
  | "rupee"
  | "target"
  | (string & {});

export interface MyTargetUser {
  id: string;
  name: string;
  /** Human-readable role e.g. "Sales Rep". */
  role_label: string;
}

export interface MyTargetMetric {
  key: string;
  title: string;
  subtitle: string;
  icon: MyTargetIconHint;
  /** Paise for `unit: "currency"`, plain integer for `unit: "count"`. */
  actual: number;
  /** Same unit as `actual`. */
  target: number;
  status: MyTargetStatus;
  unit: MyTargetUnit;
  /** Only present when `unit === "currency"`. */
  currency?: string;
}

export interface MyTargetPeriodSnapshot {
  /** Inclusive ISO date strings (`YYYY-MM-DD`), in IST. */
  period_start: string;
  period_end: string;
  days_total: number;
  days_elapsed: number;
  days_remaining: number;
  metrics: MyTargetMetric[];
}

export interface MyTargetsResponse {
  user: MyTargetUser;
  generated_at: string;
  periods: Record<MyTargetPeriod, MyTargetPeriodSnapshot>;
}

export function getMyTargets(
  signal?: AbortSignal,
): Promise<MyTargetsResponse> {
  return apiData<MyTargetsResponse>("/api/v1/sales/me/targets", { signal });
}
