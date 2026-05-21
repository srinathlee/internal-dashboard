/**
 * Section 5 of the Sales API: Field pins (self-service location).
 *
 * The backend's pin shape changed over time (§1 of the FE guide). Older
 * deployments return `latitude`/`longitude`/`captured_at`; newer ones return
 * `lat`/`lng`/`recorded_at` plus `name`/`note`/`visible_on_map`. We normalize
 * either shape into the canonical `FieldPin` the UI is built around, so the
 * map keeps working regardless of which the live server speaks.
 */

import { apiData, apiRequest } from "./client";
import type { FieldPin } from "./types";

/** Loose wire shape — fields are optional because they vary by backend version. */
interface RawFieldPin {
  id?: string;
  sales_user_id?: string;
  user_id?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  city?: string | null;
  source?: "client" | "ip";
  captured_at?: string;
  recorded_at?: string;
  created_at?: string;
  name?: string | null;
  note?: string | null;
  visible_on_map?: boolean;
}

/** Map a wire row (either backend shape) into the canonical FieldPin. */
function normalizeFieldPin(raw: RawFieldPin): FieldPin {
  const captured =
    raw.captured_at ?? raw.recorded_at ?? raw.created_at ?? "";
  return {
    id: raw.id ?? "",
    sales_user_id: raw.sales_user_id ?? raw.user_id ?? "",
    latitude: raw.latitude ?? raw.lat ?? 0,
    longitude: raw.longitude ?? raw.lng ?? 0,
    city: raw.city ?? null,
    source: raw.source,
    captured_at: captured,
    recorded_at: raw.recorded_at,
    name: raw.name,
    note: raw.note,
    visible_on_map: raw.visible_on_map,
  };
}

export interface CreateFieldPinInput {
  lat: number;
  lng: number;
  /** Optional label (max 120 chars) — ignored by older backends (§1.1). */
  name?: string;
  /** Optional note — ignored by older backends (§1.1). */
  note?: string;
  /** Defaults to true server-side when omitted. */
  visible_on_map?: boolean;
}

export function createFieldPin(
  input: CreateFieldPinInput,
): Promise<FieldPin> {
  return apiData<RawFieldPin>("/api/v1/sales/field-pins", {
    method: "POST",
    body: input,
  }).then(normalizeFieldPin);
}

export interface ListFieldPinsQuery {
  userId?: string;
  /** YYYY-MM-DD — single-day filter (§1.2). */
  date?: string;
  from?: string;
  to?: string;
  /** Admin-only: include pins hidden from the map (§1.2). */
  includeHidden?: boolean;
}

export function listFieldPins(
  q: ListFieldPinsQuery = {},
  signal?: AbortSignal,
): Promise<FieldPin[]> {
  return apiData<RawFieldPin[]>("/api/v1/sales/field-pins", {
    query: {
      // The backend expects snake_case query params (§1.2). We previously sent
      // `userId`, which the server ignored — admin drilldown silently returned
      // every rep's pins. Send `user_id`.
      user_id: q.userId,
      date: q.date,
      from: q.from,
      to: q.to,
      include_hidden: q.includeHidden ? "true" : undefined,
    },
    signal,
  }).then((rows) => (rows ?? []).map(normalizeFieldPin));
}

export interface UpdateFieldPinInput {
  name?: string;
  note?: string;
  visible_on_map?: boolean;
}

/** PATCH /field-pins/:pinId — rename, re-note, or hide a pin (§1.3). */
export function updateFieldPin(
  pinId: string,
  body: UpdateFieldPinInput,
): Promise<FieldPin> {
  return apiData<RawFieldPin>(`/api/v1/sales/field-pins/${pinId}`, {
    method: "PATCH",
    body,
  }).then(normalizeFieldPin);
}

/** DELETE /field-pins/:pinId — remove a single pin; 204 on success (§1.4). */
export function deleteFieldPin(pinId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/sales/field-pins/${pinId}`, {
    method: "DELETE",
  });
}

export function clearFieldPins(
  userId?: string,
): Promise<{ cleared: number; userId: string }> {
  return apiData("/api/v1/sales/field-pins", {
    method: "DELETE",
    body: userId ? { userId } : undefined,
  });
}
