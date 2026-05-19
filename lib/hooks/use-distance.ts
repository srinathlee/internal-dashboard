"use client";

import {
  getDistanceHistory,
  getDistanceToday,
  getOrgDistanceSummary,
  getTeamDistance,
  getUserDistanceHistory,
  type TeamDistanceQuery,
} from "@/lib/api/sales-distance";

import { useAsync } from "./use-async";

export function useDistanceToday() {
  return useAsync((signal) => getDistanceToday(signal), []);
}

export function useDistanceHistory(days: number = 7) {
  return useAsync((signal) => getDistanceHistory(days, signal), [days]);
}

export function useTeamDistance(q: TeamDistanceQuery = {}) {
  return useAsync(
    (signal) => getTeamDistance(q, signal),
    [q.date ?? "", q.days ?? 0, q.group_id ?? ""],
  );
}

export function useUserDistanceHistory(
  userId: string | null,
  days: number = 7,
) {
  return useAsync(
    (signal) =>
      userId
        ? getUserDistanceHistory(userId, days, signal)
        : Promise.resolve(null),
    [userId, days],
  );
}

export function useOrgDistanceSummary(days: number = 7) {
  return useAsync((signal) => getOrgDistanceSummary(days, signal), [days]);
}
