/**
 * Sales analytics — win/loss breakdown.
 *
 * Base: /api/v1/sales/analytics.
 */

import { apiData } from "./client";

export type WinLossPeriod =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "yearly";

export interface WinLossReason {
  reason: string;
  count: number;
}

export interface WinLossByRep {
  user_id: string;
  user_name: string;
  won: number;
  lost: number;
  win_rate: number;
}

export interface WinLossResponse {
  period: WinLossPeriod;
  from: string;
  to: string;
  won: number;
  lost: number;
  win_rate: number;
  total_closed: number;
  total_pipeline: number;
  avg_days_to_win: number;
  reasons: WinLossReason[];
  by_rep: WinLossByRep[];
}

export function getWinLossAnalytics(
  period: WinLossPeriod = "monthly",
  signal?: AbortSignal,
): Promise<WinLossResponse> {
  return apiData<WinLossResponse>("/api/v1/sales/analytics/win-loss", {
    query: { period },
    signal,
  });
}
