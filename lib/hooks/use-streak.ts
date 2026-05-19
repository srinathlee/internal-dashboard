"use client";

import { getMyStreak } from "@/lib/api/sales-users";

import { useAsync } from "./use-async";

/** GET /users/me/streak — consecutive activity-day count for the badge. */
export function useMyStreak() {
  return useAsync((signal) => getMyStreak(signal), []);
}
