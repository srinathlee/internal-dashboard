"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Permission, ResourceContext, Role, TeamId, User } from "./types";
import { can as canCheck } from "./permissions";
import {
  authMeFromJwt,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  readPersistedMe,
  type AuthMe,
} from "./api/auth";
import { ApiError, getAuthToken, setAuthToken } from "./api/client";

/**
 * Auth context for the dashboard.
 *
 * Backed by the real Sales API:
 *   - signIn() POSTs /api/v1/auth/login and stores the returned JWT.
 *   - On boot we re-hydrate by calling /api/v1/auth/me; if that fails, we
 *     fall back to decoding the JWT so navigation still works offline.
 *   - The legacy `User` / `Role` shape is preserved so existing screens
 *     compile unchanged. The mapping is:
 *
 *       SUPER_ADMIN     -> { role: "super_admin", teamId: null }
 *       SALES_SUBADMIN  -> { role: "member",      teamId: "sales" }
 *
 */

export interface AuthContextValue {
  user: User | null;
  isLoaded: boolean;
  /** JWT for any imperative fetch outside the api modules. */
  token: string | null;

  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => void;
  /** Re-fetch /auth/me — useful after profile updates. */
  refreshUser: () => Promise<void>;

  /** Bound permission check — `auth.can("targets:set", { teamId: "sales" })` */
  can: (permission: Permission, resource?: ResourceContext) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Translate the API role to the local Role + teamId pair the UI expects.
 *
 *   SUPER_ADMIN     -> { role: "super_admin", teamId: null }
 *   SALES_ADMIN     -> { role: "admin",       teamId: <jwt teamId or "sales"> }
 *   SALES_SUBADMIN  -> { role: "member",      teamId: <jwt teamId or "sales"> }
 */
function mapAuthMeToUser(me: AuthMe): User {
  let role: Role;
  switch (me.role) {
    case "SUPER_ADMIN":
      role = "super_admin";
      break;
    case "SALES_ADMIN":
      role = "admin";
      break;
    default:
      role = "member";
  }

  const teamId: TeamId | null =
    me.role === "SUPER_ADMIN"
      ? ((me.teamId as TeamId | null | undefined) ?? null)
      : ((me.teamId as TeamId | undefined) ?? "sales");

  const status =
    me.status === "inactive" || me.status === "INACTIVE"
      ? "inactive"
      : "active";

  return {
    id: me.id,
    name: me.name || me.email || "User",
    email: me.email,
    role,
    teamId,
    status,
    joinedAt: me.joinedAt ?? new Date().toISOString(),
    lastActiveAt: me.lastActiveAt ?? new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Boot: hydrate from persisted user + token (instant), then revalidate
  // via /auth/me only if we have a token to send.
  //
  // The API requires `Authorization: Bearer <jwt>` on every protected
  // endpoint, so attempting /auth/me without a stored token would just
  // return 401 immediately. Skip the network call in that case.
  useEffect(() => {
    let cancelled = false;

    const cached = readPersistedMe();
    const storedToken = getAuthToken();
    if (storedToken) setTokenState(storedToken);
    if (cached && storedToken) setUser(mapAuthMeToUser(cached));

    if (!storedToken) {
      setIsLoaded(true);
      return () => {
        cancelled = true;
      };
    }

    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setUser(mapAuthMeToUser(me));
      })
      .catch((err) => {
        if (cancelled) return;
        // Only clear the session on a hard auth failure (401). Network
        // errors, 5xx, and unexpected response shapes all leave the cached
        // user in place — the token is still valid and we already rendered
        // the cached user above, so a transient revalidation hiccup
        // shouldn't kick the user back to /login or replace their name
        // with the "User" placeholder.
        const isAuthFailure = err instanceof ApiError && err.status === 401;
        if (isAuthFailure) {
          setUser(null);
          setAuthToken(null);
          setTokenState(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<User> => {
      const me = await apiLogin(email, password);
      const stored = getAuthToken();
      setTokenState(stored);
      const next = mapAuthMeToUser(me);
      setUser(next);
      return next;
    },
    [],
  );

  const signOut = useCallback(() => {
    apiLogout();
    setTokenState(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(mapAuthMeToUser(me));
    } catch {
      // ignore — caller can decide whether to surface this
    }
  }, []);

  const can = useCallback(
    (permission: Permission, resource?: ResourceContext) =>
      canCheck(user, permission, resource),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoaded,
      token,
      signIn,
      signOut,
      refreshUser,
      can,
    }),
    [
      user,
      isLoaded,
      token,
      signIn,
      signOut,
      refreshUser,
      can,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
