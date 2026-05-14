/**
 * Revenue target management — distinct from the scorecard-metric targets
 * in `sales-scoring.ts`. Backed by the `sales_revenue_targets` table.
 *
 * Spec: docs/target-management-api.md
 */

import { apiData } from "./client";

// ---------- Enums ----------

export type RevenuePeriod =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "YEARLY";

export type RevenueStatus =
  | "ACHIEVED"
  | "ON_TRACK"
  | "AT_RISK"
  | "BEHIND"
  | "UNSET";

// ---------- Common shapes ----------

export interface RevenueProgress {
  actual_amount: number;
  progress_pct: number;
  status: RevenueStatus;
  period_start: string;
  period_end: string;
}

export interface RevenueTargetRow {
  id: string;
  user_id: string;
  user_name: string;
  period: RevenuePeriod;
  target_amount: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  created_by: { id: string; name: string };
  created_at: string;
  updated_at: string;
  progress?: RevenueProgress;
}

// ---------- GET /api/v1/sales/targets ----------

export interface ListRevenueTargetsQuery {
  userId?: string;
  period?: RevenuePeriod;
  includeProgress?: boolean;
}

export function listRevenueTargets(
  q: ListRevenueTargetsQuery = {},
  signal?: AbortSignal,
): Promise<RevenueTargetRow[]> {
  return apiData<RevenueTargetRow[]>("/api/v1/sales/targets", {
    query: q,
    signal,
  });
}

// ---------- GET /api/v1/sales/targets/monitor ----------

export interface PeriodSnapshot {
  target_amount: number;
  actual_amount: number;
  progress_pct: number;
  status: RevenueStatus;
}

export interface ActivePeriodSnapshot extends PeriodSnapshot {
  period: RevenuePeriod;
}

export interface MonitorRow {
  user: { id: string; name: string; initials: string };
  active_period: ActivePeriodSnapshot;
  all_periods: Partial<Record<RevenuePeriod, PeriodSnapshot | null>>;
}

export interface MonitorTallies {
  behind: number;
  at_risk: number;
  on_track: number;
  achieved: number;
  unset: number;
}

export interface MonitorResponse {
  period: RevenuePeriod;
  period_start: string;
  period_end: string;
  tallies: MonitorTallies;
  rows: MonitorRow[];
}

export interface MonitorQuery {
  period?: RevenuePeriod;
  user_ids?: string[];
}

export function getMonitorBoard(
  q: MonitorQuery = {},
  signal?: AbortSignal,
): Promise<MonitorResponse> {
  return apiData<MonitorResponse>("/api/v1/sales/targets/monitor", {
    query: q,
    signal,
  });
}

// ---------- GET /api/v1/sales/targets/:userId ----------

export interface RepTargetEntry {
  id: string;
  target_amount: number;
  currency: string;
  effective_from: string;
}

export interface RepTargets {
  user: { id: string; name: string };
  targets: Partial<Record<RevenuePeriod, RepTargetEntry | null>>;
}

export function getRevenueTargetsForUser(
  userId: string,
  signal?: AbortSignal,
): Promise<RepTargets> {
  return apiData<RepTargets>(`/api/v1/sales/targets/${userId}`, { signal });
}

// ---------- PUT /api/v1/sales/targets/:userId ----------

export interface SetRevenueTargetInput {
  period: RevenuePeriod;
  target_amount: number;
  currency?: string;
}

export function setRevenueTarget(
  userId: string,
  input: SetRevenueTargetInput,
): Promise<RevenueTargetRow> {
  return apiData<RevenueTargetRow>(`/api/v1/sales/targets/${userId}`, {
    method: "PUT",
    body: input,
  });
}

// ---------- POST /api/v1/sales/targets/bulk ----------

export interface BulkRevenueTargetInput {
  period: RevenuePeriod;
  target_amount: number;
  currency?: string;
  /** `null` or omitted → all active reps. */
  user_ids?: string[] | null;
}

export interface BulkRevenueTargetResponse {
  period: RevenuePeriod;
  target_amount: number;
  applied_to: number;
  skipped: { user_id: string; reason: string }[];
}

export function bulkSetRevenueTargets(
  input: BulkRevenueTargetInput,
): Promise<BulkRevenueTargetResponse> {
  return apiData<BulkRevenueTargetResponse>("/api/v1/sales/targets/bulk", {
    method: "POST",
    body: input,
  });
}

// ---------- DELETE /api/v1/sales/targets/:userId/:period ----------

export function deleteRevenueTarget(
  userId: string,
  period: RevenuePeriod,
): Promise<void> {
  return apiData<void>(`/api/v1/sales/targets/${userId}/${period}`, {
    method: "DELETE",
  });
}

// ---------- GET /api/v1/sales/targets/me ----------

export interface MyPeriodSnapshot {
  target_amount: number;
  actual_amount: number;
  progress_pct: number;
  status: RevenueStatus;
  period_start: string;
  period_end: string;
  days_total: number;
  days_elapsed: number;
  days_remaining: number;
}

export interface MyTargetsResponse {
  user: { id: string; name: string };
  as_of: string;
  periods: Partial<Record<RevenuePeriod, MyPeriodSnapshot | null>>;
}

export function getMyRevenueTargets(
  signal?: AbortSignal,
): Promise<MyTargetsResponse> {
  return apiData<MyTargetsResponse>("/api/v1/sales/targets/me", { signal });
}

// ---------- GET /api/v1/sales/targets/me/period/:period ----------

export interface MyPeriodDetailResponse {
  period: RevenuePeriod;
  target_amount: number;
  actual_amount: number;
  progress_pct: number;
  status: RevenueStatus;
  period_start: string;
  period_end: string;
  daily_breakdown: { date: string; amount: number }[];
  contributing_leads: {
    lead_id: string;
    clinic_name: string;
    closed_at: string;
    amount: number;
  }[];
}

export function getMyRevenueTargetPeriod(
  period: RevenuePeriod,
  signal?: AbortSignal,
): Promise<MyPeriodDetailResponse> {
  return apiData<MyPeriodDetailResponse>(
    `/api/v1/sales/targets/me/period/${period}`,
    { signal },
  );
}

// ---------- GET /api/v1/sales/targets/me/history ----------

export interface RevenueHistoryEntry {
  period_key: string;
  period_start: string;
  period_end: string;
  target_amount: number;
  actual_amount: number;
  progress_pct: number;
  status: RevenueStatus;
}

export interface RevenueHistoryResponse {
  period: RevenuePeriod;
  history: RevenueHistoryEntry[];
}

export interface RevenueHistoryQuery {
  period: RevenuePeriod;
  limit?: number;
}

export function getMyRevenueTargetHistory(
  q: RevenueHistoryQuery,
  signal?: AbortSignal,
): Promise<RevenueHistoryResponse> {
  return apiData<RevenueHistoryResponse>("/api/v1/sales/targets/me/history", {
    query: q,
    signal,
  });
}
