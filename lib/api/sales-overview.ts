/**
 * Section 1 of the Sales API: Overview & Activity feeds.
 */

import { apiData, apiRequest } from "./client";
import type {
  ActivityFeed,
  ApiLeadActivityKind,
  MyOverview,
  RosterResponse,
  TeamOverview,
} from "./types";

export function getMyOverview(signal?: AbortSignal): Promise<MyOverview> {
  return apiData<MyOverview>("/api/v1/sales/me/overview", { signal });
}

export interface ActivityQuery {
  limit?: number;
  before?: string;
  kind?: ApiLeadActivityKind | ApiLeadActivityKind[];
}

export function getMyActivity(
  q: ActivityQuery = {},
  signal?: AbortSignal,
): Promise<ActivityFeed> {
  return apiData<ActivityFeed>("/api/v1/sales/me/activity", {
    query: {
      limit: q.limit,
      before: q.before,
      kind: Array.isArray(q.kind) ? q.kind.join(",") : q.kind,
    },
    signal,
  });
}

export function getTeamOverview(signal?: AbortSignal): Promise<TeamOverview> {
  return apiData<TeamOverview>("/api/v1/sales/team/overview", { signal });
}

export interface RosterQuery {
  sort?: "pipeline" | "done" | "trend" | "last_login";
  dir?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export function getTeamRoster(
  q: RosterQuery = {},
  signal?: AbortSignal,
): Promise<RosterResponse> {
  return apiData<RosterResponse>("/api/v1/sales/team/roster", {
    query: { sort: q.sort, dir: q.dir, page: q.page, limit: q.limit },
    signal,
  });
}

export interface TeamActivityQuery extends ActivityQuery {
  filter?: "all" | "wins" | "losses";
}

export function getTeamActivity(
  q: TeamActivityQuery = {},
  signal?: AbortSignal,
): Promise<ActivityFeed> {
  return apiData<ActivityFeed>("/api/v1/sales/team/activity", {
    query: {
      limit: q.limit,
      before: q.before,
      kind: Array.isArray(q.kind) ? q.kind.join(",") : q.kind,
      filter: q.filter,
    },
    signal,
  });
}

/**
 * Trigger CSV / JSON export of team data.
 * For CSV the server returns a downloadable file — we return the raw Response.
 */
export async function exportTeamData(
  format: "csv" | "json",
): Promise<Response | unknown> {
  if (format === "csv") {
    return apiRequest<Response>("/api/v1/sales/team/export", {
      method: "POST",
      body: { format },
      raw: true,
    });
  }
  return apiData<unknown>("/api/v1/sales/team/export", {
    method: "POST",
    body: { format },
  });
}
