/**
 * Central HTTP client for the NYRA Sales API.
 *
 * - Reads base URL from NEXT_PUBLIC_API_BASE_URL (defaults to hcs.nyraai.io).
 * - Injects `Authorization: Bearer <jwt>` from the auth token store.
 * - Normalizes the `{ data: ... }` envelope used by the backend.
 * - Throws an `ApiError` with status + parsed body on non-2xx responses.
 */

const DEFAULT_BASE_URL = "https://server.nyraai.io";

export const TOKEN_STORAGE_KEY = "nyra-dashboard:auth-token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage may be blocked — ignore.
  }
}

export function getAuthToken(): string | null {
  return readToken();
}

export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL;
  return (fromEnv && fromEnv.trim()) || DEFAULT_BASE_URL;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-stringified into the body. Skip for GET/DELETE without payload. */
  body?: unknown;
  /**
   * Query-string params object. Each value is coerced to a string; arrays
   * are joined with commas; null/undefined/empty/object values are skipped.
   * Accepts any record-like object so the typed interface query shapes in
   * endpoint modules slot in directly.
   */
  query?: object;
  /** Extra request headers, merged with the defaults. */
  headers?: Record<string, string>;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** When true, returns the raw Response (used for CSV exports). */
  raw?: boolean;
}

function buildUrl(
  path: string,
  query?: RequestOptions["query"],
): string {
  const base = getApiBaseUrl().replace(/\/+$/, "");
  const cleaned = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${cleaned}`;
  if (!query) return url;
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      usp.append(k, v.join(","));
      continue;
    }
    if (typeof v === "object") continue;
    usp.append(k, String(v));
  }
  const qs = usp.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Core request wrapper. Returns parsed JSON for normal endpoints,
 * or the raw Response when `raw: true` is set.
 */
export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(path, opts.query);
  const token = readToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...opts.headers,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // server.nyraai.io uses HttpOnly cookie auth (login sets a cookie via
  // Set-Cookie, every subsequent request reads it back). `credentials:
  // "include"` is required so the browser sends the cookie. The server
  // returns `Access-Control-Allow-Credentials: true` + `Vary: Origin` to
  // satisfy the credentialed CORS rules.
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      credentials: "include",
    });
  } catch (err) {
    // Browser fetch throws TypeError on network/CORS failures with no
    // useful detail. Re-throw with a message users can act on.
    if (err instanceof TypeError) {
      throw new ApiError(
        0,
        `Network error reaching ${url}. Check that the API is reachable and that CORS allows this origin.`,
        null,
      );
    }
    throw err;
  }

  if (opts.raw) return res as unknown as T;

  if (res.status === 204) return undefined as T;

  // Try to parse JSON; if the body is empty or non-JSON, swallow gracefully.
  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    // If the server returned an HTML error page (e.g. a Vercel 404), the
    // raw text is useless to surface in toasts. Fall back to a generic
    // message keyed on status code instead.
    const looksLikeHtml =
      typeof parsed === "string" && /^\s*<(?:!doctype|html)/i.test(parsed);
    const message = looksLikeHtml
      ? `Server returned ${res.status} (no JSON). The configured API URL "${url}" doesn't look like an API endpoint.`
      : (extractErrorMessage(parsed) ??
        res.statusText ??
        `Request failed (${res.status})`);
    const code = looksLikeHtml ? undefined : extractErrorCode(parsed);
    throw new ApiError(res.status, message, looksLikeHtml ? null : parsed, code);
  }

  return parsed as T;
}

function extractErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const obj = body as Record<string, unknown>;
  if (typeof obj.message === "string") return obj.message;
  if (typeof obj.error === "string") return obj.error;
  if (obj.error && typeof obj.error === "object") {
    const e = obj.error as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
  }
  return undefined;
}

function extractErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const obj = body as Record<string, unknown>;
  if (obj.error && typeof obj.error === "object") {
    const e = obj.error as Record<string, unknown>;
    if (typeof e.code === "string") return e.code;
  }
  return undefined;
}

/**
 * Convenience wrapper for endpoints that return `{ data: T }`.
 * Returns `T` directly. If the response has no envelope, returns the body.
 */
export async function apiData<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const body = await apiRequest<{ data?: T } | T>(path, opts);
  if (body && typeof body === "object" && "data" in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}
