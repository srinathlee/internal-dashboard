/**
 * Section 4 of the Sales API: Sales reps (subadmins) lifecycle.
 */

import { apiData, apiRequest } from "./client";
import type {
  ApiSubadmin,
  ListSubadminsResponse,
  LocationPin,
} from "./types";

export interface ListSubadminsQuery {
  page?: number;
  limit?: number;
  q?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export function listSubadmins(
  q: ListSubadminsQuery = {},
  signal?: AbortSignal,
): Promise<ListSubadminsResponse> {
  return apiData<ListSubadminsResponse>("/api/v1/sales/subadmins", {
    query: q,
    signal,
  });
}

export interface CreateSubadminInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  status?: "ACTIVE" | "INACTIVE";
  target_hospitals?: number;
  target_period?: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
}

export function createSubadmin(input: CreateSubadminInput): Promise<ApiSubadmin> {
  return apiData<ApiSubadmin>("/api/v1/sales/subadmins", {
    method: "POST",
    body: input,
  });
}

// ---- Atomic rep + targets create (POST /sales/teams/:teamId/reps) ----------

export interface SalesRepLeadTargets {
  weekly?: number;
  monthly?: number;
  quarterly?: number;
  yearly?: number;
}

export interface SalesRepSprintRow {
  count: number;
  amount: number;
}

export interface SalesRepSprintTargets {
  monthly?: SalesRepSprintRow;
  quarterly?: SalesRepSprintRow;
  yearly?: SalesRepSprintRow;
}

export interface SalesRepRevenueTargets {
  monthly?: number;
  quarterly?: number;
  half_yearly?: number;
  yearly?: number;
}

export interface CreateSalesRepWithTargetsInput {
  rep: {
    name: string;
    email: string;
    phone: string;
    password: string;
  };
  targets: {
    leads?: SalesRepLeadTargets;
    sprints?: SalesRepSprintTargets;
    revenue?: SalesRepRevenueTargets;
  };
  send_welcome_email?: boolean;
}

export type WelcomeEmailResult =
  | { sent: true; to: string; message_id: string; sent_at: string }
  | {
      sent: false;
      to: string;
      reason: "skipped" | "smtp_error";
      error?: string;
    };

export interface CreateSalesRepWithTargetsResponse {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    team_id: string;
    status: string;
    must_change_password: boolean;
    created_at: string;
  };
  targets: {
    leads?: SalesRepLeadTargets;
    sprints?: {
      monthly?: { count: number; amount: number; currency: string };
      quarterly?: { count: number; amount: number; currency: string };
      yearly?: { count: number; amount: number; currency: string };
    };
    revenue?: {
      monthly?: { amount: number; currency: string };
      quarterly?: { amount: number; currency: string };
      half_yearly?: { amount: number; currency: string };
      yearly?: { amount: number; currency: string };
    };
  };
  email: WelcomeEmailResult;
}

export function createSalesRepWithTargets(
  teamId: string,
  input: CreateSalesRepWithTargetsInput,
): Promise<CreateSalesRepWithTargetsResponse> {
  return apiData<CreateSalesRepWithTargetsResponse>(
    `/api/v1/sales/teams/${encodeURIComponent(teamId)}/reps`,
    { method: "POST", body: input },
  );
}

export interface ResendWelcomeEmailInput {
  reset_password: true;
  new_password?: string;
}

export interface ResendWelcomeEmailResponse {
  user_id: string;
  email: WelcomeEmailResult;
  password_rotated: boolean;
}

export function resendSalesRepWelcomeEmail(
  userId: string,
  input: ResendWelcomeEmailInput = { reset_password: true },
): Promise<ResendWelcomeEmailResponse> {
  return apiData<ResendWelcomeEmailResponse>(
    `/api/v1/sales/subadmins/${encodeURIComponent(userId)}/resend-welcome-email`,
    { method: "POST", body: input },
  );
}

export function getSubadmin(
  id: string,
  signal?: AbortSignal,
): Promise<ApiSubadmin> {
  return apiData<ApiSubadmin>(`/api/v1/sales/subadmins/${id}`, { signal });
}

export interface UpdateSubadminInput
  extends Partial<CreateSubadminInput> {}

export function updateSubadmin(
  id: string,
  input: UpdateSubadminInput,
): Promise<ApiSubadmin> {
  return apiData<ApiSubadmin>(`/api/v1/sales/subadmins/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteSubadmin(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/sales/subadmins/${id}`, {
    method: "DELETE",
  });
}

export function updateSubadminTarget(
  id: string,
  input: {
    target_hospitals?: number;
    target_period?: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
  },
): Promise<{ id: string; target_hospitals: number; target_period: string }> {
  return apiData(`/api/v1/sales/subadmins/${id}/target`, {
    method: "PUT",
    body: input,
  });
}

export interface SubadminLocationInput {
  hospital_id?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
  timezone?: string;
}

export function pinSubadminLocation(
  id: string,
  input: SubadminLocationInput = {},
): Promise<LocationPin> {
  return apiData<LocationPin>(
    `/api/v1/sales/subadmins/${id}/location-pin`,
    { method: "POST", body: input },
  );
}

export function getSubadminLocationHistory(
  id: string,
  q: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
): Promise<LocationPin[] | { rows: LocationPin[]; total: number }> {
  return apiData<LocationPin[] | { rows: LocationPin[]; total: number }>(
    `/api/v1/sales/subadmins/${id}/location-history`,
    { query: q, signal },
  );
}

export function coachSubadmin(
  id: string,
  input: { subject: string; notes: string },
): Promise<unknown> {
  return apiData(`/api/v1/sales/subadmins/${id}/coach`, {
    method: "POST",
    body: input,
  });
}

export function messageSubadmin(
  id: string,
  input: { channel: "in_app"; subject: string; body: string },
): Promise<unknown> {
  return apiData(`/api/v1/sales/subadmins/${id}/message`, {
    method: "POST",
    body: input,
  });
}
