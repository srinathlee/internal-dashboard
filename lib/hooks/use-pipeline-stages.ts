"use client";

import { useCallback } from "react";

import {
  createPipelineStage,
  deletePipelineStage,
  listPipelineStages,
  reorderPipelineStages,
  updatePipelineStage,
  type CreatePipelineStageInput,
  type PipelineStage,
  type UpdatePipelineStageInput,
} from "@/lib/api/sales-pipeline-stages";
import { useAsync } from "./use-async";

/**
 * Default fallback list — used when the backend hasn't deployed the
 * stages endpoint yet (older envs / preview branches). Keeps the Kanban
 * usable instead of rendering nothing.
 */
const DEFAULT_STAGES: PipelineStage[] = [
  { name: "NEW_LEADS", label: "New Leads", position: 1, color: "#6B7280", is_default: true },
  { name: "FIRST_CONTACT", label: "First Contact", position: 2, color: "#3B82F6", is_default: true },
  { name: "DOCTOR_MEETING", label: "Doctor Meeting", position: 3, color: "#8B5CF6", is_default: true },
  { name: "PITCH_DELIVERED", label: "Pitch Delivered", position: 4, color: "#F59E0B", is_default: true },
  { name: "HOT_LEADS", label: "Hot Leads", position: 5, color: "#EF4444", is_default: true },
  { name: "SPRINT_STARTED", label: "Sprint Started", position: 6, color: "#10B981", is_default: true },
  { name: "SPRINT_REVIEW", label: "Sprint Review", position: 7, color: "#06B6D4", is_default: true },
  { name: "SUBSCRIPTION_CLOSED", label: "Subscription Closed", position: 8, color: "#22C55E", is_default: true },
  { name: "LOST", label: "Lost", position: 9, color: "#DC2626", is_default: true },
];

export function usePipelineStages() {
  return useAsync(
    (signal) =>
      listPipelineStages(signal).catch(() => DEFAULT_STAGES),
    [],
  );
}

export function usePipelineStageMutations() {
  return {
    create: useCallback(
      (input: CreatePipelineStageInput) => createPipelineStage(input),
      [],
    ),
    update: useCallback(
      (id: string, input: UpdatePipelineStageInput) =>
        updatePipelineStage(id, input),
      [],
    ),
    remove: useCallback((id: string) => deletePipelineStage(id), []),
    reorder: useCallback(
      (order: { id: string; position: number }[]) =>
        reorderPipelineStages(order),
      [],
    ),
  };
}

export { DEFAULT_STAGES };
