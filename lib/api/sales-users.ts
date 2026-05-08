/**
 * Section 2 of the Sales API: Teams config + user management.
 */

import { apiData } from "./client";
import type {
  ApiUser,
  ApiUserRole,
  InviteResponse,
  TeamConfig,
} from "./types";

export function getSalesTeamConfig(
  signal?: AbortSignal,
): Promise<TeamConfig> {
  return apiData<TeamConfig>("/api/v1/sales/teams/config", { signal });
}

export interface ListSalesUsersQuery {
  status?: "active" | "inactive";
  q?: string;
  /**
   * Filter by surface role. SUPER_ADMIN can use any combination; SALES_ADMIN
   * is implicitly scoped to their own team and cannot list other admins.
   * Comma-separated when multiple values are needed (per spec sec. 5).
   */
  role?: ApiUserRole | string;
  /**
   * SUPER_ADMIN-only: scope the result to a specific team. Ignored by the
   * backend when the caller is a SALES_ADMIN (they always see their own team).
   */
  team_id?: string;
}

export function listSalesUsers(
  q: ListSalesUsersQuery = {},
  signal?: AbortSignal,
): Promise<ApiUser[]> {
  return apiData<ApiUser[]>("/api/v1/sales/users", {
    query: {
      status: q.status,
      q: q.q,
      role: q.role,
      team_id: q.team_id,
    },
    signal,
  });
}

/**
 * POST /api/v1/sales/teams/invites — create a SALES_SUBADMIN.
 *
 * Per spec sec. 5: SUPER_ADMIN must include `team_id`; SALES_ADMIN omits it
 * (the backend infers from the JWT and rejects mismatches with WRONG_TEAM).
 */
export function inviteSalesMember(
  input: { name: string; email: string; team_id?: string },
): Promise<InviteResponse> {
  return apiData<InviteResponse>("/api/v1/sales/teams/invites", {
    method: "POST",
    body: input,
  });
}

export function updateMyProfile(name: string): Promise<ApiUser> {
  return apiData<ApiUser>("/api/v1/sales/users/me/profile", {
    method: "PATCH",
    body: { name },
  });
}

/**
 * PATCH /api/v1/sales/users/me/password — self-service password change.
 *
 * Body: `{ current_password, new_password }`. Backend verifies the current
 * password before hashing+storing the new one. Response confirms the
 * change but never echoes a password back.
 *
 * Note: this endpoint isn't part of the original SUPER_ADMIN spec — that
 * one only documents super-admin-driven resets via PATCH /sales/subadmins/:id.
 * Members and team admins need a way to change their own password without
 * involving the super admin, so we expose it here. If the backend hasn't
 * shipped this route yet, the call surfaces a 404 to the user.
 */
export function changeMyPassword(input: {
  current_password: string;
  new_password: string;
}): Promise<{ updated: boolean }> {
  return apiData<{ updated: boolean }>(
    "/api/v1/sales/users/me/password",
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function updateUserRole(
  userId: string,
  role: ApiUserRole,
): Promise<{ userId: string; role: ApiUserRole; updated: boolean }> {
  return apiData(`/api/v1/sales/users/${userId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export function updateUserStatus(
  userId: string,
  status: "active" | "inactive",
): Promise<{ userId: string; status: string; updated: boolean }> {
  return apiData(`/api/v1/sales/users/${userId}/status`, {
    method: "PATCH",
    body: { status },
  });
}
