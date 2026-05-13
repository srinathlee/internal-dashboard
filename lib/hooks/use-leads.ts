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
import { getSalesPipeline } from "@/lib/api/sales-pipeline-stages";
import { ApiError } from "@/lib/api/client";
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
    async (signal) => {
      // Try the new super-admin endpoint first — it returns custom stages
      // alongside the defaults. If that route isn't deployed yet or fails
      // outright, fall back to the legacy sales endpoint so older envs
      // keep working.
      const shouldFallback = (err: unknown) =>
        err instanceof ApiError &&
        // 4xx perms/route-not-found AND 5xx server errors both warrant a retry
        // through the legacy endpoint. Without 500, a backend bug on the new
        // route would error the whole screen even when the legacy route works.
        (err.status === 401 ||
          err.status === 403 ||
          err.status === 404 ||
          err.status >= 500);

      try {
        return await getSalesPipeline(
          {
            q: q.q,
            recency: q.recency,
            with_next_action: q.with_next_action,
            sales_user_id: q.sales_user_id,
          },
          signal,
        );
      } catch (primaryErr) {
        if (!shouldFallback(primaryErr)) throw primaryErr;
        try {
          return await getLeadsPipeline(q, signal);
        } catch (legacyErr) {
          // Both endpoints are down. Don't blow up the page — return an
          // empty pipeline so the board still renders (admins can keep
          // managing stages, and the per-route error stays a backend
          // problem rather than a wall in front of every viewer).
          if (signal.aborted) throw legacyErr;
          // eslint-disable-next-line no-console
          console.warn(
            "[usePipeline] both pipeline endpoints failed, rendering empty board",
            { primaryErr, legacyErr },
          );
          return {
            total: 0,
            stages: [],
            metrics: {
              open_pipeline_value: 0,
              weighted_forecast_value: 0,
              closed_won_value: 0,
              active_lead_count: 0,
              won_count: 0,
              lost_count: 0,
            },
          };
        }
      }
    },
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
