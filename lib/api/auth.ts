/**
 * Authentication endpoints.
 *
 * Verified live against https://server.nyraai.io:
 *   POST /api/auth/login   { email, password } -> { message, user, token? }
 *   GET  /api/auth/me                          -> { user }
 *
 * The server uses HttpOnly cookie auth — login sets a cookie via
 * Set-Cookie, and every subsequent request needs `credentials: "include"`
 * so the cookie is sent back. The cookie is the source of truth; the
 * `token` field in the response body is optional and only consumed if
 * the server happens to return one (some deployments do).
 *
 * Note: auth lives at /api/auth/* (no /v1/) while sales lives at
 * /api/v1/sales/*. Don't unify them.
 */

import { apiData, apiRequest, setAuthToken } from "./client";
import type { ApiUser, ApiRole } from "./types";

export interface LoginResponse {
  message?: string;
  /** Optional — server normally sets the credential as a cookie. */
  token?: string;
  user: AuthMe;
}

export interface AuthMe {
  id: string;
  name: string;
  email: string;
  /** Backend JWT role. */
  role: ApiRole;
  /** Optional team binding ("sales", "onboarding", or null). */
  teamId?: string | null;
  /** Backend uses "active"/"inactive" or "ACTIVE"/"INACTIVE". */
  status?: "active" | "inactive" | "ACTIVE" | "INACTIVE";
  /** Optional surface details if returned. */
  initials?: string;
  phone?: string;
  joinedAt?: string;
  lastActiveAt?: string | null;
  hospital_id?: string | null;
  branch_id?: string | null;
}

const ME_STORAGE_KEY = "nyra-dashboard:auth-me";

/**
 * Cache the current user payload in localStorage so the next page load
 * can render immediately. Authoritative source is still the cookie +
 * a /api/auth/me re-fetch on boot — this is purely for UX.
 */
function persistMe(me: AuthMe | null): void {
  if (typeof window === "undefined") return;
  try {
    if (me) window.localStorage.setItem(ME_STORAGE_KEY, JSON.stringify(me));
    else window.localStorage.removeItem(ME_STORAGE_KEY);
  } catch {
    // localStorage may be blocked — non-fatal.
  }
}

export function readPersistedMe(): AuthMe | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ME_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthMe) : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/login
 *
 * The API protects every other endpoint with `Authorization: Bearer <jwt>`
 * — so we MUST capture a JWT here. The server may put it in a few different
 * places depending on deployment:
 *   - top-level `token` / `accessToken` / `access_token` / `jwt` / `authToken`
 *   - nested under `data.token`
 *   - as a JS-readable cookie (we read `document.cookie` after the request)
 *
 * We try all of these in order so the client survives backend variants.
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthMe> {
  const body = await apiRequest<unknown>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  const envelope = unwrapData(body);

  const user = (envelope as { user?: AuthMe }).user;
  if (!user) {
    throw new Error("Login response is missing user.");
  }

  // Pull the JWT out of wherever the server put it.
  const tokenFromBody = extractTokenFromObject(envelope);
  const tokenFromCookie = tokenFromBody ? null : extractTokenFromCookies();
  const token = tokenFromBody ?? tokenFromCookie;

  if (!token) {
    // Surface something specific so the next debug pass is fast.
    throw new Error(
      "Login succeeded but no auth token was returned. Looked at: response body keys and document.cookie. Check the backend's login response shape.",
    );
  }

  setAuthToken(token);
  persistMe(user);
  return user;
}

/** If the server wraps the payload in `{ data: ... }`, unwrap once. */
function unwrapData(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in (body as object)) {
    const d = (body as { data: unknown }).data;
    if (d && typeof d === "object") return d;
  }
  return body;
}

/**
 * Search an object for a JWT. Checks well-known field names first, then
 * does a shallow walk for any string that matches the JWT shape
 * (`xxx.yyy.zzz` of base64url segments starting with `ey`).
 */
function extractTokenFromObject(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const KNOWN = [
    "token",
    "accessToken",
    "access_token",
    "jwt",
    "authToken",
    "auth_token",
    "idToken",
    "id_token",
  ];
  const o = obj as Record<string, unknown>;
  for (const k of KNOWN) {
    const v = o[k];
    if (typeof v === "string" && v.length > 10) return v;
  }
  // Shallow walk for any JWT-looking string. Stops at one level deep —
  // we don't want to accidentally grab a token from inside `user.preferences`.
  for (const v of Object.values(o)) {
    if (typeof v === "string" && JWT_PATTERN.test(v)) return v;
  }
  return null;
}

const JWT_PATTERN = /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Look at document.cookie for a JWT-shaped value. This catches deployments
 * that set the token as a non-HttpOnly cookie that the JS client is
 * supposed to read out. HttpOnly cookies are invisible here — that's
 * intentional, and means the backend isn't relying on Bearer auth.
 */
function extractTokenFromCookies(): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie || "";
  if (!raw) return null;
  const parts = raw.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const value = decodeURIComponent(part.slice(eq + 1));
    if (JWT_PATTERN.test(value)) return value;
  }
  return null;
}

/**
 * GET /api/auth/me — fetch the current user given a stored cookie.
 * Used on app boot to rehydrate the session.
 */
export async function fetchMe(): Promise<AuthMe> {
  const me = await apiData<AuthMe>("/api/auth/me");
  persistMe(me);
  return me;
}

export function logout(): void {
  setAuthToken(null);
  persistMe(null);
}

/**
 * Best-effort decode of a JWT to read its role + sub claim.
 * Used as a fallback when /auth/me isn't reachable on first boot AND
 * a token is stored locally.
 */
export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function authMeFromJwt(token: string): AuthMe | null {
  const claims = decodeJwt(token);
  if (!claims) return null;
  const role = (claims.role ?? claims.Role) as ApiRole | undefined;
  const id = (claims.sub ?? claims.userId ?? claims.id) as string | undefined;
  if (!role || !id) return null;
  return {
    id,
    name: (claims.name as string) ?? "",
    email: (claims.email as string) ?? "",
    role,
    teamId: (claims.teamId as string | null) ?? "sales",
    status: "active",
  };
}

export type { ApiUser };
