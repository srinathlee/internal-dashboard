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

// ---------- List users for a hospital ----------

export interface HospitalUser {
  id: string;
  name?: string;
  username?: string | null;
  email?: string;
  phone?: string;
  role: string;
  hospital_id?: string;
  branch_id?: string | null;
  status?: string;
  profile_image_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_login_at?: string | null;
  joined_at?: string | null;

  // Doctor-specific (present when role = "DOCTOR")
  specialty?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  experience?: string | null;
  department?: string | null;
  op_fee?: number | null;
  followup_fee?: number | null;
  emergency_fee?: number | null;
  currency?: string | null;
  license_number?: string | null;
  bio?: string | null;
}

function normalizeUsersList(raw: unknown): HospitalUser[] {
  if (Array.isArray(raw)) return raw as HospitalUser[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.users)) return obj.users as HospitalUser[];
    if (Array.isArray(obj.data)) return obj.data as HospitalUser[];
    if (Array.isArray(obj.items)) return obj.items as HospitalUser[];
  }
  return [];
}

/**
 * List users belonging to a hospital. Used to compute role-aware counts on
 * the hospital detail screen. The current spec only documents POST under
 * /api/users, so this hits the conventional `?hospital_id=` query form.
 */
export async function listUsersForHospital(
  hospitalId: string,
  signal?: AbortSignal,
): Promise<HospitalUser[]> {
  const raw = await apiData<unknown>("/api/users", {
    query: { hospital_id: hospitalId },
    signal,
  });
  return normalizeUsersList(raw);
}

/** Fetch a single user. */
export async function getUser(
  id: string,
  signal?: AbortSignal,
): Promise<HospitalUser> {
  const raw = await apiData<HospitalUser | { user: HospitalUser }>(
    `/api/users/${id}`,
    { signal },
  );
  if (raw && typeof raw === "object" && "user" in raw) {
    return (raw as { user: HospitalUser }).user;
  }
  return raw as HospitalUser;
}

export interface UpdateUserInput {
  name?: string;
  username?: string | null;
  email?: string;
  phone?: string;
  role?: string;
  status?: "active" | "inactive" | "ACTIVE" | "INACTIVE";
  password?: string;
  profile_image_url?: string | null;
  branch_id?: string | null;

  // Doctor-specific
  specialty?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  department?: string | null;
  op_fee?: number | null;
  followup_fee?: number | null;
  emergency_fee?: number | null;
  currency?: string | null;
  license_number?: string | null;
  bio?: string | null;
}

function normalizeStatus(
  value: UpdateUserInput["status"],
): "ACTIVE" | "INACTIVE" | undefined {
  if (!value) return undefined;
  return value.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

/**
 * Full update for a user. The backend mirrors the hospital pattern
 * (`PUT /api/hospitals/:id`) rather than PATCH — `PATCH /api/users/:id`
 * 404s in the current deployment.
 */
export function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<HospitalUser> {
  const body = { ...input, status: normalizeStatus(input.status) };
  if (body.status === undefined) delete body.status;
  return apiData<HospitalUser>(`/api/users/${id}`, {
    method: "PUT",
    body,
  });
}

/** Permanently delete a user. */
export function deleteUser(id: string): Promise<void> {
  return apiData<void>(`/api/users/${id}`, { method: "DELETE" });
}

/**
 * Toggle user active/inactive. The backend has no dedicated
 * `/api/users/:id/status` route, so this piggybacks on the main update
 * endpoint with just the status field.
 */
export function setUserStatus(
  id: string,
  status: "active" | "inactive" | "ACTIVE" | "INACTIVE",
): Promise<HospitalUser> {
  return apiData<HospitalUser>(`/api/users/${id}`, {
    method: "PUT",
    body: { status: normalizeStatus(status) },
  });
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
}

export function createHospitalAdmin(
  input: CreateHospitalAdminInput,
): Promise<CreatedUser> {
  return apiData<CreatedUser>("/api/users/hospital-admin", {
    method: "POST",
    body: {
      role: "HOSPITAL_ADMIN",
      name: input.name,
      email: input.email,
      phone: input.phone,
      password: input.password,
      hospital_id: input.hospital_id,
    },
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
