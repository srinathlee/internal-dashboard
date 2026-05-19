"use client";

import { useCallback } from "react";

import {
  addGroupMembers,
  createGroup,
  deleteGroup,
  getGroup,
  getGroupAnalytics,
  listGroups,
  removeGroupMember,
  updateGroup,
  type CreateGroupInput,
  type GroupAnalyticsPeriod,
  type ListGroupsQuery,
  type UpdateGroupInput,
} from "@/lib/api/sales-groups";

import { useAsync } from "./use-async";

export function useGroups(q: ListGroupsQuery = {}) {
  return useAsync(
    (signal) => listGroups(q, signal),
    [
      q.q ?? "",
      q.is_active === undefined ? "" : String(q.is_active),
      q.team_id ?? "",
    ],
  );
}

export function useGroup(id: string | null) {
  return useAsync(
    (signal) => (id ? getGroup(id, signal) : Promise.resolve(null)),
    [id],
  );
}

export function useGroupAnalytics(
  groupId: string | null,
  period: GroupAnalyticsPeriod = "MONTHLY",
) {
  return useAsync(
    (signal) =>
      groupId
        ? getGroupAnalytics(groupId, period, signal)
        : Promise.resolve(null),
    [groupId, period],
  );
}

export function useGroupMutations() {
  return {
    create: useCallback((input: CreateGroupInput) => createGroup(input), []),
    update: useCallback(
      (id: string, patch: UpdateGroupInput) => updateGroup(id, patch),
      [],
    ),
    remove: useCallback((id: string) => deleteGroup(id), []),
    addMembers: useCallback(
      (id: string, user_ids: string[]) => addGroupMembers(id, user_ids),
      [],
    ),
    removeMember: useCallback(
      (groupId: string, userId: string) =>
        removeGroupMember(groupId, userId),
      [],
    ),
  };
}
