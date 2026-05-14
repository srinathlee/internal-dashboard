"use client";

import { useCallback } from "react";

import {
  bulkSetRevenueTargets,
  deleteRevenueTarget,
  getMonitorBoard,
  getMyRevenueTargetHistory,
  getMyRevenueTargetPeriod,
  getMyRevenueTargets,
  getRevenueTargetsForUser,
  listRevenueTargets,
  setRevenueTarget,
  type BulkRevenueTargetInput,
  type ListRevenueTargetsQuery,
  type MonitorQuery,
  type RevenuePeriod,
  type RevenueHistoryQuery,
  type SetRevenueTargetInput,
} from "@/lib/api/sales-revenue-targets";

import { useAsync } from "./use-async";

// ---------- Admin queries ----------

export function useRevenueTargets(q: ListRevenueTargetsQuery = {}) {
  return useAsync(
    (signal) => listRevenueTargets(q, signal),
    [q.userId, q.period, q.includeProgress],
  );
}

export function useMonitorBoard(q: MonitorQuery = {}) {
  return useAsync(
    (signal) => getMonitorBoard(q, signal),
    [q.period, q.user_ids?.join(",") ?? ""],
  );
}

export function useRepRevenueTargets(userId: string | null) {
  return useAsync(
    (signal) =>
      userId
        ? getRevenueTargetsForUser(userId, signal)
        : Promise.resolve(null),
    [userId],
  );
}

// ---------- Admin mutations ----------

export function useRevenueTargetMutations() {
  return {
    setForUser: useCallback(
      (userId: string, input: SetRevenueTargetInput) =>
        setRevenueTarget(userId, input),
      [],
    ),
    bulkSet: useCallback(
      (input: BulkRevenueTargetInput) => bulkSetRevenueTargets(input),
      [],
    ),
    remove: useCallback(
      (userId: string, period: RevenuePeriod) =>
        deleteRevenueTarget(userId, period),
      [],
    ),
  };
}

// ---------- Rep queries ----------

export function useMyRevenueTargets() {
  return useAsync((signal) => getMyRevenueTargets(signal), []);
}

export function useMyRevenueTargetPeriod(period: RevenuePeriod) {
  return useAsync(
    (signal) => getMyRevenueTargetPeriod(period, signal),
    [period],
  );
}

export function useMyRevenueTargetHistory(q: RevenueHistoryQuery) {
  return useAsync(
    (signal) => getMyRevenueTargetHistory(q, signal),
    [q.period, q.limit],
  );
}
