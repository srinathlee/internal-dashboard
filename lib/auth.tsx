"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Permission, ResourceContext, User } from "./types";
import { users } from "./mock-data";
import { can as canCheck } from "./permissions";

/**
 * Auth context for the dashboard.
 *
 * v1 has no real authentication — `signIn` accepts any credentials and
 * defaults to the Super Admin so reviewers see the full surface area.
 *
 * The "role switcher" in the header is a dev-only affordance: it calls
 * `setUserById` with one of the 9 mock users. The whole UI re-renders
 * because every conditional goes through `can()`.
 */

export interface AuthContextValue {
  user: User | null;
  isLoaded: boolean;
  /** All 9 seed users, exposed for the dev role-switcher dropdown. */
  allUsers: User[];

  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => void;
  setUserById: (id: string) => void;

  /** Bound permission check — `auth.can("targets:set", { teamId: "sales" })` */
  can: (permission: Permission, resource?: ResourceContext) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "nyra-dashboard:current-user-id";
/** Used by signIn when the entered email doesn't match any known mock user. */
const FALLBACK_USER_ID = "u_priya";

function readStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && users.some((u) => u.id === stored)) return stored;
  } catch {
    // localStorage may be blocked (private mode); fall through.
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // SSR has no localStorage; render with `null` and hydrate in an effect.
  // `isLoaded` flips to true after hydration so consumers can show skeletons
  // and avoid premature redirects.
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setUserId(readStoredUserId());
    setIsLoaded(true);
  }, []);

  const persist = useCallback((id: string) => {
    setUserId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore — non-persisted switch is acceptable
    }
  }, []);

  const setUserById = useCallback(
    (id: string) => {
      if (!users.some((u) => u.id === id)) {
        throw new Error(`Unknown user id: ${id}`);
      }
      persist(id);
    },
    [persist],
  );

  const signIn = useCallback(
    async (email: string, _password: string): Promise<User> => {
      // Mock auth: match by email; fall back to the default super-admin user
      // so unknown credentials still produce a usable session.
      const match = users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
      );
      const target = match ?? users.find((u) => u.id === FALLBACK_USER_ID)!;
      persist(target.id);
      return target;
    },
    [persist],
  );

  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setUserId(null);
  }, []);

  const user = useMemo(
    () => (userId ? users.find((u) => u.id === userId) ?? null : null),
    [userId],
  );

  const can = useCallback(
    (permission: Permission, resource?: ResourceContext) =>
      canCheck(user, permission, resource),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoaded,
      allUsers: users,
      signIn,
      signOut,
      setUserById,
      can,
    }),
    [user, isLoaded, signIn, signOut, setUserById, can],
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
