"use client";

import { useCallback } from "react";

import {
  getLiveLocations,
  getLocationTeamStatus,
  getLocationTrack,
  getLocationTrackRange,
  getUserLocationHistory,
  listLocationSessions,
  postLocationUpdate,
  startLocationSession,
  stopLocationSession,
  type LocationUpdateInput,
} from "@/lib/api/sales-locations";

import { useAsync } from "./use-async";

export function useLocationTeamStatus(groupId?: string) {
  return useAsync(
    (signal) => getLocationTeamStatus({ group_id: groupId }, signal),
    [groupId ?? ""],
  );
}

export function useLiveLocations() {
  return useAsync((signal) => getLiveLocations(signal), []);
}

export function useLocationSessions() {
  return useAsync((signal) => listLocationSessions(signal), []);
}

export function useUserLocationHistory(
  userId: string | null,
  q: { from?: string; to?: string; limit?: number } = {},
) {
  return useAsync(
    (signal) =>
      userId
        ? getUserLocationHistory(userId, q, signal)
        : Promise.resolve(null),
    [userId, q.from ?? "", q.to ?? "", q.limit ?? 0],
  );
}

export function useLocationTrack(
  q: { user_id?: string; date?: string } = {},
) {
  return useAsync(
    (signal) => getLocationTrack(q, signal),
    [q.user_id ?? "", q.date ?? ""],
  );
}

export function useLocationTrackRange(
  q: { from: string; to: string; user_id?: string } | null,
) {
  return useAsync(
    (signal) => (q ? getLocationTrackRange(q, signal) : Promise.resolve(null)),
    [q?.from ?? "", q?.to ?? "", q?.user_id ?? ""],
  );
}

export function useLocationMutations() {
  return {
    startSession: useCallback(() => startLocationSession(), []),
    stopSession: useCallback(() => stopLocationSession(), []),
    update: useCallback(
      (input: LocationUpdateInput) => postLocationUpdate(input),
      [],
    ),
  };
}
