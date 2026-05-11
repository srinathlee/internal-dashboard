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

export function listBranchesForHospital(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<Branch[]> {
  return apiData<Branch[]>(`/api/branches/hospital/${hospitalId}`, {
    signal,
  });
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
