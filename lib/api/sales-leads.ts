/**
 * Section 3 of the Sales API: Leads CRUD, pipeline, activities.
 */

import { apiData, apiRequest } from "./client";
import type {
  ActivityFeed,
  ApiLead,
  ApiLeadActivityKind,
  ApiLeadDetail,
  ApiLeadStage,
  ApiLeadTimelineEntry,
  ApiLostReason,
  LeadPerson,
  LeadStats,
  ListLeadsResponse,
  PipelineResponse,
} from "./types";

export interface ListLeadsQuery {
  q?: string;
  stage?: ApiLeadStage;
  city?: string;
  lead_source?: string;
  sales_user_id?: string | string[];
  page?: number;
  limit?: number;
}

export function listLeads(
  q: ListLeadsQuery = {},
  signal?: AbortSignal,
): Promise<ListLeadsResponse> {
  return apiData<ListLeadsResponse>("/api/v1/sales/leads", {
    query: {
      q: q.q,
      stage: q.stage,
      city: q.city,
      lead_source: q.lead_source,
      sales_user_id: Array.isArray(q.sales_user_id)
        ? q.sales_user_id.join(",")
        : q.sales_user_id,
      page: q.page,
      limit: q.limit,
    },
    signal,
  });
}

export interface CreateLeadInput {
  clinic_name: string;
  doctor_name: string;
  specialization?: string;
  phone: string;
  city: string;
  area?: string;
  address?: string;
  lead_source?: string;
  stage?: ApiLeadStage;
  monthly_appointments?: number;
  number_of_branches?: number;
  estimated_value?: number;
  notes?: string;
  /** Required for SUPER_ADMIN. */
  sales_user_id?: string;
}

export function createLead(input: CreateLeadInput): Promise<ApiLead> {
  return apiData<ApiLead>("/api/v1/sales/leads", {
    method: "POST",
    body: input,
  });
}

export function getLead(id: string, signal?: AbortSignal): Promise<ApiLeadDetail> {
  return apiData<ApiLeadDetail>(`/api/v1/sales/leads/${id}`, { signal });
}

export function updateLead(
  id: string,
  patch: Partial<CreateLeadInput>,
): Promise<ApiLead> {
  return apiData<ApiLead>(`/api/v1/sales/leads/${id}`, {
    method: "PUT",
    body: patch,
  });
}

export function updateLeadStage(
  id: string,
  stage: ApiLeadStage,
): Promise<ApiLead> {
  return apiData<ApiLead>(`/api/v1/sales/leads/${id}/stage`, {
    method: "PATCH",
    body: { stage },
  });
}

export function markLeadLost(
  id: string,
  input: { reason: ApiLostReason; notes?: string },
): Promise<ApiLead> {
  return apiData<ApiLead>(`/api/v1/sales/leads/${id}/lost`, {
    method: "POST",
    body: input,
  });
}

export function restoreLostLead(id: string): Promise<ApiLead> {
  return apiData<ApiLead>(`/api/v1/sales/leads/${id}/restore`, {
    method: "POST",
  });
}

export function setLeadNextAction(
  id: string,
  input: { title: string | null; due: string | null },
): Promise<ApiLead> {
  return apiData<ApiLead>(`/api/v1/sales/leads/${id}/next-action`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteLead(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/sales/leads/${id}`, {
    method: "DELETE",
  });
}

export interface PipelineQuery {
  stage?: ApiLeadStage | ApiLeadStage[];
  q?: string;
  recency?: "active" | "stale";
  with_next_action?: boolean;
  sales_user_id?: string;
}

export function getLeadsPipeline(
  q: PipelineQuery = {},
  signal?: AbortSignal,
): Promise<PipelineResponse> {
  return apiData<PipelineResponse>("/api/v1/sales/leads/pipeline", {
    query: {
      stage: Array.isArray(q.stage) ? q.stage.join(",") : q.stage,
      q: q.q,
      recency: q.recency,
      with_next_action: q.with_next_action,
      sales_user_id: q.sales_user_id,
    },
    signal,
  });
}

export function getLeadStats(signal?: AbortSignal): Promise<LeadStats> {
  return apiData<LeadStats>("/api/v1/sales/leads/stats", { signal });
}

export function getLeadPeople(signal?: AbortSignal): Promise<LeadPerson[]> {
  return apiData<{ people: LeadPerson[] } | LeadPerson[]>(
    "/api/v1/sales/leads/people",
    { signal },
  ).then((r) => (Array.isArray(r) ? r : r.people));
}

export function reassignLeads(
  lead_ids: string[],
  to_user_id: string,
): Promise<{ reassigned_count: number; to_user_id: string; to_user_name: string }> {
  return apiData("/api/v1/sales/leads/reassign", {
    method: "POST",
    body: { lead_ids, to_user_id },
  });
}

export interface LeadActivitiesQuery {
  limit?: number;
  before?: string;
  kind?: ApiLeadActivityKind | ApiLeadActivityKind[];
}

export function listLeadActivities(
  leadId: string,
  q: LeadActivitiesQuery = {},
  signal?: AbortSignal,
): Promise<ActivityFeed> {
  return apiData<ActivityFeed>(`/api/v1/sales/leads/${leadId}/activities`, {
    query: {
      limit: q.limit,
      before: q.before,
      kind: Array.isArray(q.kind) ? q.kind.join(",") : q.kind,
    },
    signal,
  });
}

export interface CreateLeadActivityInput {
  kind: "call" | "meeting" | "note";
  body: string;
  duration_label?: string;
  tags?: string[];
}

export function createLeadActivity(
  leadId: string,
  input: CreateLeadActivityInput,
): Promise<ApiLeadTimelineEntry> {
  return apiData<ApiLeadTimelineEntry>(
    `/api/v1/sales/leads/${leadId}/activities`,
    {
      method: "POST",
      body: input,
    },
  );
}
