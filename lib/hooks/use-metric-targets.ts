"use client";

import { useCallback } from "react";

import {
  getAssignTargets,
  getMetricCatalogue,
  getMetricMonitorBoard,
  getMyMetricTargets,
  getRepMetricDetail,
  getTargetReps,
  saveAssignTargets,
  type AssignTargetsPatch,
  type MonitorBoardQuery,
} from "@/lib/api/sales-metric-targets";

import { useAsync } from "./use-async";

// ---------- Read hooks ----------

export function useMetricCatalogue() {
  return useAsync((signal) => getMetricCatalogue(signal), []);
}

export function useMetricMonitorBoard(q: MonitorBoardQuery = {}) {
  return useAsync(
    (signal) => getMetricMonitorBoard(q, signal),
    [
      q.period,
      q.status?.join(",") ?? "",
      q.search ?? "",
      q.user_ids?.join(",") ?? "",
    ],
  );
}

export function useRepMetricDetail(userId: string | null) {
  return useAsync(
    (signal) =>
      userId ? getRepMetricDetail(userId, signal) : Promise.resolve(null),
    [userId],
  );
}

export function useMyMetricTargets() {
  return useAsync((signal) => getMyMetricTargets(signal), []);
}

export function useAssignTargets(userId: string | null) {
  return useAsync(
    (signal) =>
      userId ? getAssignTargets(userId, signal) : Promise.resolve(null),
    [userId],
  );
}

export function useTargetReps() {
  return useAsync((signal) => getTargetReps(signal), []);
}

// ---------- Mutations ----------

export function useAssignTargetsMutation() {
  return {
    save: useCallback(
      (userId: string, patch: AssignTargetsPatch) =>
        saveAssignTargets(userId, patch),
      [],
    ),
  };
}
