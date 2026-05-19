"use client";

/**
 * Thin wrapper around the Socket.IO `/location` namespace.
 *
 * Spec: SALES_ADMIN_API.md §12 / SALES_SUBADMIN_API.md §10 (WebSocket).
 *
 * `socket.io-client` is intentionally NOT a hard dependency — the rest of
 * the app works on REST alone, and the bundle stays small for callers who
 * don't open a live map. When you need it:
 *
 *     npm i socket.io-client
 *
 * Then call `connectLocationSocket({ token, baseUrl })`. If the package
 * isn't installed, the helper logs a one-time warning and returns a no-op
 * adapter so screens can keep rendering.
 */

import { getApiBaseUrl, getAuthToken } from "@/lib/api/client";

export interface LocationUpdateEvent {
  user_id: string;
  user_name: string;
  lat: number;
  lng: number;
  accuracy?: number;
  battery_level?: number;
  timestamp: string;
  session_id: string;
}

export interface SessionEvent {
  user_id: string;
  session_id: string;
  started_at?: string;
  ended_at?: string;
}

export interface StaleEvent {
  user_id: string;
  last_seen: string;
}

export interface DistanceUpdateEvent {
  user_id: string;
  date: string;
  meters: number;
  km: number;
  delta_meters: number;
  sessions: number;
}

export interface PositionSnapshot {
  user_id: string;
  user_name: string;
  lat: number;
  lng: number;
  updated_at: string;
}

export interface LocationSocketHandlers {
  onPositions?: (snapshot: PositionSnapshot[]) => void;
  onUpdate?: (e: LocationUpdateEvent) => void;
  onSessionStart?: (e: SessionEvent) => void;
  onSessionStop?: (e: SessionEvent) => void;
  onStale?: (e: StaleEvent) => void;
  onDistance?: (e: DistanceUpdateEvent) => void;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
}

export interface LocationSocketAdapter {
  /** Admin-only: receive everyone's positions + events. */
  subscribeAdmin(teamId?: string): void;
  /** Rep-only: announce a new session is starting. */
  startSession(sessionId: string): Promise<{ ok: boolean }>;
  /** Rep-only: push a GPS update over WS (faster than REST). */
  sendUpdate(update: {
    sessionId: string;
    lat: number;
    lng: number;
    accuracy?: number;
    battery_level?: number;
    timestamp?: string;
  }): void;
  /** Rep-only: announce session end. */
  stopSession(sessionId: string): void;
  /** Tear down the connection. */
  disconnect(): void;
}

let warned = false;

function noopAdapter(reason: string): LocationSocketAdapter {
  if (!warned) {
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[location-socket] ${reason} — falling back to REST. ` +
        `Install \`socket.io-client\` and reload to enable live updates.`,
    );
  }
  return {
    subscribeAdmin: () => {},
    startSession: async () => ({ ok: false }),
    sendUpdate: () => {},
    stopSession: () => {},
    disconnect: () => {},
  };
}

export interface ConnectLocationSocketOptions {
  /** JWT for the `auth.token` field. Defaults to the stored access token. */
  token?: string | null;
  /** Override the API base URL (defaults to `NEXT_PUBLIC_API_BASE_URL`). */
  baseUrl?: string;
  handlers: LocationSocketHandlers;
}

/**
 * Connect to the `/location` Socket.IO namespace.
 *
 * Returns an adapter you call to emit / subscribe events, plus the handler
 * hookup happens during connection. The function dynamically imports
 * `socket.io-client` so the dependency stays optional.
 */
export async function connectLocationSocket(
  opts: ConnectLocationSocketOptions,
): Promise<LocationSocketAdapter> {
  const token = opts.token ?? getAuthToken();
  if (!token) return noopAdapter("no auth token");

  // Dynamic import keeps `socket.io-client` out of the bundle for screens
  // that never call this function, and lets us no-op cleanly when it isn't
  // installed at all.
  let ioModule: { io: (url: string, opts: unknown) => unknown };
  try {
    // The `socket.io-client` package is intentionally optional — callers who
    // want live updates run `npm i socket.io-client`. The string indirection
    // and ts-ignore keep TypeScript / bundlers happy when it isn't installed.
    // String-indirected dynamic import — TypeScript can't resolve a runtime
    // string to a module type, which is exactly what we want for an optional
    // peer dependency. Callers who haven't installed `socket.io-client` will
    // hit the catch block below.
    const moduleName = "socket.io-client";
    ioModule = (await import(
      /* webpackIgnore: true */ moduleName
    )) as { io: (url: string, opts: unknown) => unknown };
  } catch {
    return noopAdapter("socket.io-client not installed");
  }

  const base = (opts.baseUrl ?? getApiBaseUrl()).replace(/\/+$/, "");
  const socket = ioModule.io(`${base}/location`, {
    auth: { token },
    transports: ["websocket"],
    autoConnect: true,
  }) as {
    on: (event: string, cb: (...args: unknown[]) => void) => void;
    emit: (
      event: string,
      payload?: unknown,
      ack?: (response: unknown) => void,
    ) => void;
    disconnect: () => void;
  };

  const h = opts.handlers;
  socket.on("connect", () => h.onConnect?.());
  socket.on("disconnect", (...args: unknown[]) =>
    h.onDisconnect?.(typeof args[0] === "string" ? args[0] : "unknown"),
  );
  socket.on("location:positions", (snapshot: unknown) => {
    if (Array.isArray(snapshot)) {
      h.onPositions?.(snapshot as PositionSnapshot[]);
    }
  });
  socket.on("location:update", (e: unknown) =>
    h.onUpdate?.(e as LocationUpdateEvent),
  );
  socket.on("session:start", (e: unknown) =>
    h.onSessionStart?.(e as SessionEvent),
  );
  socket.on("session:stop", (e: unknown) =>
    h.onSessionStop?.(e as SessionEvent),
  );
  socket.on("location:stale", (e: unknown) =>
    h.onStale?.(e as StaleEvent),
  );
  socket.on("distance:update", (e: unknown) =>
    h.onDistance?.(e as DistanceUpdateEvent),
  );

  return {
    subscribeAdmin: (teamId) =>
      socket.emit("admin:subscribe", teamId ? { team_id: teamId } : {}),
    startSession: (sessionId) =>
      new Promise((resolve) => {
        socket.emit("location:start", { sessionId }, (ack) =>
          resolve((ack as { ok?: boolean })?.ok ? { ok: true } : { ok: false }),
        );
      }),
    sendUpdate: (update) =>
      socket.emit("location:update", update),
    stopSession: (sessionId) => socket.emit("location:stop", { sessionId }),
    disconnect: () => socket.disconnect(),
  };
}
