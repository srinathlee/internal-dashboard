/**
 * Hospitals endpoints — the read-only directory used by the Hospitals
 * screen. Spec: docs/BACKEND_API_SPEC.md §8.
 *
 * The shape returned by `GET /hospitals` already matches the local
 * `Hospital` type, so no adapter is needed. Listed under /api/v1/sales/
 * because hospitals are a sales-domain resource (they seed leads).
 */

import { apiData } from "./client";
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
