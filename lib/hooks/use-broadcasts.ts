"use client";

import { listTeamBroadcasts } from "@/lib/api/sales-overview";

import { useAsync } from "./use-async";

/**
 * Recent team broadcasts feed for the Broadcast screen. Degrades to an empty
 * list when the backend list endpoint isn't live yet (see listTeamBroadcasts).
 */
export function useTeamBroadcasts(q: { limit?: number } = {}) {
  return useAsync((signal) => listTeamBroadcasts(q, signal), [q.limit]);
}
