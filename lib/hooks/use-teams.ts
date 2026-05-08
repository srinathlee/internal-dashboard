"use client";

import { useCallback } from "react";

import {
  assignTeamAdmin,
  createTeam,
  deleteTeam,
  listTeams,
  removeTeamAdmin,
  updateTeam,
  type AssignAdminInput,
  type CreateTeamInput,
} from "@/lib/api/teams";

import { useAsync } from "./use-async";

export function useTeams() {
  return useAsync((signal) => listTeams(signal), []);
}

export function useTeamMutations() {
  return {
    create: useCallback((input: CreateTeamInput) => createTeam(input), []),
    update: useCallback(
      (
        teamId: string,
        patch: { name?: string; color?: string; description?: string },
      ) => updateTeam(teamId, patch),
      [],
    ),
    remove: useCallback((teamId: string) => deleteTeam(teamId), []),
    assignAdmin: useCallback(
      (teamId: string, input: AssignAdminInput) =>
        assignTeamAdmin(teamId, input),
      [],
    ),
    removeAdmin: useCallback(
      (teamId: string, options?: { demote?: boolean }) =>
        removeTeamAdmin(teamId, options),
      [],
    ),
  };
}
