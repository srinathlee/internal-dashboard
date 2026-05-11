/**
 * Hospital / branch / staff user creation.
 * Spec: docs/BACKEND_API_SPEC_HOSPITAL_CREATION.md §11-13.
 */

import { apiData } from "./client";

export interface CreatedUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  hospital_id: string;
  branch_id?: string | null;
  status?: "active" | "inactive";
}

// ---------- Hospital admin ----------

export interface CreateHospitalAdminInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  hospital_id: string;
  /** Always `"HOSPITAL_ADMIN"` for this endpoint; included for clarity. */
  role?: "HOSPITAL_ADMIN";
  /** Optional initial status — defaults to `active` server-side. */
  status?: "active" | "inactive";
}

export function createHospitalAdmin(
  input: CreateHospitalAdminInput,
): Promise<CreatedUser> {
  return apiData<CreatedUser>("/api/users/hospital-admin", {
    method: "POST",
    body: { role: "HOSPITAL_ADMIN", ...input },
  });
}

// ---------- Branch admin ----------

export interface CreateBranchAdminInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  hospital_id: string;
  branch_id: string;
  role?: "BRANCH_ADMIN";
  status?: "active" | "inactive";
}

export function createBranchAdmin(
  input: CreateBranchAdminInput,
): Promise<CreatedUser> {
  return apiData<CreatedUser>("/api/users/branch-admin", {
    method: "POST",
    body: { role: "BRANCH_ADMIN", ...input },
  });
}

// ---------- Staff (doctor / receptionist) ----------

export type StaffRole = "DOCTOR" | "RECEPTIONIST";

export interface CreateStaffInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  hospital_id: string;
  branch_id: string;
  role: StaffRole;
  status?: "active" | "inactive";

  // Doctor-only (ignored when role = "RECEPTIONIST")
  specialty?: string;
  department?: string;
  op_fee?: number;
  currency?: string;
  qualification?: string;
  experience_years?: number;
  license_number?: string;
  bio?: string;
  profile_image_url?: string;
  preferred_language?: string;
  /** Treatment slugs the doctor will perform. */
  treatments?: string[];
}

export function createStaffUser(input: CreateStaffInput): Promise<CreatedUser> {
  return apiData<CreatedUser>("/api/users/staff", {
    method: "POST",
    body: input,
  });
}
