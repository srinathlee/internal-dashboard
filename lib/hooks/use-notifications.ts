"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clearAllNotifications,
  deleteNotification,
  getNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ListNotificationsQuery,
} from "@/lib/api/sales-notifications";

import { useAsync } from "./use-async";

/**
 * Poll the unread count on a 60s interval (per spec) so the bell badge
 * stays fresh without the rep reloading. Also re-fetches on tab focus
 * — a rep returning from another tab expects to see the latest count
 * before the next 60s tick.
 */
export function useNotificationCount(intervalMs: number = 60_000) {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async () => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    try {
      const res = await getNotificationCount(ctrl.signal);
      if (!ctrl.signal.aborted) {
        setCount(res.unread_count ?? 0);
        setError(null);
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!ctrl.signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOnce();
    const id = window.setInterval(fetchOnce, intervalMs);
    const onFocus = () => void fetchOnce();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      inflight.current?.abort();
    };
  }, [fetchOnce, intervalMs]);

  return { count, isLoading, error, refetch: fetchOnce, setCount };
}

/**
 * Paged notification list. Pass `is_read: false` to drive the unread-first
 * dropdown shown when the rep opens the bell.
 */
export function useNotifications(q: ListNotificationsQuery = {}) {
  return useAsync(
    (signal) => listNotifications(q, signal),
    [q.is_read === undefined ? "" : String(q.is_read), q.page ?? 0, q.limit ?? 0],
  );
}

export function useNotificationMutations() {
  return {
    markRead: useCallback((id: string) => markNotificationRead(id), []),
    markAllRead: useCallback(() => markAllNotificationsRead(), []),
    remove: useCallback((id: string) => deleteNotification(id), []),
    clearAll: useCallback(
      (before?: string) => clearAllNotifications(before),
      [],
    ),
  };
}
