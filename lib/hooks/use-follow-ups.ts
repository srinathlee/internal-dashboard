"use client";

import { useCallback } from "react";

import {
  completeFollowUp,
  createFollowUp,
  deleteFollowUp,
  getFollowUp,
  getFollowUpsCalendar,
  getUpcomingFollowUps,
  listFollowUps,
  updateFollowUp,
  type CreateFollowUpInput,
  type ListFollowUpsQuery,
  type UpdateFollowUpInput,
} from "@/lib/api/sales-follow-ups";

import { useAsync } from "./use-async";

/**
 * Paged list view (drives the "All follow-ups" table).
 * Pass `status` to filter; the screen reuses this for filter chips.
 */
export function useFollowUpsList(q: ListFollowUpsQuery = {}) {
  const statusKey = Array.isArray(q.status)
    ? q.status.join(",")
    : (q.status ?? "");
  const typeKey = Array.isArray(q.type) ? q.type.join(",") : (q.type ?? "");
  return useAsync(
    (signal) => listFollowUps(q, signal),
    [
      statusKey,
      typeKey,
      q.date ?? "",
      q.from ?? "",
      q.to ?? "",
      q.lead_id ?? "",
      q.user_id ?? "",
      q.page ?? 0,
      q.limit ?? 0,
    ],
  );
}

/**
 * Month-grouped calendar payload. Refetches when year or month changes.
 */
export function useFollowUpsCalendar(year: number, month: number) {
  return useAsync(
    (signal) => getFollowUpsCalendar({ year, month }, signal),
    [year, month],
  );
}

/**
 * Upcoming pending follow-ups within `days` (default 7) + the overdue count.
 * Drives both the Upcoming card and the overdue banner.
 */
export function useUpcomingFollowUps(days: number = 7) {
  return useAsync(
    (signal) => getUpcomingFollowUps({ days }, signal),
    [days],
  );
}

export function useFollowUp(id: string | null) {
  return useAsync(
    (signal) => (id ? getFollowUp(id, signal) : Promise.resolve(null)),
    [id],
  );
}

/**
 * Mutation helpers. Each returns a Promise so callers can await + then
 * refetch the affected list/calendar queries.
 */
export function useFollowUpMutations() {
  return {
    create: useCallback(
      (input: CreateFollowUpInput) => createFollowUp(input),
      [],
    ),
    update: useCallback(
      (id: string, patch: UpdateFollowUpInput) => updateFollowUp(id, patch),
      [],
    ),
    complete: useCallback(
      (id: string, notes?: string) =>
        completeFollowUp(id, notes ? { notes } : undefined),
      [],
    ),
    remove: useCallback((id: string) => deleteFollowUp(id), []),
  };
}
