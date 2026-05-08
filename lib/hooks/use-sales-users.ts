"use client";

import { useCallback } from "react";

import {
  getSalesTeamConfig,
  inviteSalesMember,
  listSalesUsers,
  updateMyProfile,
  updateUserRole,
  updateUserStatus,
  type ListSalesUsersQuery,
} from "@/lib/api/sales-users";
import type { ApiUserRole } from "@/lib/api/types";

import { useAsync } from "./use-async";

export function useSalesTeamConfig() {
  return useAsync((signal) => getSalesTeamConfig(signal), []);
}

export function useSalesUsers(q: ListSalesUsersQuery = {}) {
  return useAsync(
    (signal) => listSalesUsers(q, signal),
    [q.q, q.status],
  );
}

export function useSalesUserMutations() {
  return {
    invite: useCallback(
      (input: { name: string; email: string }) => inviteSalesMember(input),
      [],
    ),
    updateMyName: useCallback(
      (name: string) => updateMyProfile(name),
      [],
    ),
    setRole: useCallback(
      (userId: string, role: ApiUserRole) => updateUserRole(userId, role),
      [],
    ),
    setStatus: useCallback(
      (userId: string, status: "active" | "inactive") =>
        updateUserStatus(userId, status),
      [],
    ),
  };
}
