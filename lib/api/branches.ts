/**
 * Hospital branches API (subset — only the read + create used by the
 * hospital detail screen). See docs/BACKEND_API_SPEC_HOSPITAL_CREATION.md §14.
 */

import { apiData } from "./client";

export interface Branch {
  id: string;
  hospital_id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  timezone?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}

function normalizeBranchesList(raw: unknown): Branch[] {
  if (Array.isArray(raw)) return raw as Branch[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.branches)) return obj.branches as Branch[];
    if (Array.isArray(obj.data)) return obj.data as Branch[];
    if (Array.isArray(obj.items)) return obj.items as Branch[];
  }
  return [];
}

/**
 * List branches for a hospital — spec §14.
 * `GET /api/branches/hospital/:hospital_id` returns the full branch objects;
 * no per-branch detail call is needed.
 */
export async function listBranchesForHospital(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<Branch[]> {
  const raw = await apiData<unknown>(`/api/branches/hospital/${hospitalId}`, {
    signal,
  });
  return normalizeBranchesList(raw);
}

export interface CreateBranchInput {
  hospital_id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
}

export function createBranch(input: CreateBranchInput): Promise<Branch> {
  return apiData<Branch>("/api/branches", {
    method: "POST",
    body: input,
  });
}

/**
 * Body for `PUT /api/branches/:id` (spec §14). Only provided fields are
 * updated server-side.
 */
export interface UpdateBranchInput {
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  timezone?: string | null;
  status?: "ACTIVE" | "INACTIVE";
}

export function updateBranch(
  id: string,
  input: UpdateBranchInput,
): Promise<Branch> {
  return apiData<Branch>(`/api/branches/${id}`, {
    method: "PUT",
    body: input,
  });
}

/** Spec §14 — `DELETE /api/branches/:id`. */
export function deleteBranch(id: string): Promise<void> {
  return apiData<void>(`/api/branches/${id}`, { method: "DELETE" });
}

export interface BranchOperatingHours {
  monday?: { open?: string; close?: string; closed?: boolean };
  tuesday?: { open?: string; close?: string; closed?: boolean };
  wednesday?: { open?: string; close?: string; closed?: boolean };
  thursday?: { open?: string; close?: string; closed?: boolean };
  friday?: { open?: string; close?: string; closed?: boolean };
  saturday?: { open?: string; close?: string; closed?: boolean };
  sunday?: { open?: string; close?: string; closed?: boolean };
}

/** Spec §14 — `PUT /api/branches/:id/operating-hours` (HOSPITAL_ADMIN). */
export function updateBranchOperatingHours(
  id: string,
  operatingHours: BranchOperatingHours,
): Promise<Branch> {
  return apiData<Branch>(`/api/branches/${id}/operating-hours`, {
    method: "PUT",
    body: { operating_hours: operatingHours },
  });
}
