"use client";

import { useCallback } from "react";

import {
  clearFieldPins,
  createFieldPin,
  deleteFieldPin,
  listFieldPins,
  updateFieldPin,
  type CreateFieldPinInput,
  type ListFieldPinsQuery,
  type UpdateFieldPinInput,
} from "@/lib/api/sales-field-pins";

import { useAsync } from "./use-async";

export function useFieldPins(q: ListFieldPinsQuery = {}) {
  return useAsync(
    (signal) => listFieldPins(q, signal),
    [q.userId, q.date, q.from, q.to, q.includeHidden],
  );
}

export function useFieldPinMutations() {
  return {
    drop: useCallback(
      (input: CreateFieldPinInput) => createFieldPin(input),
      [],
    ),
    update: useCallback(
      (pinId: string, body: UpdateFieldPinInput) =>
        updateFieldPin(pinId, body),
      [],
    ),
    remove: useCallback((pinId: string) => deleteFieldPin(pinId), []),
    clearAll: useCallback((userId?: string) => clearFieldPins(userId), []),
  };
}
