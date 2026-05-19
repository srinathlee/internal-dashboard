/**
 * Sales groups — organise reps into zones / sub-teams.
 *
 * Spec: SALES_GROUPS_API.md.
 * Base: /api/v1/sales/groups.
 * SALES_ADMIN scoped to own team; SUPER_ADMIN can pass `team_id` to filter.
 * SALES_SUBADMIN sees only their own group.
 */

import { apiData, apiRequest } from "./client";

export type SalesGroupColor = "blue" | "red" | "green" | "purple" | "orange";

export interface SalesGroup {
  id: string;
  name: string;
  description: string | null;
  color: SalesGroupColor;
  team_id: string;
  is_active: boolean;
  member_count: number;
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
}

export interface SalesGroupMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "SALES_SUBADMIN";
  status: "ACTIVE" | "INACTIVE";
  initials: string;
  group_id: string | null;
  team_id: string;
  created_at: string;
}

export interface SalesGroupDetail extends SalesGroup {
  members: SalesGroupMember[];
}

// ---------- List ----------------------------------------------------------

export interface ListGroupsQuery {
  q?: string;
  is_active?: boolean;
  /** SUPER_ADMIN only — filter by team. */
  team_id?: string;
}

export interface ListGroupsResponse {
  data: SalesGroup[];
  total: number;
}

export function listGroups(
  q: ListGroupsQuery = {},
  signal?: AbortSignal,
): Promise<SalesGroup[]> {
  return apiData<ListGroupsResponse | SalesGroup[]>("/api/v1/sales/groups", {
    query: {
      q: q.q,
      is_active: q.is_active === undefined ? undefined : String(q.is_active),
      team_id: q.team_id,
    },
    signal,
  }).then((res) => (Array.isArray(res) ? res : res.data ?? []));
}

// ---------- Create --------------------------------------------------------

export interface CreateGroupInput {
  name: string;
  description?: string;
  color?: SalesGroupColor;
  /** SUPER_ADMIN only. */
  team_id?: string;
  /** Pre-assign SALES_SUBADMIN users at creation time. */
  member_ids?: string[];
}

export function createGroup(input: CreateGroupInput): Promise<SalesGroup> {
  return apiData<SalesGroup>("/api/v1/sales/groups", {
    method: "POST",
    body: input,
  });
}

// ---------- Detail --------------------------------------------------------

export function getGroup(
  id: string,
  signal?: AbortSignal,
): Promise<SalesGroupDetail> {
  return apiData<SalesGroupDetail>(`/api/v1/sales/groups/${id}`, { signal });
}

// ---------- Update --------------------------------------------------------

export interface UpdateGroupInput {
  name?: string;
  description?: string | null;
  color?: SalesGroupColor;
  is_active?: boolean;
}

export function updateGroup(
  id: string,
  patch: UpdateGroupInput,
): Promise<SalesGroup> {
  return apiData<SalesGroup>(`/api/v1/sales/groups/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

// ---------- Delete --------------------------------------------------------

export interface DeleteGroupResponse {
  id: string;
  members_unassigned: number;
}

export function deleteGroup(id: string): Promise<DeleteGroupResponse | void> {
  return apiData<DeleteGroupResponse>(`/api/v1/sales/groups/${id}`, {
    method: "DELETE",
  }).catch((err: unknown) => {
    // Some deployments return 204 with no body — apiData throws on empty JSON.
    // Treat that as success.
    if (err instanceof Error && /Unexpected end of JSON/i.test(err.message)) {
      return undefined as unknown as DeleteGroupResponse;
    }
    throw err;
  });
}

// ---------- Members -------------------------------------------------------

export interface AddGroupMembersResponse {
  group_id: string;
  added: number;
  members: SalesGroupMember[];
}

export function addGroupMembers(
  groupId: string,
  user_ids: string[],
): Promise<AddGroupMembersResponse> {
  return apiData<AddGroupMembersResponse>(
    `/api/v1/sales/groups/${groupId}/members`,
    { method: "POST", body: { user_ids } },
  );
}

export function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  return apiRequest<void>(
    `/api/v1/sales/groups/${groupId}/members/${userId}`,
    { method: "DELETE" },
  );
}

// ---------- Analytics -----------------------------------------------------

export type GroupAnalyticsPeriod =
  | "MONTHLY"
  | "QUARTERLY"
  | "HALF_YEARLY"
  | "YEARLY";

export type GroupTargetStatus =
  | "ACHIEVED"
  | "ON_TRACK"
  | "AT_RISK"
  | "BEHIND"
  | "UNSET";

export interface GroupAnalyticsTarget {
  target: number;
  actual: number;
  progress_pct: number | null;
  members_with_target: number;
  status: GroupTargetStatus;
}

export interface GroupAnalyticsMember {
  id: string;
  name: string;
  email: string;
  initials: string;
  status: "ACTIVE" | "INACTIVE";
  total_leads: number;
  overall_pace: number;
  metrics: Record<
    string,
    { target: number; actual: number; progress_pct: number | null }
  >;
}

export interface GroupAnalyticsResponse {
  group: {
    id: string;
    name: string;
    color: SalesGroupColor;
    member_count: number;
  };
  period: GroupAnalyticsPeriod;
  as_of: string;
  summary: {
    total_members: number;
    active_members: number;
    total_leads: number;
    top_performer: {
      id: string;
      name: string;
      overall_pace: number;
    } | null;
  };
  lead_pipeline: Record<string, number>;
  targets: Record<string, GroupAnalyticsTarget>;
  follow_ups: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
  };
  member_performance: GroupAnalyticsMember[];
}

export function getGroupAnalytics(
  groupId: string,
  period: GroupAnalyticsPeriod = "MONTHLY",
  signal?: AbortSignal,
): Promise<GroupAnalyticsResponse> {
  return apiData<GroupAnalyticsResponse>(
    `/api/v1/sales/groups/${groupId}/analytics`,
    { query: { period }, signal },
  );
}
