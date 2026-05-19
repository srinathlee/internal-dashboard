"use client";

import {
  getWinLossAnalytics,
  type WinLossPeriod,
} from "@/lib/api/sales-analytics";

import { useAsync } from "./use-async";

export function useWinLossAnalytics(period: WinLossPeriod = "monthly") {
  return useAsync((signal) => getWinLossAnalytics(period, signal), [period]);
}
