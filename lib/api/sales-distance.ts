/**
 * Sales distance tracking — rolls up GPS distance traveled per rep / team.
 *
 * Base: /api/v1/sales/distance.
 * Reps see their own; admins see team-wide breakdown.
 */

import { apiData } from "./client";

export interface DistanceDay {
  date: string;
  meters: number;
  km: number;
  /** Number of completed tracking sessions on the day. */
  sessions: number;
  /** Field-pins recorded on the day (admin only on /distance/team). */
  visits?: number;
}

// ---------- GET /distance/today -------------------------------------------

export function getDistanceToday(signal?: AbortSignal): Promise<DistanceDay> {
  return apiData<DistanceDay>("/api/v1/sales/distance/today", { signal });
}

// ---------- GET /distance/history -----------------------------------------

export interface DistanceHistoryResponse {
  history: DistanceDay[];
}

export function getDistanceHistory(
  days: number = 7,
  signal?: AbortSignal,
): Promise<DistanceHistoryResponse> {
  return apiData<DistanceHistoryResponse>("/api/v1/sales/distance/history", {
    query: { days },
    signal,
  });
}

// ---------- GET /distance/team --------------------------------------------

export interface TeamDistanceMember {
  user_id: string;
  user_name: string;
  meters: number;
  km: number;
  sessions: number;
  visits_today?: number;
}

export interface TeamDistanceResponse {
  date: string;
  total_meters: number;
  total_km: number;
  average_meters: number;
  average_km: number;
  members: TeamDistanceMember[];
}

export interface TeamDistanceQuery {
  date?: string;
  days?: number;
  group_id?: string;
}

export function getTeamDistance(
  q: TeamDistanceQuery = {},
  signal?: AbortSignal,
): Promise<TeamDistanceResponse> {
  return apiData<TeamDistanceResponse>("/api/v1/sales/distance/team", {
    query: { date: q.date, days: q.days, group_id: q.group_id },
    signal,
  });
}

// ---------- GET /distance/users/:userId -----------------------------------

export function getUserDistanceHistory(
  userId: string,
  days: number = 7,
  signal?: AbortSignal,
): Promise<DistanceHistoryResponse> {
  return apiData<DistanceHistoryResponse>(
    `/api/v1/sales/distance/users/${userId}`,
    { query: { days }, signal },
  );
}

// ---------- GET /distance/org/summary -------------------------------------

export interface OrgDistanceGroupRep {
  user_id: string;
  user_name: string;
  km: number;
}

export interface OrgDistanceGroup {
  group_id: string;
  group_name: string;
  color: string | null;
  total_meters: number;
  total_km: number;
  active_reps: number;
  reps: OrgDistanceGroupRep[];
}

export interface OrgDistanceSummary {
  from: string;
  to: string;
  total_km: number;
  active_reps: number;
  groups: OrgDistanceGroup[];
}

export function getOrgDistanceSummary(
  days: number = 7,
  signal?: AbortSignal,
): Promise<OrgDistanceSummary> {
  return apiData<OrgDistanceSummary>("/api/v1/sales/distance/org/summary", {
    query: { days },
    signal,
  });
}
