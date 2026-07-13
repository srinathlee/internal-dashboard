"use client";

import { useCallback } from "react";

import {
  addAcpMember,
  createAcpBatch,
  deleteAcpBatch,
  deleteAcpMember,
  getAcpBatch,
  getAcpBatchStats,
  getAcpMember,
  getAcpMemberDailyLogs,
  getAcpMemberMessages,
  getAcpMemberSprints,
  getAcpOverview,
  getAcpProgramConfig,
  getAcpWeekView,
  getMyAcpDailyLogs,
  getMyAcpMessages,
  listAcpBatches,
  listAcpMembers,
  sendAcpMessage,
  setAcpMemberNote,
  setAcpMemberPassword,
  setAcpMemberTag,
  setAcpReview,
  updateAcpMember,
  uploadMyAcpDayAudio,
  type AcpReview,
  type AcpTag,
  type AddMemberInput,
  type CreateBatchInput,
  type UpdateAcpMemberInput,
} from "@/lib/api/sales-accelerator";
import { listSubadmins } from "@/lib/api/sales-subadmins";

import { useAsync } from "./use-async";

/** Program overview — top stats + top performer. */
export function useAcpOverview() {
  return useAsync((signal) => getAcpOverview(signal), []);
}

/**
 * Program-level config — week titles, default targets, duration, day-type
 * schedule. Used by the add-member + create-batch modals so the "₹10K / ₹1.1L
 * / 2 months" copy isn't hardcoded. Callers should still keep a sensible
 * fallback in case the endpoint is unavailable on an older backend.
 */
export function useAcpProgramConfig() {
  return useAsync((signal) => getAcpProgramConfig(signal), []);
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

/**
 * Lower-cased emails of every Accelerator trainee who has **not** graduated to
 * full-time (`tag !== "converted"`) — i.e. in-program *and* fired reps.
 *
 * Used as a client-side exclusion set to hide those trainees from the normal
 * sales dashboard, which can't otherwise tell them apart from staff (an ACP
 * member is backed by a real sales `users` login). This is an interim stopgap
 * for the one surface that exposes per-rep emails — the Sales team members
 * table; the durable fix is server-side (see
 * docs/backend-acp-hide-from-sales-lists.md), after which this set will simply
 * stop matching anything.
 *
 * `data` is the `Set<string>` once loaded, or `null` while loading / on error.
 * Callers must treat `null` as "no exclusions yet" so an ACP fetch failure
 * never accidentally hides a normal rep. Admin-only data — callers are already
 * admin-gated.
 */
export function useAcpEnrolledEmails() {
  return useAsync<Set<string>>(async (signal) => {
    const emails = new Set<string>();
    const batches = await listAcpBatches(signal);
    const lists = await Promise.all(
      batches.map((b) => listAcpMembers(b.id, signal)),
    );
    for (const members of lists) {
      for (const m of members) {
        if (m.tag !== "converted" && m.email) {
          emails.add(m.email.trim().toLowerCase());
        }
      }
    }
    return emails;
  }, []);
}

/**
 * Excluded sales `user_id`s for the main dashboard / team-overview lists.
 *
 * The overview rows (leaderboard, conversion-by-rep, reps-at-risk,
 * stale-by-rep, roster) are keyed by `user_id`, not email — so the
 * email-based {@link useAcpEnrolledEmails} can't filter them directly. This
 * joins the ACP "still in program" emails against the subadmin directory
 * (which carries both `id` and `email`) to resolve the matching `user_id`s to
 * hide. Interim client-side filter — the durable fix is the server-side
 * `WHERE NOT EXISTS` predicate in docs/backend-acp-hide-from-sales-lists.md,
 * after which this set simply stops matching anything.
 *
 * `data` is the `Set<string>` of user_ids once loaded, or `null` while loading
 * / on error. Callers must treat `null` as "no exclusions yet" so an ACP (or
 * subadmin) fetch failure never accidentally hides a normal rep. Admin-only.
 */
export function useAcpExcludedUserIds() {
  return useAsync<Set<string>>(async (signal) => {
    const [batches, subs] = await Promise.all([
      listAcpBatches(signal),
      listSubadmins({ limit: 500 }, signal),
    ]);
    const lists = await Promise.all(
      batches.map((b) => listAcpMembers(b.id, signal)),
    );
    const acpEmails = new Set<string>();
    for (const members of lists) {
      for (const m of members) {
        if (m.tag !== "converted" && m.email) {
          acpEmails.add(m.email.trim().toLowerCase());
        }
      }
    }
    const ids = new Set<string>();
    if (acpEmails.size === 0) return ids;
    for (const u of subs.sales_subadmins) {
      if (u.email && acpEmails.has(u.email.trim().toLowerCase())) {
        ids.add(u.id);
      }
    }
    return ids;
  }, []);
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

export function useAcpMemberSprints(memberId: string | null) {
  return useAsync(
    (signal) =>
      memberId ? getAcpMemberSprints(memberId, signal) : Promise.resolve(null),
    [memberId],
  );
}

/** A member's admin-message thread, newest first (admin read route). */
export function useAcpMemberMessages(memberId: string | null) {
  return useAsync(
    (signal) =>
      memberId ? getAcpMemberMessages(memberId, signal) : Promise.resolve(null),
    [memberId],
  );
}

/**
 * The logged-in rep's own Accelerator coaching inbox, newest first.
 * A 404 surfaces on `error` and signals "not an ACP member" (hide the inbox).
 */
export function useMyAcpMessages() {
  return useAsync((signal) => getMyAcpMessages(signal), []);
}

/**
 * The logged-in rep's own Accelerator daily logs. A 404 surfaces on `error` and
 * means "not an Accelerator member" — the pitch-upload control hides in that
 * case (mirrors {@link useMyAcpMessages}).
 */
export function useMyAcpDailyLogs() {
  return useAsync((signal) => getMyAcpDailyLogs(signal), []);
}

/** Rep-self mutations — the rep acting on their own Accelerator record. */
export function useMyAcpMutations() {
  return {
    uploadDayAudio: useCallback(
      (date: string, file: File) => uploadMyAcpDayAudio(date, file),
      [],
    ),
  };
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
    deleteBatch: useCallback(
      (batchId: string) => deleteAcpBatch(batchId),
      [],
    ),
    deleteMember: useCallback(
      (memberId: string) => deleteAcpMember(memberId),
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
    setNote: useCallback(
      (memberId: string, note: string) => setAcpMemberNote(memberId, note),
      [],
    ),
    updateMember: useCallback(
      (memberId: string, input: UpdateAcpMemberInput) =>
        updateAcpMember(memberId, input),
      [],
    ),
    setPassword: useCallback(
      (memberId: string, password: string) =>
        setAcpMemberPassword(memberId, password),
      [],
    ),
    sendMessage: useCallback(
      (memberId: string, message: string) => sendAcpMessage(memberId, message),
      [],
    ),
  };
}
