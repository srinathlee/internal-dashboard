/**
 * Hospitals endpoints — the read-only directory used by the Hospitals
 * screen. Spec: docs/BACKEND_API_SPEC.md §8.
 *
 * The shape returned by `GET /hospitals` already matches the local
 * `Hospital` type, so no adapter is needed. Listed under /api/v1/sales/
 * because hospitals are a sales-domain resource (they seed leads).
 */

import { ApiError, apiData, getApiBaseUrl, getAuthToken } from "./client";
import type { Hospital } from "../types";

export interface ListHospitalsQuery {
  /** Free-text search across name, address, city, and phone. */
  q?: string;
  /** Filter to a specific city. */
  city?: string;
  /** Server-side sort. The UI also re-sorts client-side after filtering. */
  sort?: "name" | "branchCount" | "userCount";
  /** Pagination — server defaults apply when omitted. */
  page?: number;
  limit?: number;
}

export interface ListHospitalsResponse {
  total?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
  hospitals: Hospital[];
}

/**
 * Some backends return `{ data: [...] }`, others return `{ hospitals: [...] }`,
 * and a few use the generic paginated envelope. Normalize to a single
 * `{ hospitals: Hospital[] }` shape so the hook layer doesn't have to care.
 */
function normalizeListResponse(raw: unknown): ListHospitalsResponse {
  if (Array.isArray(raw)) return { hospitals: raw as Hospital[] };
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.hospitals)) {
      return obj as unknown as ListHospitalsResponse;
    }
    if (Array.isArray(obj.data)) {
      return { ...obj, hospitals: obj.data as Hospital[] };
    }
    if (Array.isArray(obj.items)) {
      return { ...obj, hospitals: obj.items as Hospital[] };
    }
  }
  return { hospitals: [] };
}

export async function listHospitals(
  q: ListHospitalsQuery = {},
  signal?: AbortSignal,
): Promise<ListHospitalsResponse> {
  // /api/hospitals (no /v1/ prefix) — different from the /v1/sales family
  // because hospitals are shared between sales and onboarding teams, so the
  // backend exposes them at the top level.
  const raw = await apiData<unknown>("/api/hospitals", {
    query: {
      q: q.q,
      city: q.city,
      sort: q.sort,
      page: q.page,
      limit: q.limit,
    },
    signal,
  });
  return normalizeListResponse(raw);
}

export function getHospital(
  id: string,
  signal?: AbortSignal,
): Promise<Hospital> {
  return apiData<Hospital>(`/api/hospitals/${id}`, { signal });
}

/**
 * Body for POST /api/hospitals. Mirrors the 4-step Create-Hospital wizard
 * (Hospital info, Plan, Settings, Admin) — the backend should accept the
 * whole bundle in one call and create the hospital + admin user + plan
 * binding atomically. See docs/BACKEND_API_SPEC.md §8.
 */
export interface CreateHospitalInput {
  /* Step 1 — Hospital info */
  name: string;
  location?: string | null;
  address?: string | null;
  phone?: string | null;
  emergency_phone?: string | null;
  /** One or more of: dental, eye, skin, hair, plus any free-text "other" entries. */
  hospital_type: string[];
  created_by?: string | null;
  /**
   * Optional hospital image URL. Sent verbatim to POST /api/hospitals so the
   * backend stores it during creation; no separate PUT is needed. Matches
   * the backend field name `hospital_image_url`.
   */
  hospital_image_url?: string | null;

  /* Step 2 — Plan (optional; can be skipped) */
  plan: {
    plan_id: string;
    commitment: "monthly" | "quarterly" | "half_yearly" | "yearly";
  } | null;

  /* Step 3 — Settings */
  settings: {
    timezone: string;
    currency: string;
    preferred_ai_language: string;
    /** Either "all" (no restriction) or an explicit list of BCP-47 codes. */
    allowed_ai_languages: "all" | string[];
    /** Map of BCP-47 language code → localised hospital name. */
    localized_names?: Record<string, string>;
  };

  /* Step 4 — Hospital admin */
  admin: {
    name: string;
    email: string;
    password: string;
    phone: string;
  };
}

export interface CreateHospitalResponse {
  hospital: Hospital;
  admin: {
    id: string;
    name: string;
    email: string;
  };
}

export function createHospital(
  input: CreateHospitalInput,
): Promise<CreateHospitalResponse> {
  return apiData<CreateHospitalResponse>("/api/hospitals", {
    method: "POST",
    body: input,
  });
}

/**
 * Update (or replace) an existing hospital's image. Used from the future
 * Hospital settings surface — the Create wizard sends the URL inline via
 * POST /api/hospitals, so this isn't called during creation.
 *
 * Permission: super_admin only (per backend `requireSuperAdmin`).
 */
export interface UpdateHospitalImageResponse {
  message: string;
  hospital: {
    id: string;
    name: string;
    hospital_image_url: string | null;
  };
}

export function updateHospitalImage(
  id: string,
  hospitalImageUrl: string,
): Promise<UpdateHospitalImageResponse> {
  return apiData<UpdateHospitalImageResponse>(
    `/api/hospitals/${id}/image`,
    {
      method: "PUT",
      body: { hospital_image_url: hospitalImageUrl },
    },
  );
}

/** Clear a hospital's image. Super admin only. */
export function deleteHospitalImage(id: string): Promise<void> {
  return apiData<void>(`/api/hospitals/${id}/image`, {
    method: "DELETE",
  });
}

/**
 * Generic file upload. Used by the Create-Hospital wizard's hospital-image
 * field before the hospital exists. The returned `url` is then placed into
 * `CreateHospitalInput.hospital_image_url` so the eventual hospital row
 * points at the stored image.
 *
 * The standard `apiRequest` wrapper JSON-stringifies the body and sets
 * `Content-Type: application/json`, which is wrong for multipart uploads.
 * This function bypasses that path and constructs the request directly:
 * the browser fills in the multipart boundary on Content-Type when given a
 * `FormData` body.
 *
 * Endpoint: `POST /api/upload?folder=<folder>` with `multipart/form-data`
 * containing a single `file` field. Backend returns the public URL +
 * metadata. Max 20 MB; allowed types per the backend: jpg, png, gif, webp,
 * pdf, doc/docx, txt, csv, json. Image upload paths in the dashboard
 * narrow that to image types via the file picker's `accept` attribute.
 */
export interface UploadResult {
  url: string;
  fileName?: string;
  fileType?: string;
  size?: number;
}

export async function uploadFile(
  file: File,
  folder: string = "org-assets",
  signal?: AbortSignal,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const base = getApiBaseUrl().replace(/\/+$/, "");
  const url = `${base}/api/upload?folder=${encodeURIComponent(folder)}`;
  const token = getAuthToken();

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Intentionally NOT setting Content-Type — the browser inserts the
  // multipart boundary itself. Setting it manually breaks the upload.

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
      signal,
      credentials: "include",
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new ApiError(
        0,
        `Network error reaching ${url}. Check that the API is reachable and that CORS allows multipart uploads from this origin.`,
        null,
      );
    }
    throw err;
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const message =
      (parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : null) ?? `Upload failed (${res.status})`;
    throw new ApiError(res.status, message, parsed);
  }

  // Backend returns `{ success, url, file_url, file_name, file_type, size }`
  // at the top level. Accept the `{ data: { ... } }` envelope too in case
  // an intermediary wraps it.
  const root = (parsed && typeof parsed === "object" && "data" in parsed
    ? (parsed as { data: unknown }).data
    : parsed) as Record<string, unknown> | null;

  const urlField =
    root && typeof root === "object"
      ? (root.url ?? root.file_url)
      : undefined;

  if (typeof urlField !== "string") {
    throw new ApiError(
      500,
      "Upload succeeded but the response is missing the `url` field.",
      parsed,
    );
  }

  return {
    url: urlField,
    fileName:
      typeof root?.file_name === "string" ? root.file_name : undefined,
    fileType:
      typeof root?.file_type === "string" ? root.file_type : undefined,
    size: typeof root?.size === "number" ? root.size : undefined,
  };
}
