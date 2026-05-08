"use client";

import { getAuditLog, type AuditLogQuery } from "@/lib/api/sales-audit";
import { useAsync } from "./use-async";

export function useAuditLog(q: AuditLogQuery = {}) {
  return useAsync(
    (signal) => getAuditLog(q, signal),
    [q.actorId, q.action, q.from, q.to, q.limit, q.cursor],
  );
}
