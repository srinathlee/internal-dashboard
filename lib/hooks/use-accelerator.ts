"use client";

import { useCallback } from "react";

import {
  addAcpMember,
  createAcpBatch,
  getAcpBatch,
  getAcpBatchStats,
  getAcpMember,
  getAcpMemberDailyLogs,
  getAcpOverview,
  getAcpWeekView,
  listAcpBatches,
  listAcpMembers,
  sendAcpMessage,
  setAcpMemberTag,
  setAcpReview,
  type AcpReview,
  type AcpTag,
  type AddMemberInput,
  type CreateBatchInput,
} from "@/lib/api/sales-accelerator";

import { useAsync } from "./use-async";

/** Program overview — top stats + top performer. */
export function useAcpOverview() {
  return useAsync((signal) => getAcpOverview(signal), []);
}

/** Batch cards on the overview page. */
export function useAcpBatches() {
  return useAsync((signal) => listAcpBatches(signal), []);
}

export function useAcpBatch(batchId: string | null) {
  return useAsync(
    (signal) => (batchId ? getAcpBatch(batchId, signal) : Promise.resolve(null)),
    [batchId],
  );
}

export function useAcpBatchStats(batchId: string | null) {
  return useAsync(
    (signal) =>
      batchId ? getAcpBatchStats(batchId, signal) : Promise.resolve(null),
    [batchId],
  );
}

export function useAcpMembers(batchId: string | null) {
  return useAsync(
    (signal) =>
      batchId ? listAcpMembers(batchId, signal) : Promise.resolve(null),
    [batchId],
  );
}

/** Week board — only fetches once a week is selected. */
export function useAcpWeekView(batchId: string | null, week: number | null) {
  return useAsync(
    (signal) =>
      batchId && week != null
        ? getAcpWeekView(batchId, week, signal)
        : Promise.resolve(null),
    [batchId, week],
  );
}

export function useAcpMember(memberId: string | null) {
  return useAsync(
    (signal) =>
      memberId ? getAcpMember(memberId, signal) : Promise.resolve(null),
    [memberId],
  );
}

export function useAcpMemberDailyLogs(memberId: string | null) {
  return useAsync(
    (signal) =>
      memberId ? getAcpMemberDailyLogs(memberId, signal) : Promise.resolve(null),
    [memberId],
  );
}

/** Mutations — stable callbacks for create / add / review / tag / message. */
export function useAcpMutations() {
  return {
    createBatch: useCallback(
      (input: CreateBatchInput) => createAcpBatch(input),
      [],
    ),
    addMember: useCallback(
      (batchId: string, input: AddMemberInput) => addAcpMember(batchId, input),
      [],
    ),
    setReview: useCallback(
      (logId: string, review: AcpReview) => setAcpReview(logId, review),
      [],
    ),
    setTag: useCallback(
      (memberId: string, tag: AcpTag) => setAcpMemberTag(memberId, tag),
      [],
    ),
    sendMessage: useCallback(
      (memberId: string, message: string) => sendAcpMessage(memberId, message),
      [],
    ),
  };
}
