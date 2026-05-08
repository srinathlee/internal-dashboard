"use client";

import { useCallback } from "react";

import {
  listManualPoints,
  reverseManualPoint,
  type ListManualPointsQuery,
} from "@/lib/api/sales-scoring";

import { useAsync } from "./use-async";

export function useManualPoints(q: ListManualPointsQuery = {}) {
  return useAsync(
    (signal) => listManualPoints(q, signal),
    [q.userId, q.from, q.to],
  );
}

export function useManualPointMutations() {
  return {
    reverse: useCallback((id: string) => reverseManualPoint(id), []),
  };
}
