"use client";

import { getPipelineHealth } from "@/lib/api/sales-overview";

import { useAsync } from "./use-async";

/** GET /pipeline/health — stale-lead / conversion / at-risk indicators. */
export function usePipelineHealth() {
  return useAsync((signal) => getPipelineHealth(signal), []);
}
