/**
 * Section 9 of the Sales API: Audit log.
 */

import { apiRequest } from "./client";
import type { AuditLogResponse } from "./types";

export interface AuditLogQuery {
  actorId?: string;
  action?: "CREATE" | "UPDATE" | "DELETE" | string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: number;
}

export function getAuditLog(
  q: AuditLogQuery = {},
  signal?: AbortSignal,
): Promise<AuditLogResponse> {
  return apiRequest<AuditLogResponse>("/api/v1/sales/audit-log", {
    query: q,
    signal,
  });
}
