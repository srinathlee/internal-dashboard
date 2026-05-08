/**
 * Sections 6-8 of the Sales API: scoring rule sets, targets, manual points.
 */

import { apiData } from "./client";
import type {
  ApiTarget,
  ManualPointEntry,
  PublishRuleInput,
  ScoringRuleSet,
} from "./types";

// ---------- Scoring rule sets ----------

export function getLiveScoringRuleSet(
  signal?: AbortSignal,
): Promise<ScoringRuleSet> {
  return apiData<ScoringRuleSet>(
    "/api/v1/sales/scoring-rule-sets/live",
    { signal },
  );
}

export function listScoringRuleSets(
  signal?: AbortSignal,
): Promise<ScoringRuleSet[]> {
  return apiData<ScoringRuleSet[]>("/api/v1/sales/scoring-rule-sets", {
    signal,
  });
}

export function publishScoringRuleSet(
  rules: PublishRuleInput[],
): Promise<ScoringRuleSet> {
  return apiData<ScoringRuleSet>("/api/v1/sales/scoring-rule-sets", {
    method: "POST",
    body: { rules },
  });
}

export function restoreScoringRuleSet(
  versionId: string | number,
): Promise<ScoringRuleSet> {
  return apiData<ScoringRuleSet>(
    `/api/v1/sales/scoring-rule-sets/${versionId}/restore`,
    { method: "POST" },
  );
}

// ---------- Targets ----------

export interface ListTargetsQuery {
  userId?: string;
  period?: "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";
}

export function listTargets(
  q: ListTargetsQuery = {},
  signal?: AbortSignal,
): Promise<ApiTarget[]> {
  return apiData<ApiTarget[]>("/api/v1/sales/targets", {
    query: q,
    signal,
  });
}

export interface SetTargetsInput {
  /** Map of spec key (e.g. `revenue`, `dealsClosed`) → numeric target. */
  values: Record<string, number>;
}

export function setTargets(
  userId: string,
  input: SetTargetsInput,
  period: "monthly" | "quarterly" | "half_yearly" | "yearly" = "monthly",
): Promise<{
  userId: string;
  period: string;
  values: Record<string, number>;
}> {
  return apiData(`/api/v1/sales/targets/${userId}`, {
    method: "PUT",
    body: input,
    query: { period },
  });
}

// ---------- Manual points ----------

export interface ListManualPointsQuery {
  userId?: string;
  from?: string;
  to?: string;
}

export function listManualPoints(
  q: ListManualPointsQuery = {},
  signal?: AbortSignal,
): Promise<ManualPointEntry[]> {
  return apiData<ManualPointEntry[]>("/api/v1/sales/manual-points", {
    query: q,
    signal,
  });
}

export function reverseManualPoint(id: string): Promise<{
  originalId: string;
  reversalId: string;
  points: number;
}> {
  return apiData(`/api/v1/sales/manual-points/${id}`, {
    method: "DELETE",
  });
}
