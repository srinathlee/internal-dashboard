"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { isSalesMember } from "@/lib/access";
import { DesktopSidebar } from "./sidebar";
import { Header } from "./header";
import { AppLoader } from "./app-loader";

const SALES_MEMBER_HOME = "/hospitals";

/**
 * Routes a sales member is allowed to land on. Anything else forwards to
 * SALES_MEMBER_HOME. Prefix-style entries (ending with "/") match nested
 * routes like /sales/overview, /sales/leads, etc.
 */
const SALES_MEMBER_ALLOWED: ReadonlyArray<string> = [
  "/hospitals",
  "/performance",
  "/settings",
  "/profile",
  "/sales/", // covers /sales/overview, /sales/leads, etc.
];

function isPathAllowedForSalesMember(pathname: string): boolean {
  return SALES_MEMBER_ALLOWED.some((entry) =>
    entry.endsWith("/") ? pathname.startsWith(entry) : pathname === entry,
  );
}

/**
 * Client-side auth gate for everything under the (dashboard) route group.
 *
 * - While the auth context is hydrating: shows a centered spinner.
 * - When hydrated and unauthenticated: redirects to /login.
 * - Sales members are scoped to a small allowlist (Hospitals / Performance /
 *   Settings / the five Sales tabs) — anything else forwards to /hospitals.
 * - Otherwise renders the full sidebar + header + main shell.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!auth.isLoaded) return;

    if (!auth.user) {
      router.replace("/login");
      return;
    }

    if (isSalesMember(auth) && !isPathAllowedForSalesMember(pathname)) {
      router.replace(SALES_MEMBER_HOME);
    }
  }, [auth, pathname, router]);

  if (!auth.isLoaded || !auth.user) {
    return <AppLoader />;
  }

  // Sales members briefly land on a disallowed route while the redirect
  // queue ticks; show the splash instead of flashing un-permitted content.
  if (isSalesMember(auth) && !isPathAllowedForSalesMember(pathname)) {
    return <AppLoader />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
