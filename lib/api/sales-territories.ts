/**
 * Sales territories — geographic polygons assigned to reps or groups.
 *
 * Base: /api/v1/sales/territories.
 * SALES_ADMIN scoped to own team; SUPER_ADMIN sees all.
 */

import { apiData, apiRequest } from "./client";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Territory {
  id: string;
  name: string;
  color: string;
  polygon: LatLng[];
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  group_id: string | null;
  group_name: string | null;
}

// ---------- List ----------------------------------------------------------

export function listTerritories(signal?: AbortSignal): Promise<Territory[]> {
  return apiData<{ data: Territory[] } | Territory[]>(
    "/api/v1/sales/territories",
    { signal },
  ).then((res) =>
    Array.isArray(res) ? res : (res as { data: Territory[] }).data ?? [],
  );
}

export function getTerritory(
  id: string,
  signal?: AbortSignal,
): Promise<Territory> {
  return apiData<Territory>(`/api/v1/sales/territories/${id}`, { signal });
}

// ---------- Create / update ----------------------------------------------

export interface CreateTerritoryInput {
  name: string;
  /** Hex color, default `#276EF1`. */
  color?: string;
  /** Polygon ring; must contain at least 3 points and be self-non-intersecting. */
  polygon: LatLng[];
  assigned_user_id?: string | null;
  group_id?: string | null;
}

export function createTerritory(
  input: CreateTerritoryInput,
): Promise<Territory> {
  return apiData<Territory>("/api/v1/sales/territories", {
    method: "POST",
    body: input,
  });
}

export type UpdateTerritoryInput = Partial<CreateTerritoryInput>;

export function updateTerritory(
  id: string,
  patch: UpdateTerritoryInput,
): Promise<Territory> {
  return apiData<Territory>(`/api/v1/sales/territories/${id}`, {
    method: "PATCH",
    body: patch,
  });
}

// ---------- Assign --------------------------------------------------------

export interface AssignTerritoryInput {
  /** Pass `null` to unassign. At least one of rep_id / group_id required. */
  rep_id?: string | null;
  group_id?: string | null;
}

export function assignTerritory(
  id: string,
  input: AssignTerritoryInput,
): Promise<Territory> {
  return apiData<Territory>(`/api/v1/sales/territories/${id}/assign`, {
    method: "PATCH",
    body: input,
  });
}

// ---------- Delete --------------------------------------------------------

export function deleteTerritory(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/sales/territories/${id}`, {
    method: "DELETE",
  });
}
