/**
 * Multi-metric target management API.
 *
 * Spec: docs/target-management-multi-metric-api.md
 *
 * Tracks 4 metrics × 4 periods per sales rep. Replaces the legacy revenue-only
 * endpoints in `sales-revenue-targets.ts`.
 */

import { apiData } from "./client";

// ---------- Enums ----------

export type MetricKey =
  | "leads"
  | "sprints_done"
  | "sprint_amount"
  | "revenue";

export type MetricPeriod =
  | "MONTHLY"
  | "QUARTERLY"
  | "HALF_YEARLY"
  | "YEARLY";

export type MetricUnit = "count" | "currency";

/** Progress status — banded on `progress_pct = actual / target * 100`. */
export type ProgressStatus =
  | "ACHIEVED"
  | "ON_TRACK"
  | "AT_RISK"
  | "BEHIND"
  | "UNSET";

/** Pace status — banded on `pace = actual / expected_by_now * 100`. */
export type PaceStatus =
  | "AHEAD"
  | "ON_TRACK"
  | "AT_RISK"
  | "BEHIND"
  | "JUST_STARTED"
  | "UNSET";

// ---------- Shapes ----------

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: MetricUnit;
  currency: string | null;
  display_order: number;
  icon_hint: string;
}

export interface MetricCellSnapshot {
  target: number;
  actual: number;
  progress_pct: number;
  status: ProgressStatus;
  pace: number;
  pace_status: PaceStatus;
  expected_by_now: number;
  remaining_to_target: number;
  required_per_day: number;
  required_per_week: number;
}

export interface PeriodWindow {
  start: string;
  end: string;
  days_total: number;
  days_elapsed: number;
  days_remaining: number;
  elapsed_fraction: number;
}

export interface MonitorTallies {
  behind: number;
  at_risk: number;
  on_track: number;
  ahead: number;
  just_started: number;
  unset: number;
  total: number;
}

export interface MonitorRepUser {
  id: string;
  name: string;
  initials: string;
  role: string;
}

export type MetricCellMap = Record<MetricKey, MetricCellSnapshot>;

export interface MonitorRepRow {
  user: MonitorRepUser;
  overall_status: PaceStatus;
  overall_pace: number;
  metrics: MetricCellMap;
}

// ---------- GET /sales/targets/metrics ----------

export interface MetricCatalogue {
  metrics: MetricDefinition[];
}

export function getMetricCatalogue(
  signal?: AbortSignal,
): Promise<MetricCatalogue> {
  return apiData<MetricCatalogue>("/api/v1/sales/targets/metrics", { signal });
}

// ---------- GET /sales/targets/monitor ----------

export interface MonitorBoardQuery {
  period?: MetricPeriod;
  /**
   * Subset of statuses to include. Sent as a comma-separated string.
   * Backend filters by `overall_status`.
   */
  status?: PaceStatus[];
  search?: string;
  user_ids?: string[];
}

export interface MonitorBoardResponse extends PeriodWindow {
  period: MetricPeriod;
  tallies: MonitorTallies;
  rows: MonitorRepRow[];
}

export function getMetricMonitorBoard(
  q: MonitorBoardQuery = {},
  signal?: AbortSignal,
): Promise<MonitorBoardResponse> {
  return apiData<MonitorBoardResponse>("/api/v1/sales/targets/monitor", {
    query: {
      period: q.period,
      status: q.status,
      search: q.search,
      user_ids: q.user_ids,
    },
    signal,
  });
}

// ---------- GET /sales/targets/monitor/:userId ----------

export interface RepMetricDetail {
  user: MonitorRepUser;
  as_of: string;
  periods: Record<MetricPeriod, PeriodWindow>;
  metrics: Record<MetricKey, Record<MetricPeriod, MetricCellSnapshot>>;
}

export function getRepMetricDetail(
  userId: string,
  signal?: AbortSignal,
): Promise<RepMetricDetail> {
  return apiData<RepMetricDetail>(
    `/api/v1/sales/targets/monitor/${userId}`,
    { signal },
  );
}

// ---------- GET /sales/targets/me ----------

export function getMyMetricTargets(
  signal?: AbortSignal,
): Promise<RepMetricDetail> {
  return apiData<RepMetricDetail>("/api/v1/sales/targets/me", { signal });
}

// ---------- GET /sales/targets/assign/:userId ----------

export type TargetValuesMap = Record<MetricKey, Record<MetricPeriod, number>>;

export interface AssignTargetsPayload {
  user: { id: string; name: string; initials: string };
  targets: TargetValuesMap;
  updated_at: string | null;
}

export function getAssignTargets(
  userId: string,
  signal?: AbortSignal,
): Promise<AssignTargetsPayload> {
  const path = `/api/v1/sales/targets/assign/${userId}`;
  // eslint-disable-next-line no-console
  console.log("[targets:load] GET", path);
  return apiData<AssignTargetsPayload>(path, { signal }).then((res) => {
    // eslint-disable-next-line no-console
    console.log("[targets:load] response:", res);
    return res;
  });
}

// ---------- PUT /sales/targets/assign/:userId ----------

/**
 * Patch shape — send only the cells you want to change. Missing keys are
 * left untouched on the backend.
 */
export type AssignTargetsPatch = Partial<
  Record<MetricKey, Partial<Record<MetricPeriod, number>>>
>;

export interface SaveAssignTargetsResponse extends AssignTargetsPayload {
  changed_count: number;
}

export function saveAssignTargets(
  userId: string,
  patch: AssignTargetsPatch,
): Promise<SaveAssignTargetsResponse> {
  const path = `/api/v1/sales/targets/assign/${userId}`;
  const body = { targets: patch };
  // Temporary debug logging — remove once save flow is confirmed end-to-end.
  // Open DevTools console to see what the FE actually sends and gets back.
  // eslint-disable-next-line no-console
  console.log("[targets:save] PUT", path, "body:", body);
  return apiData<SaveAssignTargetsResponse>(path, {
    method: "PUT",
    body,
  })
    .then((res) => {
      // eslint-disable-next-line no-console
      console.log("[targets:save] response:", res);
      return res;
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[targets:save] FAILED:", err);
      throw err;
    });
}

// ---------- GET /sales/targets/reps ----------

export interface TargetRep {
  id: string;
  name: string;
  initials: string;
  role: string;
  is_active: boolean;
}

export function getTargetReps(signal?: AbortSignal): Promise<TargetRep[]> {
  return apiData<TargetRep[]>("/api/v1/sales/targets/reps", { signal });
}

// ---------- POST /sales/targets/bulk --------------------------------------

export interface BulkAssignTargetsInput {
  user_ids: string[];
  /** Same shape as `AssignTargetsPatch` — partial per metric × period. */
  targets: AssignTargetsPatch;
}

export interface BulkAssignTargetsResponse {
  updated_user_count: number;
  changed_count: number;
}

export function bulkAssignTargets(
  input: BulkAssignTargetsInput,
): Promise<BulkAssignTargetsResponse> {
  return apiData<BulkAssignTargetsResponse>("/api/v1/sales/targets/bulk", {
    method: "POST",
    body: input,
  });
}
