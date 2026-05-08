/**
 * Team CRUD endpoints.
 *
 * These endpoints are specced in docs/BACKEND_SPEC_ROLES_AND_TEAMS.md but
 * are NOT live yet. Calling them will return 404 from the current backend
 * — the UI handles those errors with a "backend not ready" toast and stays
 * usable in cosmetic mode against the existing /sales/teams/config and
 * /sales/users endpoints.
 *
 * Once the backend ships the spec, no client-side change is needed; the
 * 404s will turn into 200s automatically.
 */

import { apiData, apiRequest } from "./client";

export interface ApiTeam {
  id: string;
  name: string;
  color: string;
  description: string;
  admin: ApiTeamAdmin | null;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApiTeamAdmin {
  user_id: string;
  name: string;
  email: string;
  role?: "SALES_ADMIN";
  team_id?: string;
  status?: "ACTIVE" | "INACTIVE";
  created_at?: string;
}

export interface CreateTeamInput {
  id: string;
  name: string;
  color?: string;
  description?: string;
  admin: {
    name: string;
    email: string;
    phone: string;
    password: string;
  };
}

export interface CreateTeamResponse {
  team: {
    id: string;
    name: string;
    color: string;
    description: string;
    created_at: string;
    updated_at: string;
  };
  admin: ApiTeamAdmin;
}

export function listTeams(signal?: AbortSignal): Promise<ApiTeam[]> {
  return apiData<ApiTeam[]>("/api/v1/teams", { signal });
}

export function createTeam(
  input: CreateTeamInput,
): Promise<CreateTeamResponse> {
  return apiData<CreateTeamResponse>("/api/v1/teams", {
    method: "POST",
    body: input,
  });
}

export function updateTeam(
  teamId: string,
  patch: { name?: string; color?: string; description?: string },
): Promise<ApiTeam> {
  return apiData<ApiTeam>(`/api/v1/teams/${teamId}`, {
    method: "PATCH",
    body: patch,
  });
}

export function deleteTeam(teamId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/teams/${teamId}`, {
    method: "DELETE",
  });
}

export interface AssignAdminInput {
  admin?: { name: string; email: string; phone: string; password: string };
  existing_user_id?: string;
}

export function assignTeamAdmin(
  teamId: string,
  input: AssignAdminInput,
): Promise<ApiTeamAdmin> {
  return apiData<ApiTeamAdmin>(`/api/v1/teams/${teamId}/admin`, {
    method: "POST",
    body: input,
  });
}

export function removeTeamAdmin(
  teamId: string,
  options: { demote?: boolean } = { demote: true },
): Promise<{
  team_id: string;
  previous_admin_id: string;
  action: "demoted" | "deleted";
}> {
  return apiData(`/api/v1/teams/${teamId}/admin`, {
    method: "DELETE",
    body: options,
  });
}
