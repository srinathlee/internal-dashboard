"use client";

import {
  getWinLossAnalytics,
  type WinLossPeriod,
} from "@/lib/api/sales-analytics";

import { useAsync } from "./use-async";

export function useWinLossAnalytics(
  period: WinLossPeriod = "monthly",
  userId?: string,
) {
  return useAsync(
    (signal) => getWinLossAnalytics(period, userId, signal),
    [period, userId],
  );
}
