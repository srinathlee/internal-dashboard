/**
 * Sales in-app notifications.
 *
 * Spec: SALES_FOLLOWUP_API.md > Notification Endpoints.
 * Base: /api/v1/sales/notifications.
 *
 * Notifications are server-generated (currently only `FOLLOW_UP_REMINDER`,
 * fired 2 hours before a follow-up by the BullMQ worker). The client only
 * reads them and toggles is_read.
 */

import { apiData } from "./client";
import type { ApiFollowUpType } from "./sales-follow-ups";

export type ApiNotificationType = "FOLLOW_UP_REMINDER" | string;

export interface ApiNotification {
  id: string;
  sales_user_id: string;
  follow_up_id: string | null;
  type: ApiNotificationType;
  title: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  meta: {
    follow_up_at?: string;
    lead_id?: string | null;
    follow_up_type?: ApiFollowUpType;
    [k: string]: unknown;
  } | null;
  created_at: string;
}

// ---------- Count (badge) -------------------------------------------------

export interface NotificationCountResponse {
  unread_count: number;
}

export function getNotificationCount(
  signal?: AbortSignal,
): Promise<NotificationCountResponse> {
  return apiData<NotificationCountResponse>(
    "/api/v1/sales/notifications/count",
    { signal },
  );
}

// ---------- List ----------------------------------------------------------

export interface ListNotificationsQuery {
  is_read?: boolean;
  page?: number;
  /** Server caps at 100; default 30. */
  limit?: number;
}

export interface ListNotificationsResponse {
  total: number;
  unread_count: number;
  page: number;
  notifications: ApiNotification[];
}

export function listNotifications(
  q: ListNotificationsQuery = {},
  signal?: AbortSignal,
): Promise<ListNotificationsResponse> {
  return apiData<ListNotificationsResponse>("/api/v1/sales/notifications", {
    query: {
      // Backend expects "true"/"false" strings on the wire.
      is_read: q.is_read === undefined ? undefined : String(q.is_read),
      page: q.page,
      limit: q.limit,
    },
    signal,
  });
}

// ---------- Mark read -----------------------------------------------------

export function markNotificationRead(id: string): Promise<ApiNotification> {
  return apiData<ApiNotification>(
    `/api/v1/sales/notifications/${id}/read`,
    { method: "PATCH" },
  );
}

export function markAllNotificationsRead(): Promise<{ message: string }> {
  return apiData<{ message: string }>(
    "/api/v1/sales/notifications/read-all",
    { method: "PATCH" },
  );
}
