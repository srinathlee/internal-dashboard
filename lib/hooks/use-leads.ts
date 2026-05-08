"use client";

import { useCallback } from "react";

import {
  createLead,
  createLeadActivity,
  deleteLead,
  getLead,
  getLeadPeople,
  getLeadStats,
  getLeadsPipeline,
  listLeadActivities,
  listLeads,
  markLeadLost,
  reassignLeads,
  restoreLostLead,
  setLeadNextAction,
  updateLead,
  updateLeadStage,
  type CreateLeadActivityInput,
  type CreateLeadInput,
  type LeadActivitiesQuery,
  type ListLeadsQuery,
  type PipelineQuery,
} from "@/lib/api/sales-leads";
import type {
  ApiLead,
  ApiLeadStage,
  ApiLostReason,
} from "@/lib/api/types";

import { useAsync } from "./use-async";

export function useLeads(q: ListLeadsQuery = {}) {
  return useAsync(
    (signal) => listLeads(q, signal),
    [
      q.q,
      q.stage,
      q.city,
      q.lead_source,
      Array.isArray(q.sales_user_id)
        ? q.sales_user_id.join(",")
        : q.sales_user_id,
      q.page,
      q.limit,
    ],
  );
}

export function useLead(id: string | null) {
  return useAsync(
    (signal) => (id ? getLead(id, signal) : Promise.resolve(null)),
    [id],
  );
}

export function useLeadActivities(
  leadId: string | null,
  q: LeadActivitiesQuery = {},
) {
  return useAsync(
    (signal) =>
      leadId
        ? listLeadActivities(leadId, q, signal)
        : Promise.resolve(null),
    [leadId, q.limit, q.before, JSON.stringify(q.kind ?? null)],
  );
}

export function usePipeline(q: PipelineQuery = {}) {
  return useAsync(
    (signal) => getLeadsPipeline(q, signal),
    [
      Array.isArray(q.stage) ? q.stage.join(",") : q.stage,
      q.q,
      q.recency,
      q.with_next_action,
      q.sales_user_id,
    ],
  );
}

export function useLeadStats() {
  return useAsync((signal) => getLeadStats(signal), []);
}

export function useLeadPeople() {
  return useAsync((signal) => getLeadPeople(signal), []);
}

/** Mutation helpers — co-located so screens import a single hook. */
export function useLeadMutations() {
  return {
    create: useCallback((input: CreateLeadInput) => createLead(input), []),
    update: useCallback(
      (id: string, patch: Partial<CreateLeadInput>) => updateLead(id, patch),
      [],
    ),
    setStage: useCallback(
      (id: string, stage: ApiLeadStage) => updateLeadStage(id, stage),
      [],
    ),
    markLost: useCallback(
      (
        id: string,
        input: { reason: ApiLostReason; notes?: string },
      ) => markLeadLost(id, input),
      [],
    ),
    restore: useCallback((id: string) => restoreLostLead(id), []),
    setNextAction: useCallback(
      (id: string, input: { title: string | null; due: string | null }) =>
        setLeadNextAction(id, input),
      [],
    ),
    delete: useCallback((id: string) => deleteLead(id), []),
    reassign: useCallback(
      (lead_ids: string[], to_user_id: string) =>
        reassignLeads(lead_ids, to_user_id),
      [],
    ),
    addActivity: useCallback(
      (leadId: string, input: CreateLeadActivityInput) =>
        createLeadActivity(leadId, input),
      [],
    ),
  };
}

export type { ApiLead };
