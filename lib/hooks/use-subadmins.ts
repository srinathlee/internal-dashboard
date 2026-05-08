"use client";

import { useCallback } from "react";

import {
  coachSubadmin,
  createSubadmin,
  deleteSubadmin,
  getSubadmin,
  getSubadminLocationHistory,
  listSubadmins,
  messageSubadmin,
  pinSubadminLocation,
  updateSubadmin,
  updateSubadminTarget,
  type CreateSubadminInput,
  type ListSubadminsQuery,
  type SubadminLocationInput,
  type UpdateSubadminInput,
} from "@/lib/api/sales-subadmins";

import { useAsync } from "./use-async";

export function useSubadmins(q: ListSubadminsQuery = {}) {
  return useAsync(
    (signal) => listSubadmins(q, signal),
    [q.page, q.limit, q.q, q.status],
  );
}

export function useSubadmin(id: string | null) {
  return useAsync(
    (signal) => (id ? getSubadmin(id, signal) : Promise.resolve(null)),
    [id],
  );
}

export function useSubadminLocationHistory(
  id: string | null,
  q: { page?: number; limit?: number } = {},
) {
  return useAsync(
    (signal) =>
      id
        ? getSubadminLocationHistory(id, q, signal)
        : Promise.resolve(null),
    [id, q.page, q.limit],
  );
}

export function useSubadminMutations() {
  return {
    create: useCallback(
      (input: CreateSubadminInput) => createSubadmin(input),
      [],
    ),
    update: useCallback(
      (id: string, input: UpdateSubadminInput) => updateSubadmin(id, input),
      [],
    ),
    remove: useCallback((id: string) => deleteSubadmin(id), []),
    setTarget: useCallback(
      (
        id: string,
        input: {
          target_hospitals?: number;
          target_period?: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
        },
      ) => updateSubadminTarget(id, input),
      [],
    ),
    pinLocation: useCallback(
      (id: string, input: SubadminLocationInput) =>
        pinSubadminLocation(id, input),
      [],
    ),
    coach: useCallback(
      (id: string, input: { subject: string; notes: string }) =>
        coachSubadmin(id, input),
      [],
    ),
    message: useCallback(
      (
        id: string,
        input: { channel: "in_app"; subject: string; body: string },
      ) => messageSubadmin(id, input),
      [],
    ),
  };
}
