"use client";

import { getMyTargets } from "@/lib/api/sales-my-targets";

import { useAsync } from "./use-async";

/**
 * Fetches the signed-in rep's targets across all four periods in one call.
 * The endpoint is scoped to the caller — no params, no shared cache needs.
 */
export function useMyTargets() {
  return useAsync((signal) => getMyTargets(signal), []);
}
