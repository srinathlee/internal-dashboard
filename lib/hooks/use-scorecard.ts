"use client";

import { useCallback } from "react";

import {
  addPointAdjustment,
  getMyScorecardBoard,
  getScorecardConfig,
  getScorecardLeaderboard,
  getTeamScorecardBoard,
  getUserScorecardBoard,
  updateScorecardConfig,
  type LeaderboardQuery,
  type PointAdjustmentInput,
  type ScorecardConfigPatch,
  type ScorecardPeriodQuery,
  type TeamBoardQuery,
} from "@/lib/api/sales-scorecard";

import { useAsync } from "./use-async";

export function useMyScorecard(q: ScorecardPeriodQuery = {}) {
  return useAsync(
    (signal) => getMyScorecardBoard(q, signal),
    [q.period, q.period_start, q.period_end, q.user_id],
  );
}

export function useUserScorecard(
  userId: string | null,
  q: ScorecardPeriodQuery = {},
) {
  return useAsync(
    (signal) =>
      userId
        ? getUserScorecardBoard(userId, q, signal)
        : Promise.resolve(null),
    [userId, q.period, q.period_start, q.period_end],
  );
}

export function useLeaderboard(q: LeaderboardQuery = {}) {
  return useAsync(
    (signal) => getScorecardLeaderboard(q, signal),
    [q.period, q.period_start, q.period_end, q.include_inactive_users],
  );
}

export function useTeamScorecard(q: TeamBoardQuery = {}) {
  return useAsync(
    (signal) => getTeamScorecardBoard(q, signal),
    [q.period, q.period_start, q.period_end, q.metric_keys],
  );
}

export function useScorecardConfig(
  q: { include_inactive?: boolean; include_user_targets?: boolean } = {},
) {
  return useAsync(
    (signal) => getScorecardConfig(q, signal),
    [q.include_inactive, q.include_user_targets],
  );
}

export function useScorecardMutations() {
  return {
    updateConfig: useCallback(
      (patch: ScorecardConfigPatch) => updateScorecardConfig(patch),
      [],
    ),
    addAdjustment: useCallback(
      (input: PointAdjustmentInput) => addPointAdjustment(input),
      [],
    ),
  };
}
