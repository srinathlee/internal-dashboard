/**
 * Sales follow-ups endpoints.
 *
 * Spec: SALES_FOLLOWUP_API.md.
 * Base: /api/v1/sales/follow-ups.
 *
 * The backend uses uppercase enums for type/status and snake_case for fields;
 * the UI keeps a lowercase camelCase model and adapts at the edges (see
 * `apiTypeToUi` / `apiStatusToUi` in the follow-ups screen).
 */

import { apiData, apiRequest } from "./client";

export type ApiFollowUpType =
  | "CALL"
  | "MEETING"
  | "VISIT"
  | "EMAIL"
  | "OTHER";

export type ApiFollowUpStatus =
  | "PENDING"
  | "COMPLETED"
  | "CANCELLED"
  | "MISSED";

export interface ApiFollowUp {
  id: string;
  sales_user_id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  follow_up_at: string;
  type: ApiFollowUpType;
  status: ApiFollowUpStatus;
  reminder_sent: boolean;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ---------- List ----------------------------------------------------------

export interface ListFollowUpsQuery {
  status?: ApiFollowUpStatus | ApiFollowUpStatus[];
  type?: ApiFollowUpType | ApiFollowUpType[];
  /** Single-day view, `YYYY-MM-DD`. */
  date?: string;
  /** ISO timestamp range start. */
  from?: string;
  /** ISO timestamp range end. */
  to?: string;
  lead_id?: string;
  /** Admin only. */
  user_id?: string;
  page?: number;
  /** Server caps at 200. */
  limit?: number;
}

export interface ListFollowUpsResponse {
  total: number;
  page: number;
  limit: number;
  follow_ups: ApiFollowUp[];
}

function joinEnum<T extends string>(v: T | T[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v.join(",") : v;
}

export function listFollowUps(
  q: ListFollowUpsQuery = {},
  signal?: AbortSignal,
): Promise<ListFollowUpsResponse> {
  return apiData<ListFollowUpsResponse>("/api/v1/sales/follow-ups", {
    query: {
      status: joinEnum(q.status),
      type: joinEnum(q.type),
      date: q.date,
      from: q.from,
      to: q.to,
      lead_id: q.lead_id,
      user_id: q.user_id,
      page: q.page,
      limit: q.limit,
    },
    signal,
  });
}

// ---------- Calendar ------------------------------------------------------

export interface CalendarFollowUp {
  id: string;
  title: string;
  type: ApiFollowUpType;
  follow_up_at: string;
  status: ApiFollowUpStatus;
}

export interface FollowUpsCalendarResponse {
  year: number;
  month: number;
  total: number;
  /** Keyed by `YYYY-MM-DD` (in IST per spec). */
  calendar: Record<string, CalendarFollowUp[]>;
}

export function getFollowUpsCalendar(
  q: { year: number; month: number; user_id?: string },
  signal?: AbortSignal,
): Promise<FollowUpsCalendarResponse> {
  return apiData<FollowUpsCalendarResponse>(
    "/api/v1/sales/follow-ups/calendar",
    {
      query: { year: q.year, month: q.month, user_id: q.user_id },
      signal,
    },
  );
}

// ---------- Upcoming ------------------------------------------------------

export interface UpcomingFollowUpsResponse {
  upcoming: ApiFollowUp[];
  overdue_count: number;
  days_window: number;
}

export function getUpcomingFollowUps(
  q: { days?: number; user_id?: string } = {},
  signal?: AbortSignal,
): Promise<UpcomingFollowUpsResponse> {
  return apiData<UpcomingFollowUpsResponse>(
    "/api/v1/sales/follow-ups/upcoming",
    {
      query: { days: q.days, user_id: q.user_id },
      signal,
    },
  );
}

// ---------- Single --------------------------------------------------------

export function getFollowUp(
  id: string,
  signal?: AbortSignal,
): Promise<ApiFollowUp> {
  return apiData<ApiFollowUp>(`/api/v1/sales/follow-ups/${id}`, { signal });
}

// ---------- Create --------------------------------------------------------

export interface CreateFollowUpInput {
  title: string;
  description?: string;
  /** ISO-8601 timestamp; must be in the future per spec. */
  follow_up_at: string;
  type: ApiFollowUpType;
  lead_id?: string;
  /** Admin only — create on behalf of a rep. */
  sales_user_id?: string;
}

export function createFollowUp(
  input: CreateFollowUpInput,
): Promise<ApiFollowUp> {
  return apiData<ApiFollowUp>("/api/v1/sales/follow-ups", {
    method: "POST",
    body: input,
  });
}

// ---------- Update --------------------------------------------------------

export interface UpdateFollowUpInput {
  title?: string;
  description?: string;
  follow_up_at?: string;
  type?: ApiFollowUpType;
  status?: ApiFollowUpStatus;
  completed_at?: string;
}

export function updateFollowUp(
  id: string,
  patch: UpdateFollowUpInput,
): Promise<ApiFollowUp> {
  return apiData<ApiFollowUp>(`/api/v1/sales/follow-ups/${id}`, {
    method: "PUT",
    body: patch,
  });
}

// ---------- Complete shortcut --------------------------------------------

export function completeFollowUp(
  id: string,
  body?: { notes?: string },
): Promise<ApiFollowUp> {
  return apiData<ApiFollowUp>(`/api/v1/sales/follow-ups/${id}/complete`, {
    method: "POST",
    body: body ?? {},
  });
}

// ---------- Delete --------------------------------------------------------

export function deleteFollowUp(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/sales/follow-ups/${id}`, {
    method: "DELETE",
  }) as Promise<void>;
}
