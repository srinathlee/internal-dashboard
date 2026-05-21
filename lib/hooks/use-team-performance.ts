"use client";

import {
  broadcastToTeam,
  getTeamPerformance,
  type BroadcastInput,
} from "@/lib/api/sales-overview";
import { useCallback } from "react";

import { useAsync } from "./use-async";

/** GET /team/performance — per-rep trend breakdown. */
export function useTeamPerformance() {
  return useAsync((signal) => getTeamPerformance(signal), []);
}

export function useTeamPerformanceMutations() {
  return {
    broadcast: useCallback((input: BroadcastInput) => broadcastToTeam(input), []),
  };
}
