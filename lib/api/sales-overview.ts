/**
 * Section 1 of the Sales API: Overview & Activity feeds.
 */

import { ApiError, apiData, apiRequest } from "./client";
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

// ---------- Pipeline health ----------------------------------------------

export interface PipelineHealthResponse {
  stale_leads_count: number;
  conversion_rate_pct: number;
  at_risk_count: number;
  /** Open shape — server may add fields. */
  [k: string]: unknown;
}

export function getPipelineHealth(
  signal?: AbortSignal,
): Promise<PipelineHealthResponse> {
  return apiData<PipelineHealthResponse>("/api/v1/sales/pipeline/health", {
    signal,
  });
}

// ---------- Team performance ---------------------------------------------

export interface TeamPerformanceRow {
  user_id: string;
  user_name: string;
  initials?: string;
  total_leads: number;
  closed_won: number;
  pipeline_value: number;
  /** Period-over-period delta as a percent. */
  trend_pct?: number;
  /** Per-metric breakdown — open shape per spec. */
  metrics?: Record<string, { actual: number; target?: number }>;
}

export interface TeamPerformanceResponse {
  period?: string;
  rows: TeamPerformanceRow[];
}

export function getTeamPerformance(
  signal?: AbortSignal,
): Promise<TeamPerformanceResponse> {
  return apiData<TeamPerformanceResponse>("/api/v1/sales/team/performance", {
    signal,
  });
}

// ---------- Team broadcast -----------------------------------------------

/**
 * Sender-chosen category for a broadcast. The documented POST body only
 * carries `message` + `user_ids`, but we send `type` alongside so a backend
 * that stores it can echo it back in the recent-broadcasts feed and reps can
 * be shown a categorized notification. Backends that ignore unknown fields
 * are unaffected.
 */
export type BroadcastType = "ANNOUNCEMENT" | "MOTIVATION" | "ALERT" | "KUDOS";

export interface BroadcastInput {
  message: string;
  type?: BroadcastType;
  /** Omit to broadcast to all active team members. */
  user_ids?: string[];
}

export interface BroadcastResponse {
  sent_count: number;
  /** Server may echo recipient ids. */
  recipients?: string[];
  /**
   * Server may echo the persisted broadcast so the UI can prepend it to the
   * recent list without a refetch. All optional — we fall back to local
   * values when the backend doesn't return them.
   */
  id?: string;
  type?: BroadcastType;
  created_at?: string;
}

export function broadcastToTeam(
  input: BroadcastInput,
): Promise<BroadcastResponse> {
  return apiData<BroadcastResponse>("/api/v1/sales/team/broadcast", {
    method: "POST",
    body: input,
  });
}

export interface TeamBroadcast {
  id: string;
  message: string;
  type: BroadcastType;
  /** Number of reps the broadcast was delivered to. */
  recipient_count: number;
  created_at: string;
  /** How many recipients have read it (when the backend reports it). */
  read_count?: number;
  /** How many were actually sent (may differ from recipients on partial fan-out). */
  sent_count?: number;
  /** Display name of the admin who sent it, when supplied. */
  sender_name?: string;
}

/**
 * Raw broadcast row as returned by the live `GET /team/broadcasts` endpoint
 * (§5 of the backend guide). Field names differ from our internal
 * `TeamBroadcast` shape — `recipients_count`/`sent_at`/lowercase `type` — so we
 * normalize through `normalizeBroadcast`. Kept loose so a backend that still
 * uses the legacy `recipient_count`/`created_at` names also parses cleanly.
 */
interface RawBroadcast {
  id?: string;
  type?: string;
  message?: string;
  recipients_count?: number;
  recipient_count?: number;
  sent_count?: number;
  read_count?: number;
  sent_at?: string;
  created_at?: string;
  sender_id?: string;
  sender_name?: string;
}

interface ListBroadcastsResponse {
  broadcasts: RawBroadcast[];
  total?: number;
}

/** Coerce the backend's lowercase `type` into our uppercase union. */
function normalizeBroadcastType(raw: string | undefined): BroadcastType {
  const upper = (raw ?? "").toUpperCase();
  if (
    upper === "ANNOUNCEMENT" ||
    upper === "MOTIVATION" ||
    upper === "ALERT" ||
    upper === "KUDOS"
  ) {
    return upper;
  }
  return "ANNOUNCEMENT";
}

/** Map a wire row (live or legacy shape) into our internal TeamBroadcast. */
function normalizeBroadcast(raw: RawBroadcast): TeamBroadcast {
  return {
    id: raw.id ?? `broadcast-${raw.sent_at ?? raw.created_at ?? Date.now()}`,
    message: raw.message ?? "",
    type: normalizeBroadcastType(raw.type),
    recipient_count:
      raw.recipients_count ?? raw.recipient_count ?? raw.sent_count ?? 0,
    created_at: raw.sent_at ?? raw.created_at ?? new Date().toISOString(),
    read_count: raw.read_count,
    sent_count: raw.sent_count ?? raw.recipients_count,
    sender_name: raw.sender_name,
  };
}

/**
 * Recent broadcasts feed. The list endpoint is now live (§5 of the backend
 * guide) and returns `{ data: [ { recipients_count, sent_at, sender_name, … } ] }`.
 * We normalize each row into our internal shape. Before it shipped, the request
 * got misrouted to a handler that parsed a path segment as a UUID, answering
 * with a 400/404/422 (often the Postgres `invalid input syntax for type uuid`
 * message) rather than a clean 404. All of those mean "no history available",
 * so we still degrade to an empty feed for them rather than surfacing a scary
 * error — matching the cosmetic-degradation pattern in lib/api/teams.ts.
 * Genuine auth (401/403) and server (5xx) failures still propagate.
 */
export async function listTeamBroadcasts(
  q: { limit?: number } = {},
  signal?: AbortSignal,
): Promise<TeamBroadcast[]> {
  try {
    const body = await apiData<ListBroadcastsResponse | RawBroadcast[]>(
      "/api/v1/sales/team/broadcasts",
      { query: { limit: q.limit ?? 10 }, signal },
    );
    const rows = Array.isArray(body) ? body : (body?.broadcasts ?? []);
    return rows.map(normalizeBroadcast);
  } catch (err) {
    if (err instanceof ApiError) {
      const notLive =
        err.status === 404 ||
        err.status === 400 ||
        err.status === 422 ||
        /invalid input syntax for type uuid/i.test(err.message);
      if (notLive) return [];
    }
    throw err;
  }
}
