/**
 * Section 10 of the Sales API: Scorecards & leaderboards.
 */

import { apiData } from "./client";
import type {
  ScorecardBoard,
  ScorecardConfig,
  ScorecardLeaderboard,
  TeamScorecardBoard,
} from "./types";

export interface ScorecardPeriodQuery {
  /** YYYY-MM, YYYY-Qn, YYYY-H1/H2, or YYYY. Mutually exclusive with start/end. */
  period?: string;
  period_start?: string;
  period_end?: string;
  user_id?: string;
}

export function getMyScorecardBoard(
  q: ScorecardPeriodQuery = {},
  signal?: AbortSignal,
): Promise<ScorecardBoard> {
  return apiData<ScorecardBoard>("/api/v1/sales/scorecard/me/board", {
    query: q,
    signal,
  });
}

export function getUserScorecardBoard(
  userId: string,
  q: ScorecardPeriodQuery = {},
  signal?: AbortSignal,
): Promise<ScorecardBoard> {
  return apiData<ScorecardBoard>(
    `/api/v1/sales/scorecard/users/${userId}/board`,
    { query: q, signal },
  );
}

export interface LeaderboardQuery extends ScorecardPeriodQuery {
  include_inactive_users?: boolean;
}

export function getScorecardLeaderboard(
  q: LeaderboardQuery = {},
  signal?: AbortSignal,
): Promise<ScorecardLeaderboard> {
  return apiData<ScorecardLeaderboard>(
    "/api/v1/sales/scorecard/leaderboard",
    { query: q, signal },
  );
}

export interface TeamBoardQuery extends ScorecardPeriodQuery {
  metric_keys?: string;
}

export function getTeamScorecardBoard(
  q: TeamBoardQuery = {},
  signal?: AbortSignal,
): Promise<TeamScorecardBoard> {
  return apiData<TeamScorecardBoard>(
    "/api/v1/sales/scorecard/team/board",
    { query: q, signal },
  );
}

export function getScorecardConfig(
  q: { include_inactive?: boolean; include_user_targets?: boolean } = {},
  signal?: AbortSignal,
): Promise<ScorecardConfig> {
  return apiData<ScorecardConfig>("/api/v1/sales/scorecard/config", {
    query: q,
    signal,
  });
}

export interface ScorecardConfigPatch {
  metrics: {
    key: string;
    label?: string;
    description?: string;
    unit?: string;
    source?: string;
    is_active?: boolean;
    display_order?: number;
    rule?: {
      points_per_unit?: number;
      cap_per_period?: number | null;
      bonus_points?: number;
      bonus_on_target_pct?: number;
      weight_pct?: number;
      min_floor?: number | null;
      stretch_target?: number | null;
    };
    target?: {
      user_id?: string;
      target_value?: number;
      period_type?: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
      is_default?: boolean;
    };
  }[];
}

export function updateScorecardConfig(
  patch: ScorecardConfigPatch,
): Promise<ScorecardConfig> {
  return apiData<ScorecardConfig>("/api/v1/sales/scorecard/config", {
    method: "PUT",
    body: patch,
  });
}

export interface PointAdjustmentInput {
  user_id: string;
  metric_id?: string;
  metric_key?: string;
  points: number;
  reason: string;
  ref_type?: string;
  ref_id?: string | null;
  occurred_at?: string;
}

export function addPointAdjustment(
  input: PointAdjustmentInput,
): Promise<unknown> {
  return apiData("/api/v1/sales/scorecard/adjustments", {
    method: "POST",
    body: input,
  });
}
