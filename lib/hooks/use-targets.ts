"use client";

import { useCallback } from "react";

import {
  listTargets,
  setTargets,
  type ListTargetsQuery,
  type SetTargetsInput,
} from "@/lib/api/sales-scoring";

import { useAsync } from "./use-async";

export function useTargets(q: ListTargetsQuery = {}) {
  return useAsync(
    (signal) => listTargets(q, signal),
    [q.userId, q.period],
  );
}

export function useTargetMutations() {
  return {
    setForUser: useCallback(
      (
        userId: string,
        input: SetTargetsInput,
        period:
          | "monthly"
          | "quarterly"
          | "half_yearly"
          | "yearly" = "monthly",
      ) => setTargets(userId, input, period),
      [],
    ),
  };
}
