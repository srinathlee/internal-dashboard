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

/** Render-friendly message for any error returned from useAsync. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
