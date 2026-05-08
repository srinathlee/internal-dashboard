"use client";

import { useCallback } from "react";

import {
  clearFieldPins,
  createFieldPin,
  listFieldPins,
  type ListFieldPinsQuery,
} from "@/lib/api/sales-field-pins";

import { useAsync } from "./use-async";

export function useFieldPins(q: ListFieldPinsQuery = {}) {
  return useAsync(
    (signal) => listFieldPins(q, signal),
    [q.userId, q.from, q.to],
  );
}

export function useFieldPinMutations() {
  return {
    drop: useCallback(
      (input: { lat: number; lng: number }) => createFieldPin(input),
      [],
    ),
    clearAll: useCallback(
      (userId?: string) => clearFieldPins(userId),
      [],
    ),
  };
}
