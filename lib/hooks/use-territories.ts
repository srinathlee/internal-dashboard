"use client";

import { useCallback } from "react";

import {
  assignTerritory,
  createTerritory,
  deleteTerritory,
  getTerritory,
  listTerritories,
  updateTerritory,
  type AssignTerritoryInput,
  type CreateTerritoryInput,
  type UpdateTerritoryInput,
} from "@/lib/api/sales-territories";

import { useAsync } from "./use-async";

export function useTerritories() {
  return useAsync((signal) => listTerritories(signal), []);
}

export function useTerritory(id: string | null) {
  return useAsync(
    (signal) => (id ? getTerritory(id, signal) : Promise.resolve(null)),
    [id],
  );
}

export function useTerritoryMutations() {
  return {
    create: useCallback((input: CreateTerritoryInput) => createTerritory(input), []),
    update: useCallback(
      (id: string, patch: UpdateTerritoryInput) => updateTerritory(id, patch),
      [],
    ),
    assign: useCallback(
      (id: string, input: AssignTerritoryInput) => assignTerritory(id, input),
      [],
    ),
    remove: useCallback((id: string) => deleteTerritory(id), []),
  };
}
