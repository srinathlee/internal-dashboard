/**
 * Custom sales-pipeline stages API.
 *
 * The Kanban columns are a mix of built-in defaults (NEW_LEADS,
 * FIRST_CONTACT, …) and custom stages a SALES_ADMIN / SUPER_ADMIN can
 * create on top. Defaults are read-only and have no `id`; custom stages
 * are mutable and carry an `id` for CRUD operations.
 *
 * Endpoints (per the team's super-admin API surface):
 *   GET    /api/super-admin/sales-pipeline-stages
 *   POST   /api/super-admin/sales-pipeline-stages
 *   PUT    /api/super-admin/sales-pipeline-stages/:id
 *   DELETE /api/super-admin/sales-pipeline-stages/:id
 *   PUT    /api/super-admin/sales-pipeline-stages/reorder
 *   GET    /api/super-admin/sales-pipeline
 */

import { apiData } from "./client";
import type { PipelineResponse } from "./types";

export interface PipelineStage {
  /** Present only for custom stages; defaults have no id. */
  id?: string;
  /** Backend identifier — uppercase, underscored (e.g. "NEW_LEADS"). */
  name: string;
  /** Display label as provided by the backend. */
  label: string;
  /** Column position; lower = further left. */
  position: number;
  /** Hex color for the column header, e.g. "#F59E0B". */
  color?: string | null;
  /** True for the nine built-in defaults; false for admin-created stages. */
  is_default: boolean;
  is_active?: boolean;
  created_at?: string;
}

export interface CreatePipelineStageInput {
  /** Free-form display name. The backend uppercases & swaps spaces for "_". */
  name: string;
  color?: string;
  position?: number;
}

export interface UpdatePipelineStageInput {
  name?: string;
  color?: string;
  position?: number;
}

export async function listPipelineStages(
  signal?: AbortSignal,
): Promise<PipelineStage[]> {
  const raw = await apiData<unknown>("/api/super-admin/sales-pipeline-stages", {
    signal,
  });
  if (Array.isArray(raw)) return raw as PipelineStage[];
  if (raw && typeof raw === "object" && "data" in raw) {
    const inner = (raw as { data: unknown }).data;
    if (Array.isArray(inner)) return inner as PipelineStage[];
  }
  return [];
}

export function createPipelineStage(
  input: CreatePipelineStageInput,
): Promise<PipelineStage> {
  return apiData<PipelineStage>("/api/super-admin/sales-pipeline-stages", {
    method: "POST",
    body: input,
  });
}

export function updatePipelineStage(
  id: string,
  input: UpdatePipelineStageInput,
): Promise<PipelineStage> {
  return apiData<PipelineStage>(
    `/api/super-admin/sales-pipeline-stages/${id}`,
    {
      method: "PUT",
      body: input,
    },
  );
}

export function deletePipelineStage(id: string): Promise<void> {
  return apiData<void>(`/api/super-admin/sales-pipeline-stages/${id}`, {
    method: "DELETE",
  });
}

export function reorderPipelineStages(
  order: { id: string; position: number }[],
): Promise<void> {
  return apiData<void>("/api/super-admin/sales-pipeline-stages/reorder", {
    method: "PUT",
    body: { order },
  });
}

// ---------- Pipeline board (new super-admin endpoint) -----------------

export interface SalesPipelineQuery {
  q?: string;
  recency?: "active" | "stale";
  with_next_action?: boolean;
  sales_user_id?: string;
}

export function getSalesPipeline(
  q: SalesPipelineQuery = {},
  signal?: AbortSignal,
): Promise<PipelineResponse> {
  return apiData<PipelineResponse>("/api/super-admin/sales-pipeline", {
    query: {
      q: q.q,
      recency: q.recency,
      with_next_action: q.with_next_action,
      sales_user_id: q.sales_user_id,
    },
    signal,
  });
}
