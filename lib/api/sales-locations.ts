/**
 * Sales live location tracking — REST layer.
 *
 * Base: /api/v1/sales/location.
 * REST is the canonical surface; the WebSocket `/location` namespace is a
 * performance optimisation. The companion file `lib/realtime/location-socket.ts`
 * provides a thin Socket.IO wrapper that lazily imports `socket.io-client`
 * if it's installed.
 */

import { apiData } from "./client";

export type TrackingStatus = "LIVE" | "ACTIVE_NO_LOCATION" | "NOT_STARTED";

// ---------- Sessions ------------------------------------------------------

export interface SessionStartResponse {
  sessionId: string;
  startedAt: string;
}

export function startLocationSession(): Promise<SessionStartResponse> {
  return apiData<SessionStartResponse>(
    "/api/v1/sales/location/sessions/start",
    { method: "POST" },
  );
}

export function stopLocationSession(): Promise<{ stoppedAt: string }> {
  return apiData<{ stoppedAt: string }>(
    "/api/v1/sales/location/sessions/stop",
    { method: "POST" },
  );
}

export interface LocationUpdateInput {
  lat: number;
  lng: number;
  accuracy?: number;
  battery_level?: number;
  session_id?: string;
  timestamp?: string;
}

/** REST fallback for location updates (use WebSocket in foreground). */
export function postLocationUpdate(
  input: LocationUpdateInput,
): Promise<{ accepted: true }> {
  return apiData<{ accepted: true }>("/api/v1/sales/location/update", {
    method: "POST",
    body: input,
  });
}

// ---------- Admin team status --------------------------------------------

export interface TeamStatusMember {
  user_id: string;
  user_name: string;
  tracking_status: TrackingStatus;
  is_live: boolean;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  battery_level: number | null;
  last_updated_at: string | null;
  session_id: string | null;
  started_at: string | null;
}

export interface TeamStatusResponse {
  members: TeamStatusMember[];
  live_count: number;
  active_no_location_count: number;
  not_started_count: number;
  total_count: number;
}

export function getLocationTeamStatus(
  q: { group_id?: string } = {},
  signal?: AbortSignal,
): Promise<TeamStatusResponse> {
  return apiData<TeamStatusResponse>("/api/v1/sales/location/team-status", {
    query: { group_id: q.group_id },
    signal,
  });
}

// ---------- Live snapshot -------------------------------------------------

export interface LivePosition {
  userId: string;
  lat: number;
  lng: number;
  updatedAt: string;
  source: "websocket" | "rest";
}

export interface LiveSnapshotResponse {
  live: LivePosition[];
  total_active: number;
}

export function getLiveLocations(
  signal?: AbortSignal,
): Promise<LiveSnapshotResponse> {
  return apiData<LiveSnapshotResponse>("/api/v1/sales/location/live", {
    signal,
  });
}

// ---------- Active sessions ----------------------------------------------

export interface LocationSession {
  session_id: string;
  user_id: string;
  user_name: string;
  started_at: string;
  ended_at: string | null;
  last_update_at: string | null;
}

export function listLocationSessions(
  signal?: AbortSignal,
): Promise<LocationSession[]> {
  return apiData<{ sessions: LocationSession[] } | LocationSession[]>(
    "/api/v1/sales/location/sessions",
    { signal },
  ).then((res) =>
    Array.isArray(res)
      ? res
      : (res as { sessions: LocationSession[] }).sessions ?? [],
  );
}

// ---------- History -------------------------------------------------------

export interface LocationHistoryEntry {
  id: string;
  user_id: string;
  hospital_id: string | null;
  lat: number;
  lng: number;
  recorded_at: string;
  source: "admin_pin" | "field_pin" | "session";
}

export function getUserLocationHistory(
  userId: string,
  q: { from?: string; to?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<LocationHistoryEntry[]> {
  return apiData<
    { entries: LocationHistoryEntry[] } | LocationHistoryEntry[]
  >(`/api/v1/sales/location/history/${userId}`, {
    query: { from: q.from, to: q.to, limit: q.limit },
    signal,
  }).then((res) =>
    Array.isArray(res)
      ? res
      : (res as { entries: LocationHistoryEntry[] }).entries ?? [],
  );
}

// ---------- Tracks (GPS path) --------------------------------------------

export interface TrackPoint {
  t: string;
  lat: number;
  lng: number;
  acc?: number;
}

export interface TrackSession {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  meters: number;
  /** Present on `/track/range` to disambiguate sessions across days. */
  date?: string;
  points: TrackPoint[];
}

export interface TrackResponse {
  user_id: string;
  date?: string;
  session_count: number;
  total_meters: number;
  tracks: TrackSession[];
}

// The track endpoints have drifted across backend revisions: the GPS array
// has appeared under `points` / `path` / `coordinates`, coordinates as
// `lat`/`lng` or `latitude`/`longitude` (or `lon`), and occasionally as
// GeoJSON `[lng, lat]` tuples — while the day rollup (`session_count`,
// `total_meters`) stays snake_case. Normalize every variant to the
// TrackResponse the map components expect, so a single wire change can't
// silently blank the map. See memory: lat/lng vs latitude/longitude drift.

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function pickNumber(
  rec: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
      return Number(v);
    }
  }
  return undefined;
}

function pickString(
  rec: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v !== "") return v;
  }
  return undefined;
}

function pickArray(rec: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const k of keys) {
    if (Array.isArray(rec[k])) return rec[k] as unknown[];
  }
  return [];
}

function normalizeTrackPoint(raw: unknown): TrackPoint | null {
  let lat: number | undefined;
  let lng: number | undefined;
  let t: string | undefined;
  let acc: number | undefined;

  if (Array.isArray(raw)) {
    // GeoJSON convention is [lng, lat].
    lng = typeof raw[0] === "number" ? raw[0] : undefined;
    lat = typeof raw[1] === "number" ? raw[1] : undefined;
  } else {
    const p = asRecord(raw);
    lat = pickNumber(p, "lat", "latitude");
    lng = pickNumber(p, "lng", "lon", "long", "longitude");
    t = pickString(p, "t", "timestamp", "time", "recorded_at", "captured_at");
    acc = pickNumber(p, "acc", "accuracy");
  }

  if (lat === undefined || lng === undefined) return null;
  return { t: t ?? "", lat, lng, ...(acc !== undefined ? { acc } : {}) };
}

function normalizeTrackSession(raw: unknown, index: number): TrackSession {
  const s = asRecord(raw);
  const points = pickArray(
    s,
    "points",
    "path",
    "coordinates",
    "coords",
    "pings",
    "locations",
  )
    .map(normalizeTrackPoint)
    .filter((p): p is TrackPoint => p !== null);

  return {
    session_id:
      pickString(s, "session_id", "sessionId", "id") ?? `session-${index}`,
    started_at: pickString(s, "started_at", "startedAt", "start_at") ?? "",
    ended_at: pickString(s, "ended_at", "endedAt", "end_at") ?? null,
    meters:
      pickNumber(s, "meters", "distance_meters", "distanceMeters", "distance") ??
      0,
    date: pickString(s, "date"),
    points,
  };
}

function normalizeTrackResponse(raw: unknown): TrackResponse {
  const root = asRecord(raw);
  const tracks = pickArray(root, "tracks", "sessions", "segments", "routes").map(
    normalizeTrackSession,
  );
  return {
    user_id: pickString(root, "user_id", "userId") ?? "",
    date: pickString(root, "date"),
    session_count: pickNumber(root, "session_count", "sessionCount") ?? tracks.length,
    total_meters: pickNumber(root, "total_meters", "totalMeters") ?? 0,
    tracks,
  };
}

export function getLocationTrack(
  q: { user_id?: string; date?: string } = {},
  signal?: AbortSignal,
): Promise<TrackResponse> {
  return apiData<unknown>("/api/v1/sales/location/track", {
    query: { user_id: q.user_id, date: q.date },
    signal,
  }).then(normalizeTrackResponse);
}

export function getLocationTrackRange(
  q: { from: string; to: string; user_id?: string },
  signal?: AbortSignal,
): Promise<TrackResponse> {
  return apiData<unknown>("/api/v1/sales/location/track/range", {
    query: { from: q.from, to: q.to, user_id: q.user_id },
    signal,
  }).then(normalizeTrackResponse);
}
