"use client";

import {
  getMyActivity,
  getMyOverview,
  getTeamActivity,
  getTeamOverview,
  getTeamRoster,
  type ActivityQuery,
  type RosterQuery,
  type TeamActivityQuery,
} from "@/lib/api/sales-overview";
import { useAsync } from "./use-async";

export function useMyOverview() {
  return useAsync((signal) => getMyOverview(signal), []);
}

export function useMyActivity(q: ActivityQuery = {}) {
  return useAsync(
    (signal) => getMyActivity(q, signal),
    [q.limit, q.before, JSON.stringify(q.kind ?? null)],
  );
}

export function useTeamOverview() {
  return useAsync((signal) => getTeamOverview(signal), []);
}

export function useTeamRoster(q: RosterQuery = {}) {
  return useAsync(
    (signal) => getTeamRoster(q, signal),
    [q.sort, q.dir, q.page, q.limit],
  );
}

export function useTeamActivity(q: TeamActivityQuery = {}) {
  return useAsync(
    (signal) => getTeamActivity(q, signal),
    [q.limit, q.before, JSON.stringify(q.kind ?? null), q.filter],
  );
}
