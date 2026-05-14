/**
 * Sales brochure delivery — WhatsApp send via MessagingHub.
 * Spec: docs/send-brochure-api.md (FE) and the backend's brochure spec.
 */

import { apiData, apiRequest } from "./client";

export type BrochureDeliveryStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

// ---------- POST /api/v1/sales/brochure/send ----------

export interface SendBrochureInput {
  /**
   * Free-form phone number; backend normalizes to E.164. Accepts
   * `9876543210`, `+91 98765-43210`, `919876543210`, etc.
   */
  phone: string;
  /** Country code prefix. Backend default is `"+91"` (India). */
  country_code?: string;
  /** Lead UUID — when provided, the send is logged on the lead timeline. */
  lead_id?: string;
  /** Internal-only note, max 280 chars. Not shown to the recipient. */
  note?: string;
}

export interface SendBrochureResponse {
  message_id: string;
  /** Normalized E.164 phone (e.g. `+919876543210`). */
  to: string;
  delivery_status: BrochureDeliveryStatus;
  /** UTC ISO 8601 timestamp. */
  sent_at: string;
  sent_by: { id: string; name: string };
}

export function sendBrochure(
  input: SendBrochureInput,
): Promise<SendBrochureResponse> {
  return apiData<SendBrochureResponse>("/api/v1/sales/brochure/send", {
    method: "POST",
    body: input,
  });
}

// ---------- GET /api/v1/sales/brochure/sends ----------

export interface BrochureSendRow {
  id: string;
  message_id: string;
  to: string;
  lead_id: string | null;
  note: string | null;
  delivery_status: BrochureDeliveryStatus;
  provider: string;
  sent_at: string;
  delivered_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  sender: { id: string; name: string };
}

export interface ListBrochureSendsQuery {
  lead_id?: string;
  /** Max 100. Default 20. */
  limit?: number;
  offset?: number;
}

export interface ListBrochureSendsResponse {
  total: number;
  data: BrochureSendRow[];
}

/**
 * The list endpoint returns `{ success, total, data: [...] }` — a non-standard
 * envelope. We use `apiRequest` to keep both `total` and `data` instead of
 * letting `apiData` strip everything but `data`.
 */
export async function listBrochureSends(
  q: ListBrochureSendsQuery = {},
  signal?: AbortSignal,
): Promise<ListBrochureSendsResponse> {
  const body = await apiRequest<{
    success?: boolean;
    total?: number;
    data?: BrochureSendRow[];
  }>("/api/v1/sales/brochure/sends", { query: q, signal });
  return { total: body.total ?? 0, data: body.data ?? [] };
}
