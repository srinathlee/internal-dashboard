"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  /** Re-run the underlying loader. */
  refetch: () => Promise<void>;
  /** Replace the cached value without hitting the network. */
  setData: (next: T | null) => void;
}

/**
 * Tiny data-fetching hook tailored to the Sales API surface.
 *
 * Why not SWR / React Query? The dashboard's data needs are simple — a
 * handful of GETs per page, no shared cache requirements yet. Adding a
 * dependency for that overhead would be premature. When list endpoints
 * grow shared cache needs (lead detail vs lead row in pipeline), promote
 * to a proper cache.
 */
export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>,
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current(signal);
      if (!signal.aborted) {
        setData(result);
      }
    } catch (err) {
      if (signal.aborted) return;
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    void run(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(async () => {
    const ctrl = new AbortController();
    await run(ctrl.signal);
  }, [run]);

  return { data, error, isLoading, refetch, setData };
}

/**
 * Re-run the given refetchers whenever the tab regains focus or becomes
 * visible again. Lets an already-open page pick up changes made elsewhere —
 * e.g. a rep deleting a lead on their own app should be reflected on the
 * admin's open rep-profile (lead count, sprint ₹, sprints list) when the admin
 * switches back to the dashboard, without a manual reload.
 *
 * The `refetch` callbacks from `useAsync` are stable, so passing a fresh array
 * inline each render is fine (we read the latest via a ref). A short throttle
 * collapses the focus+visibilitychange pair that fires together on alt-tab.
 */
export function useRefetchOnFocus(refetchers: ReadonlyArray<() => void>): void {
  const refetchersRef = useRef(refetchers);
  refetchersRef.current = refetchers;
  const lastRunRef = useRef(0);

  useEffect(() => {
    const run = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      const now = Date.now();
      // Collapse the focus + visibilitychange events that both fire on alt-tab.
      if (now - lastRunRef.current < 1000) return;
      lastRunRef.current = now;
      for (const refetch of refetchersRef.current) refetch();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, []);
}

/**
 * Friendly text for the structured `error.code` values the Sales API
 * returns. Source of truth:
 *   - docs/BACKEND_SPEC_SALES_ADMIN_ACCESS.md §2 (WRONG_TEAM)
 *   - docs/BACKEND_SPEC_SELF_PASSWORD_CHANGE.md §4 (password codes)
 *   - sales-api.md §12 (LOST_REQUIRES_REASON, TEAM_NOT_EMPTY, WEIGHTS_NOT_100)
 *
 * The backend already returns reasonable `message` strings for these, but
 * pinning the user-facing copy here gives consistent UX even if the backend
 * changes wording, and it lets future code branch on the code without
 * re-parsing the message.
 */
const FRIENDLY_BY_CODE: Record<string, string> = {
  WRONG_TEAM:
    "This action targets a different team. You can only act within your own team.",
  BAD_CURRENT_PASSWORD: "Current password is incorrect.",
  WEAK_PASSWORD: "New password must be at least 8 characters.",
  SAME_PASSWORD: "New password must be different from your current one.",
  LOST_REQUIRES_REASON:
    "Use the Mark as lost flow — moving a lead to Lost requires a reason.",
  TEAM_NOT_EMPTY: "Remove all members before deleting this team.",
  WEIGHTS_NOT_100: "Active rule weights must sum to 100.",
};

/** Render-friendly message for any error returned from useAsync. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const friendly = err.code ? FRIENDLY_BY_CODE[err.code] : undefined;
    if (friendly) return friendly;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

/** Returns the structured error code if the error is a coded ApiError. */
export function errorCode(err: unknown): string | undefined {
  if (err instanceof ApiError) return err.code;
  return undefined;
}
